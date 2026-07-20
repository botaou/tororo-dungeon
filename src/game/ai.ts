import {
  ActivityCategory,
  BirdState,
  CharacterDef,
  EnemyInstance,
  ItemId,
  JobRequest,
  LeisureSpotInstance,
  MaterialId,
  MerchantState,
  MiningNodeInstance,
  Personality,
  ShopKind,
  TreasureNodeInstance,
} from '../types';
import {
  ARRIVAL_THRESHOLD,
  BIRD_INVENTORY_CAP,
  DETOUR_CHANCE_BASE,
  DETOUR_CHANCE_LOW_MOOD,
  DETOUR_DWELL_TICKS,
  ENCOUNTER_HOLD_TICKS,
  FOOD_PRICE,
  GEAR_SHOP_CHECK_CHANCE,
  HAPPINESS_LOW_THRESHOLD,
  HOME_HEAL_PER_TICK,
  HOME_NEED_TICKS,
  INSPIRATION_HP_GAIN,
  INSPIRATION_SKILL_CHANCE,
  INSPIRATION_STAT_CHANCE,
  INSPIRATION_STAT_GAIN,
  LEISURE_CHANCE,
  LEISURE_DWELL_TICKS,
  LOW_HP_RETREAT_THRESHOLD_PERCENT,
  MERCHANT_BUY_CHECK_CHANCE,
  MERCHANT_SELL_CHECK_CHANCE,
  MIN_BIRD_DISTANCE,
  MOVE_SPEED,
  NAP_CHANCE_BASE,
  NAP_CHANCE_GOOD_MOOD,
  NAP_DWELL_TICKS,
  NAP_GOOD_MOOD_THRESHOLD,
  OVERFLOW_SELL_MARGIN,
  OVERFLOW_SELL_MAX_PER_TRIP,
  PLAY_DWELL_TICKS,
  SELL_CHECK_CHANCE_BASE,
  SELL_CHECK_CHANCE_WANTS_MONEY,
  SELL_DWELL_TICKS,
  SELL_MAX_PER_TRIP,
  STARTING_SATIETY,
} from './config';
import { TOWN_X, TOWN_Y } from '../data/world';
import { getShopPosition, MERCHANT_SPOT } from '../data/townGrid';
import { MATERIAL_SELL_PRICE } from '../data/marketPrices';
import { SHOP_DEFS } from '../data/shops';
import { CONVERTIBLE_ITEM_IDS, ITEM_DEF_MAP, ITEM_DEFS } from '../data/items';
import { BIRD_SKILL_DEFS } from '../data/skills';
import { getEffectiveStats, maybeAutoEquip } from './birdStats';
import { AttackAssignment } from './combat';
import { addCappedInventory, addItemCapped, totalInventoryAmount } from './inventoryCap';

// Personality doesn't gate any activity outright — it just weights how
// likely each of the four is to be picked when a bird is free to choose.
// Combat's weight is further scaled down by dangerAversion against however
// threatening the nearest enemy looks, so "cautious" means "fights less
// readily," not "never fights."
interface PersonalityProfile {
  combat: number;
  mining: number;
  explore: number;
  rest: number;
  // Phase 11: weight toward heading to a constructed park/bathhouse — only
  // ever nonzero in practice if at least one exists (see pickCategory).
  play: number;
  dangerAversion: number; // 0 = fearless, 1 = avoids anything but the weakest foe
}

export const PERSONALITY_PROFILES: Record<Personality, PersonalityProfile> = {
  vanguard: { combat: 0.55, explore: 0.3, mining: 0.1, rest: 0.05, play: 0.05, dangerAversion: 0 },
  freeSpirit: { combat: 0.2, explore: 0.2, mining: 0.55, rest: 0.05, play: 0.15, dangerAversion: 0.35 },
  clingy: { combat: 0.25, explore: 0.2, mining: 0.15, rest: 0.4, play: 0.2, dangerAversion: 0.5 },
  cautious: { combat: 0.3, explore: 0.15, mining: 0.1, rest: 0.45, play: 0.15, dangerAversion: 0.85 },
};

// Enemy atk value considered "as dangerous as it gets" for weighting
// purposes; our roster tops out well under this.
const DANGER_ATK_REFERENCE = 8;

function moveToward(bird: BirdState, tx: number, ty: number): boolean {
  const dx = tx - bird.x;
  const dy = ty - bird.y;
  const dist = Math.hypot(dx, dy);
  if (dist <= ARRIVAL_THRESHOLD) return true;
  const step = Math.min(dist, MOVE_SPEED);
  bird.x += (dx / dist) * step;
  bird.y += (dy / dist) * step;
  return false;
}

function nearest<T extends { x: number; y: number }>(items: T[], x: number, y: number): T | null {
  let best: T | null = null;
  let bestDist = Infinity;
  for (const item of items) {
    const d = Math.hypot(item.x - x, item.y - y);
    if (d < bestDist) {
      bestDist = d;
      best = item;
    }
  }
  return best;
}

// Field points must land outside the town zone (an ellipse, not a circle —
// see townGrid.ts's getTownZoneRadius) so idle "explore" wandering never
// drifts into the town's own footprint; town points are scaled to the same
// ellipse (slightly reined in) so idle "rest" wandering stays proportional
// to however big the town zone currently is, instead of a fixed radius.
function randomPointInField(zoneRadius: { rx: number; ry: number }): { x: number; y: number } {
  for (let attempt = 0; attempt < 8; attempt++) {
    const x = 0.1 + Math.random() * 0.8;
    const y = 0.15 + Math.random() * 0.7;
    const dx = (x - TOWN_X) / zoneRadius.rx;
    const dy = (y - TOWN_Y) / zoneRadius.ry;
    if (dx * dx + dy * dy > 1) return { x, y };
  }
  return { x: 0.15, y: 0.2 };
}

// Phase 12③("鳥が道・建物をすり抜ける問題"): a resting bird's stroll target
// used to be a purely random point in the town zone, with no awareness of
// where actual buildings stand — it could just as easily land right on top
// of the town hall or a constructed shop as on open ground. This doesn't
// give birds real per-tile pathfinding around buildings (a much bigger
// change — see the request's own explicitly-allowed simple-fix fallback),
// but it does stop a *destination* from ever being chosen inside a
// building's own footprint, so a resting bird never deliberately walks up
// to stand on/inside one. `occupiedSpots` is every constructed plot's
// center plus the town hall itself (see useWorldStore.tick()'s AiWorld
// construction); BUILDING_CLEARANCE approximates half a plot's own on-
// screen footprint in the same 0..1 normalized coordinate space everything
// else here uses.
const BUILDING_CLEARANCE = 0.028;

function randomPointNearTown(
  zoneRadius: { rx: number; ry: number },
  occupiedSpots: { x: number; y: number }[] = []
): { x: number; y: number } {
  for (let attempt = 0; attempt < 8; attempt++) {
    const angle = Math.random() * Math.PI * 2;
    const scale = Math.random() * 0.85;
    const point = {
      x: Math.min(0.92, Math.max(0.08, TOWN_X + Math.cos(angle) * zoneRadius.rx * scale)),
      y: Math.min(0.88, Math.max(0.16, TOWN_Y + Math.sin(angle) * zoneRadius.ry * scale)),
    };
    const blocked = occupiedSpots.some((spot) => Math.hypot(point.x - spot.x, point.y - spot.y) < BUILDING_CLEARANCE);
    if (!blocked) return point;
  }
  return {
    x: Math.min(0.92, Math.max(0.08, TOWN_X)),
    y: Math.min(0.88, Math.max(0.16, TOWN_Y)),
  };
}

export interface AiWorld {
  enemies: EnemyInstance[];
  miningNodes: MiningNodeInstance[];
  treasures: TreasureNodeInstance[];
  leisureSpots: LeisureSpotInstance[];
  requests: JobRequest[];
  // Snapshot of what's currently on each shop's shelf — read-only from the
  // AI's perspective; the store applies the actual decrement (see
  // AiStepOutcome.shopPurchase).
  shopStock: Record<ShopKind, Partial<Record<ItemId, number>>>;
  // Where each currently-reachable shop actually is — the two fixed shops
  // (general/feed) plus whichever of weapon/armor/branch options the player
  // has constructed somewhere (see data/townGrid.ts's getAllShopPositions).
  // A kind absent here means no such shop exists yet.
  shopPositions: Partial<Record<ShopKind, { x: number; y: number }>>;
  // The visiting merchant, if one currently has its stall set up — null
  // between visits. Read-only from the AI's perspective, same as shopStock.
  merchant: MerchantState | null;
  // The town zone's footprint (see townGrid.ts's getTownZoneRadius) — a
  // fixed ellipse, passed through here rather than hardcoded so idle
  // wandering (explore/rest) and the "waiting around town" job fallbacks
  // stay expressed relative to it instead of duplicating the constant.
  townZoneRadius: { rx: number; ry: number };
  // The player's current gold — only used to decide whether it's even worth
  // *forcing* an overflow sell trip (see stepBird's isFull check). A
  // real-device report: once a bird was over BIRD_INVENTORY_CAP, it forced
  // a sell trip every single tick regardless of whether the player could
  // actually afford anything, so a cash-poor town saw a bird endlessly walk
  // to the shop and "sell" zero units forever — worse, since every tick
  // spent on that forced trip is a tick *not* spent hunting/gathering/doing
  // jobs, none of the town's other income sources could run either,
  // deadlocking the whole town's economy. Checking affordability before
  // forcing the trip breaks that: if the player can't afford it right now,
  // the bird falls back to its normal (much lower-chance) probabilistic
  // roll instead, freeing it to go earn the town some gold in the meantime.
  playerGold: number;
  // Every constructed park/bathhouse (see data/townGrid.ts's
  // getAllAmenityPositions) — the destinations for Phase 11's "play"
  // category. Empty until the player builds at least one.
  amenityPositions: { id: string; kind: 'park' | 'bathhouse'; x: number; y: number }[];
  // Every constructed plot's center plus the town hall itself — see
  // randomPointNearTown's own comment (Phase 12③). Only used to keep idle
  // "rest" wander destinations off of building footprints; every other
  // job/behavior already has its own explicit destination (a shop, a
  // mining node, etc.) so this doesn't need to apply anywhere else.
  occupiedSpots: { x: number; y: number }[];
  // Phase 14: a recruited bird's own house, keyed by defId — only present
  // for birds who actually have one assigned (see useTownStore's houses,
  // HouseState.residentDefId). A bird with no entry here is genuinely
  // homeless, not a data error (see BirdState.houselessTicks) — every call
  // site falls back to the town hall's position as a temporary "lodging"
  // spot, see getHomePosition below.
  housePositions: Partial<Record<string, { x: number; y: number }>>;
}

// A bird's own house position, or the town hall as a stand-in for a
// recruited bird that doesn't have one yet (Phase 14) — framed as
// temporarily lodging at the town hall rather than an error state, since
// "recruited but houseless" is an expected, ongoing situation now (see
// useWorldStore's houseless-sulk tick logic).
function getHomePosition(world: AiWorld, defId: string): { x: number; y: number } {
  return world.housePositions[defId] ?? { x: TOWN_X, y: TOWN_Y };
}

// A permanent stat a play-session "inspiration" roll can bump (see
// executePlay/rollInspiration below).
export type InspirationStat = 'atk' | 'defense' | 'speed' | 'luck' | 'maxHp';

export interface AiStepOutcome {
  assignments: AttackAssignment[];
  // Only populated by job fulfillment now — free-roam gathering credits the
  // bird's own inventory directly instead (see stepCarrying).
  materialsCollected: Partial<Record<MaterialId, number>>;
  treasureCollectedUid: string | null;
  miningCollectedUid: string | null;
  jobCompletedId: string | null;
  // Set when a bird finishes a shop-selling trip — the store checks whether
  // the player can afford to buy this haul before crediting anyone.
  // `overflow` is true when this trip was triggered by BIRD_INVENTORY_CAP
  // (see executeSellTrip) rather than the casual probabilistic roll — the
  // store applies a much larger spend cap for those (see OVERFLOW_SELL_*).
  sellAttempt: { materialId: MaterialId; amount: number; overflow: boolean } | null;
  // Set the moment a carried haul is deposited into the bird's own house —
  // purely for the activity log (the actual crediting already happened here).
  deliveredMaterial: { materialId: MaterialId; amount: number } | null;
  // Gold a bird paid for a shop meal this tick (0 if it ate for free because
  // it couldn't afford FOOD_PRICE, or if nothing happened this tick).
  foodPurchase: number;
  // Set when a bird completes a real shop purchase — a feed-shop treat
  // instead of the free ration, or a weapon/armor from the general shop.
  // The store applies the shelf decrement + item transfer + shop toll.
  shopPurchase: { shopKind: ShopKind; itemId: ItemId; amount: number; totalCost: number } | null;
  // Set when a bird finishes selling a convertible item to the visiting
  // merchant — the store looks up the item's value and splits it 50/50
  // between the bird and the town (see MERCHANT_BUYBACK_SPLIT).
  merchantSellAttempt: { itemId: ItemId; amount: number } | null;
  // Set when a bird finishes buying something off the merchant's randomized
  // shelf — the store decrements that lineup slot and charges the bird
  // (this gold leaves the game entirely; unlike the town's own shops, the
  // merchant isn't part of the town's economy).
  merchantBuyAttempt: { itemId: ItemId; amount: number; totalCost: number } | null;
  // Set when a gather roll hits a mining node's bonusDropTable — purely for
  // the activity log; the item itself is already credited to the bird
  // in-place (see executeGather).
  bonusItemFound: ItemId | null;
  // Set when a hungry bird ate from its own house food stock instead of
  // walking to the feed shop (see tryEatHouseFood) — purely for the
  // activity log; the stock decrement already happened in-place.
  ateHouseFood: ItemId | null;
  // Set the first tick a bird actually starts playing at a park/bathhouse
  // (see executePlay) — purely for the activity log.
  startedPlaying: 'park' | 'bathhouse' | null;
  // Set the tick a bird commits to a fresh detour stroll (see executeDetour)
  // — purely for the activity log.
  detourStarted: boolean;
  // Set the tick a bird commits to a fresh at-home nap (see executeNap) —
  // purely for the activity log.
  startedNapping: boolean;
  // Set when a play-session's per-tick inspiration roll hits — the stat/
  // skill change itself already happened in-place (see executePlay); this
  // is purely for the activity log + (for a skill) the notification modal.
  inspiration: { kind: 'stat'; stat: InspirationStat; amount: number } | { kind: 'skill'; skillId: string } | null;
}

function emptyOutcome(): AiStepOutcome {
  return {
    assignments: [],
    materialsCollected: {},
    treasureCollectedUid: null,
    miningCollectedUid: null,
    jobCompletedId: null,
    sellAttempt: null,
    deliveredMaterial: null,
    foodPurchase: 0,
    shopPurchase: null,
    merchantSellAttempt: null,
    merchantBuyAttempt: null,
    bonusItemFound: null,
    ateHouseFood: null,
    startedPlaying: null,
    detourStarted: false,
    startedNapping: false,
    inspiration: null,
  };
}

function categoryOf(targetKind: BirdState['targetKind']): ActivityCategory | null {
  switch (targetKind) {
    case 'enemy':
      return 'combat';
    case 'mining':
    case 'treasure':
      return 'mining';
    case 'explore':
      return 'explore';
    case 'rest':
    case 'river':
    case 'pond':
    case 'nap':
      return 'rest';
    case 'play':
      return 'play';
    case 'shop':
      return null;
    default:
      return null;
  }
}

// Weighted pick among whichever of the four activities are actually
// available right now (an empty field means zero weight, not "impossible
// to pick" — explore/rest always have some weight so there's always a
// choice to make).
function pickCategory(bird: BirdState, def: CharacterDef, world: AiWorld): ActivityCategory {
  const profile = PERSONALITY_PROFILES[def.personality];
  const aliveEnemies = world.enemies.filter((e) => !e.defeated && e.hp > 0);
  const nearestEnemy = nearest(aliveEnemies, bird.x, bird.y);
  const hasGatherable =
    world.miningNodes.some((m) => !m.collected) || world.treasures.some((t) => !t.collected);
  const hasAmenity = world.amenityPositions.length > 0;
  // A bored/unhappy bird is more drawn to playing (Phase 11 request: tie
  // this to the existing happiness meter).
  const playMoodBoost = bird.happiness <= HAPPINESS_LOW_THRESHOLD ? 2 : 1;

  let combatWeight = 0;
  if (nearestEnemy) {
    const danger = Math.min(1, nearestEnemy.atk / DANGER_ATK_REFERENCE);
    combatWeight = Math.max(0, profile.combat * (1 - profile.dangerAversion * danger));
  }
  const miningWeight = hasGatherable ? profile.mining : 0;
  const exploreWeight = profile.explore;
  const restWeight = profile.rest;
  const playWeight = hasAmenity ? profile.play * playMoodBoost : 0;

  const total = combatWeight + miningWeight + exploreWeight + restWeight + playWeight;
  let roll = Math.random() * total;
  if ((roll -= combatWeight) < 0) return 'combat';
  if ((roll -= miningWeight) < 0) return 'mining';
  if ((roll -= exploreWeight) < 0) return 'explore';
  if ((roll -= restWeight) < 0) return 'rest';
  return 'play';
}

// Detour chance is boosted the same way play's weight is — a bored/unhappy
// bird is more likely to wander off instead of heading straight to its next
// task (see HAPPINESS_LOW_THRESHOLD).
function detourChance(bird: BirdState): number {
  return bird.happiness <= HAPPINESS_LOW_THRESHOLD ? DETOUR_CHANCE_LOW_MOOD : DETOUR_CHANCE_BASE;
}

function isStillPursuing(bird: BirdState, category: ActivityCategory, world: AiWorld): boolean {
  switch (category) {
    case 'combat':
      return world.enemies.some((e) => e.uid === bird.targetRefUid && !e.defeated && e.hp > 0);
    case 'mining':
      if (bird.targetKind === 'mining') return world.miningNodes.some((m) => m.uid === bird.targetRefUid && !m.collected);
      if (bird.targetKind === 'treasure') return world.treasures.some((t) => t.uid === bird.targetRefUid && !t.collected);
      return false;
    case 'explore':
    case 'rest':
      // These conclude a "leg" at a time (see executors) rather than being
      // invalidated externally, so once set they stay valid until cleared.
      return bird.targetKind !== null;
    case 'play':
      return world.amenityPositions.some((a) => a.id === bird.targetRefUid);
  }
}

export function stepBird(bird: BirdState, def: CharacterDef, world: AiWorld): AiStepOutcome {
  // Survival comes before everything else — a bird whose hp has bottomed
  // out (or gotten critically low) heads straight home to recover,
  // overriding jobs, carrying, hunger, selling, all of it. Once recovery
  // starts it's "sticky" (bird.activity stays 'recovering') until HP is
  // completely full, not just back above the trigger threshold —
  // otherwise a bird would leave home the instant it ticks over the line
  // and immediately walk back into the same fight that wore it out in the
  // first place (the old loop: hp bottoms out → tiny in-place heal →
  // straight back into combat → hp bottoms out again).
  const isRecovering = bird.activity === 'recovering' ? bird.hp < bird.maxHp : bird.hp <= 0 || bird.hp < bird.maxHp * LOW_HP_RETREAT_THRESHOLD_PERCENT;
  if (isRecovering) {
    return stepRecover(bird, world);
  }

  // A real-device request: the chat speech bubble (see useWorldStore's
  // tick, which sets this) barely registered because the bird kept right on
  // moving while it showed, making the pause hard to connect to the bubble.
  // Holding the bird here (skipping every other decision for a few ticks,
  // second in priority only to recovering) makes "stopped to talk" an
  // actual visible beat instead of a passing coincidence.
  if (bird.chatPauseTicks > 0) {
    bird.chatPauseTicks -= 1;
    bird.activity = 'chatting';
    return emptyOutcome();
  }

  if (bird.currentJobId) {
    return stepJob(bird, def, world);
  }

  if (bird.carrying) {
    return stepCarrying(bird, world);
  }

  if (bird.mood === 'hungry') {
    // A real-device request: a bird's own house food stock (see
    // HouseInventoryModal) should be eaten first, before ever walking to
    // the feed shop — it's already "at home," so this resolves instantly
    // with no travel needed, unlike stepShopFood's trip.
    const ateItemId = tryEatHouseFood(bird);
    if (ateItemId) {
      const outcome = emptyOutcome();
      outcome.ateHouseFood = ateItemId;
      return outcome;
    }
    return stepShopFood(bird, world);
  }
  if (bird.mood === 'sleepy') {
    return stepHomeNeed(bird, 'resting', world);
  }

  // Continue an already-committed selling trip, or roll to start a new one.
  if (bird.targetKind === 'shop' && bird.activity === 'selling') {
    return executeSellTrip(bird);
  }
  if (hasSellableInventory(bird)) {
    // Only *force* the trip (chance = 1) if the player can actually afford
    // at least one unit of it — otherwise a cash-poor town would have a
    // full bird endlessly walk to the shop and sell nothing, forever, since
    // being stuck on this forced trip every tick leaves no room for the
    // bird to go earn the town any gold either (see AiWorld.playerGold).
    const isFull = totalInventoryAmount(bird.inventory) >= BIRD_INVENTORY_CAP && canAffordBestSale(bird, world.playerGold);
    const chance = isFull ? 1 : bird.mood === 'wantsMoney' ? SELL_CHECK_CHANCE_WANTS_MONEY : SELL_CHECK_CHANCE_BASE;
    if (Math.random() < chance) {
      bird.targetKind = 'shop';
      bird.activity = 'selling';
      bird.workProgress = 0;
      return executeSellTrip(bird);
    }
  }

  // Continue an already-committed gear-shopping trip, or occasionally roll
  // to start one — a free bird missing a weapon or armor of its own checks
  // whether the general shop has something it can afford.
  if (bird.targetKind === 'shop' && bird.activity === 'buyingGear') {
    return executeGearShopTrip(bird, world);
  }
  if (Math.random() < GEAR_SHOP_CHECK_CHANCE && pickGearOffer(bird, world)) {
    bird.targetKind = 'shop';
    bird.activity = 'buyingGear';
    bird.workProgress = 0;
    return executeGearShopTrip(bird, world);
  }

  // The merchant's stall only exists to interact with while it's actually
  // set up — both triggers below are no-ops whenever world.merchant is null.
  if (world.merchant) {
    if (bird.targetKind === 'shop' && bird.activity === 'merchantSelling') {
      return executeMerchantSellTrip(bird);
    }
    if (hasConvertibleItems(bird) && Math.random() < MERCHANT_SELL_CHECK_CHANCE) {
      bird.targetKind = 'shop';
      bird.activity = 'merchantSelling';
      bird.workProgress = 0;
      return executeMerchantSellTrip(bird);
    }

    if (bird.targetKind === 'shop' && bird.activity === 'merchantBuying') {
      return executeMerchantBuyTrip(bird, world);
    }
    if (Math.random() < MERCHANT_BUY_CHECK_CHANCE && pickMerchantBuyOffer(bird, world)) {
      bird.targetKind = 'shop';
      bird.activity = 'merchantBuying';
      bird.workProgress = 0;
      return executeMerchantBuyTrip(bird, world);
    }
  }

  // Continue an already-committed detour stroll (see executeDetour) — never
  // interrupts a job/combat/mining pursuit, since this is only ever entered
  // via the fresh-decision branch below.
  if (bird.targetKind === 'detour') {
    return executeDetour(bird);
  }

  let category = categoryOf(bird.targetKind);
  if (!category || !isStillPursuing(bird, category, world)) {
    // A real-device request: birds should occasionally take a little detour
    // instead of beelining straight to their next task. Rolled only at this
    // same "picking something fresh to do" decision point — never as a
    // mid-pursuit interrupt — so the job/combat/mining state machines stay
    // completely untouched by this feature.
    if (Math.random() < detourChance(bird)) {
      bird.targetKind = 'detour';
      bird.targetRefUid = null;
      bird.workProgress = 0;
      return executeDetour(bird);
    }
    category = pickCategory(bird, def, world);
    bird.targetKind = null;
    bird.targetRefUid = null;
    bird.workProgress = 0;
  }

  switch (category) {
    case 'combat':
      return executeCombat(bird, def, world);
    case 'mining':
      return executeGather(bird, def, world);
    case 'explore':
      return executeExplore(bird, world);
    case 'rest':
      return executeRest(bird, world);
    case 'play':
      return executePlay(bird, world);
  }
}

// Critically wounded or completely worn out → walk home and rest up until
// fully healed (see LOW_HP_RETREAT_THRESHOLD_PERCENT/HOME_HEAL_PER_TICK). No
// in-place instant partial heal, no re-engaging combat halfway recovered —
// only once HP is completely full does stepBird let normal behavior (and
// combat) resume.
function stepRecover(bird: BirdState, world: AiWorld): AiStepOutcome {
  const house = getHomePosition(world, bird.defId);
  const arrived = moveToward(bird, house.x, house.y);
  bird.activity = 'recovering';
  bird.targetKind = null;
  bird.targetRefUid = null;
  if (arrived) {
    bird.hp = Math.min(bird.maxHp, bird.hp + HOME_HEAL_PER_TICK);
  }
  return emptyOutcome();
}

// Sleepy → go home and rest. Once satisfied for HOME_NEED_TICKS the mood
// clears back to normal instead of waiting on the ambient refresh timer.
// "Home" is the bird's own house.
function stepHomeNeed(bird: BirdState, activity: 'resting', world: AiWorld): AiStepOutcome {
  if (bird.activity !== activity) {
    bird.workProgress = 0;
  }
  const house = getHomePosition(world, bird.defId);
  const arrived = moveToward(bird, house.x, house.y);
  bird.activity = activity;
  bird.targetKind = null;
  bird.targetRefUid = null;
  if (arrived) {
    bird.workProgress += 1;
    if (bird.workProgress >= HOME_NEED_TICKS) {
      bird.mood = 'normal';
      bird.moodChangedAt = Date.now();
      bird.workProgress = 0;
    }
  }
  return emptyOutcome();
}

// Eats one unit from the bird's own house food stock, if any — see
// HouseInventoryModal. Returns the itemId eaten (for the activity log) or
// null if the stock is empty, in which case the caller falls back to
// stepShopFood's shop trip.
function tryEatHouseFood(bird: BirdState): ItemId | null {
  for (const [itemId, amount] of Object.entries(bird.houseFood) as [ItemId, number][]) {
    if ((amount ?? 0) > 0) {
      bird.houseFood[itemId] = amount - 1;
      bird.satiety = STARTING_SATIETY;
      bird.mood = 'normal';
      bird.moodChangedAt = Date.now();
      return itemId;
    }
  }
  return null;
}

// Picks an affordable, in-stock food item at the feed shop for a hungry
// bird to treat itself to, instead of the always-free basic ration. Purely
// a nicer-than-necessary upgrade — returns null (fall back to the free
// ration) whenever nothing fits, so hunger never fails to resolve. Requires
// a real feed shop to actually be constructed somewhere (see data/
// townGrid.ts's getAllShopPositions, Phase 12①) — same "silently skip until
// built" gating pickGearOffer already does for weapon/armor.
function pickFoodTreat(bird: BirdState, world: AiWorld): { itemId: ItemId; price: number } | null {
  if (!world.shopPositions.feed) return null;
  const shelf = world.shopStock.feed;
  const candidates = ITEM_DEFS.filter(
    (d) => d.category === 'food' && (shelf[d.id] ?? 0) > 0 && d.buyPrice <= bird.gold
  );
  if (candidates.length === 0) return null;
  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  return { itemId: pick.id, price: pick.buyPrice };
}

// Hungry → walk to the feed shop. If it can afford something on the shelf,
// it buys a real meal there (paid, contributes to shop revenue); otherwise
// it falls back to the basic ration, which is always free to produce (never
// touches the player's stock) — a broke bird still eats for free, hunger
// always resolves no matter how poor it is. That fallback is unchanged from
// before the feed shop existed.
function stepShopFood(bird: BirdState, world: AiWorld): AiStepOutcome {
  const outcome = emptyOutcome();
  if (bird.activity !== 'eating') {
    bird.workProgress = 0;
  }
  const shop = getShopPosition('feed');
  const arrived = moveToward(bird, shop.x, shop.y);
  bird.activity = 'eating';
  bird.targetKind = 'shop';
  bird.targetRefUid = null;
  if (arrived) {
    bird.workProgress += 1;
    if (bird.workProgress >= HOME_NEED_TICKS) {
      const treat = pickFoodTreat(bird, world);
      if (treat) {
        bird.gold -= treat.price;
        outcome.shopPurchase = { shopKind: 'feed', itemId: treat.itemId, amount: 1, totalCost: treat.price };
      } else if (bird.gold >= FOOD_PRICE) {
        bird.gold -= FOOD_PRICE;
        outcome.foodPurchase = FOOD_PRICE;
      }
      bird.satiety = STARTING_SATIETY;
      bird.mood = 'normal';
      bird.moodChangedAt = Date.now();
      bird.workProgress = 0;
      bird.targetKind = null;
    }
  }
  return outcome;
}

// A free-roaming bird that just finished gathering carries its haul back to
// its own house before the material becomes its personal property — so
// "what is this bird carrying right now" is a real, visible thing rather
// than resources teleporting into its stash the instant they're picked up.
function stepCarrying(bird: BirdState, world: AiWorld): AiStepOutcome {
  const outcome = emptyOutcome();
  const house = getHomePosition(world, bird.defId);
  const arrived = moveToward(bird, house.x, house.y);
  bird.activity = 'carrying';
  if (arrived && bird.carrying) {
    const { materialId, amount } = bird.carrying;
    const before = bird.inventory[materialId] ?? 0;
    addCappedInventory(bird.inventory, materialId, amount);
    const added = (bird.inventory[materialId] ?? 0) - before;
    // A full basket means literally none of it fit — skip the "brought
    // home" log line rather than reporting a confusing "0個持ち帰った".
    if (added > 0) outcome.deliveredMaterial = { materialId, amount: added };
    bird.carrying = null;
  }
  return outcome;
}

function hasSellableInventory(bird: BirdState): boolean {
  return Object.values(bird.inventory).some((amount) => (amount ?? 0) > 0);
}

// Whether the player could afford even a single unit of the bird's
// best-stocked material right now — used to gate *forcing* an overflow
// sell trip (see stepBird). Only checks unit price, not quantity: the
// point isn't to predict the exact sale size, just to avoid forcing a trip
// that's guaranteed to sell nothing at all.
function canAffordBestSale(bird: BirdState, playerGold: number): boolean {
  let bestId: MaterialId | null = null;
  let bestAmount = 0;
  for (const [key, amount] of Object.entries(bird.inventory) as [MaterialId, number][]) {
    if ((amount ?? 0) > bestAmount) {
      bestAmount = amount ?? 0;
      bestId = key;
    }
  }
  if (!bestId) return false;
  return MATERIAL_SELL_PRICE[bestId] <= playerGold;
}

// Picks the single most-plentiful material to offer this trip, not the
// whole stash at once — otherwise a well-stocked bird's asking price
// quickly outgrows what the player can ever afford, and trade freezes up
// entirely instead of trickling along a little at a time. `cap` is the
// casual SELL_MAX_PER_TRIP for an ordinary trip, or a much larger overflow
// target when the bird is over BIRD_INVENTORY_CAP (see executeSellTrip) —
// offering only a couple of units per trip while overflowing is exactly
// the real-device "sells 1-3 units forever and never unsticks" bug.
function pickSellOffer(bird: BirdState, cap: number): { materialId: MaterialId; amount: number } | null {
  let bestId: MaterialId | null = null;
  let bestAmount = 0;
  for (const [key, amount] of Object.entries(bird.inventory) as [MaterialId, number][]) {
    if ((amount ?? 0) > bestAmount) {
      bestAmount = amount ?? 0;
      bestId = key;
    }
  }
  if (!bestId) return null;
  return { materialId: bestId, amount: Math.min(bestAmount, cap) };
}

// A bird with something to sell (more likely while "wantsMoney") walks to
// the general shop and offers its best-stocked material — the store decides
// whether the player can actually afford to buy it. Whether this counts as
// an "overflow" sell (much larger caps, see config.ts's OVERFLOW_SELL_*) is
// decided right here at completion time, from the bird's actual inventory
// then — not from whatever triggered the trip — so it stays correct even if
// the bird's stock changed mid-trip.
function executeSellTrip(bird: BirdState): AiStepOutcome {
  const outcome = emptyOutcome();
  const shop = getShopPosition('general');
  const arrived = moveToward(bird, shop.x, shop.y);
  bird.activity = 'selling';
  if (arrived) {
    bird.workProgress += 1;
    if (bird.workProgress >= SELL_DWELL_TICKS) {
      // >= not > : with inventory gains hard-capped at BIRD_INVENTORY_CAP
      // (see addCappedInventory), a full bird normally sits at *exactly*
      // the cap rather than over it, so "excess" is usually 0 here, not
      // positive — still worth the larger caps below (bounded by
      // OVERFLOW_SELL_MARGIN) so this doesn't fall back to the tiny casual
      // per-trip caps every time a bird happens to be topped off.
      const excess = totalInventoryAmount(bird.inventory) - BIRD_INVENTORY_CAP;
      const overflow = excess >= 0;
      const cap = overflow ? Math.min(OVERFLOW_SELL_MAX_PER_TRIP, Math.max(excess, 0) + OVERFLOW_SELL_MARGIN) : SELL_MAX_PER_TRIP;
      const offer = pickSellOffer(bird, cap);
      if (offer) outcome.sellAttempt = { materialId: offer.materialId, amount: offer.amount, overflow };
      bird.targetKind = null;
      bird.workProgress = 0;
    }
  }
  return outcome;
}

// A bird missing any of its five equipment slots checks whichever shop
// carries that category, in slot priority order (weapon > head > body >
// hand > foot) — weapon/body ('armor' shop kind) only have a shelf (and a
// shopPositions entry) at all once the player's actually constructed one
// (see data/townGrid.ts's getAllShopPositions), so those categories are
// silently skipped until then. Owning one of a category is "enough" for
// now (no stacking/upgrading loop, no rarity preference), keeping this a
// one-time self-equip rather than something birds keep doing forever —
// candidates below span every rarity tier of that slot equally, so a bird
// might land a rare piece its very first purchase, same as before this
// pass's expansion just with more possible outcomes.
function pickGearOffer(bird: BirdState, world: AiWorld): { itemId: ItemId; price: number; shopKind: ShopKind } | null {
  for (const category of ['weapon', 'head', 'body', 'hand', 'foot'] as const) {
    if (bird.equipment[category]) continue;
    const shopKind = (Object.keys(SHOP_DEFS) as ShopKind[]).find((k) => SHOP_DEFS[k].categories.includes(category));
    if (!shopKind || !world.shopPositions[shopKind]) continue;
    const shelf = world.shopStock[shopKind];
    const candidates = ITEM_DEFS.filter(
      (d) => d.category === category && (shelf[d.id] ?? 0) > 0 && d.buyPrice <= bird.gold
    );
    if (candidates.length > 0) {
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      return { itemId: pick.id, price: pick.buyPrice, shopKind };
    }
  }
  return null;
}

// Walks to whichever shop pickGearOffer settled on and, once there, buys
// it. If stock/affordability (or the offer's shop itself) changed since the
// trip was committed to, the trip just concludes with nothing bought.
function executeGearShopTrip(bird: BirdState, world: AiWorld): AiStepOutcome {
  const outcome = emptyOutcome();
  const offer = pickGearOffer(bird, world);
  if (!offer) {
    bird.targetKind = null;
    bird.activity = 'idle';
    bird.workProgress = 0;
    return outcome;
  }
  const shop = world.shopPositions[offer.shopKind]!;
  const arrived = moveToward(bird, shop.x, shop.y);
  bird.activity = 'buyingGear';
  if (arrived) {
    bird.workProgress += 1;
    if (bird.workProgress >= SELL_DWELL_TICKS) {
      bird.gold -= offer.price;
      outcome.shopPurchase = { shopKind: offer.shopKind, itemId: offer.itemId, amount: 1, totalCost: offer.price };
      bird.targetKind = null;
      bird.workProgress = 0;
    }
  }
  return outcome;
}

function hasConvertibleItems(bird: BirdState): boolean {
  return CONVERTIBLE_ITEM_IDS.some((id) => (bird.items[id] ?? 0) > 0);
}

// Picks the single most-plentiful convertible item the bird is holding to
// offer the merchant this trip — same one-item-at-a-time shape as
// pickSellOffer, so a bird never empties its whole treasure stash in one go.
function pickMerchantSellOffer(bird: BirdState): { itemId: ItemId; amount: number } | null {
  let bestId: ItemId | null = null;
  let bestAmount = 0;
  for (const id of CONVERTIBLE_ITEM_IDS) {
    const amount = bird.items[id] ?? 0;
    if (amount > bestAmount) {
      bestAmount = amount;
      bestId = id;
    }
  }
  if (!bestId) return null;
  return { itemId: bestId, amount: bestAmount };
}

// A bird holding convertible treasure walks to the merchant's stall and
// sells off its best-stocked item — the store looks up the value and
// applies the 50/50 split (see MERCHANT_BUYBACK_SPLIT).
function executeMerchantSellTrip(bird: BirdState): AiStepOutcome {
  const outcome = emptyOutcome();
  const arrived = moveToward(bird, MERCHANT_SPOT.x, MERCHANT_SPOT.y);
  bird.activity = 'merchantSelling';
  if (arrived) {
    bird.workProgress += 1;
    if (bird.workProgress >= SELL_DWELL_TICKS) {
      const offer = pickMerchantSellOffer(bird);
      if (offer) outcome.merchantSellAttempt = offer;
      bird.targetKind = null;
      bird.workProgress = 0;
    }
  }
  return outcome;
}

// Picks one affordable, in-stock slot off the merchant's randomized shelf.
function pickMerchantBuyOffer(bird: BirdState, world: AiWorld): { itemId: ItemId; price: number } | null {
  if (!world.merchant) return null;
  const candidates = world.merchant.lineup.filter(
    (l) => l.amount > 0 && ITEM_DEF_MAP[l.itemId].buyPrice <= bird.gold
  );
  if (candidates.length === 0) return null;
  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  return { itemId: pick.itemId, price: ITEM_DEF_MAP[pick.itemId].buyPrice };
}

// Walks to the merchant's stall and, once there, buys whichever slot
// pickMerchantBuyOffer settled on. If the shelf/affordability changed since
// the trip was committed to (someone else bought the last one), the trip
// just concludes with nothing bought.
function executeMerchantBuyTrip(bird: BirdState, world: AiWorld): AiStepOutcome {
  const outcome = emptyOutcome();
  const arrived = moveToward(bird, MERCHANT_SPOT.x, MERCHANT_SPOT.y);
  bird.activity = 'merchantBuying';
  if (arrived) {
    bird.workProgress += 1;
    if (bird.workProgress >= SELL_DWELL_TICKS) {
      const offer = pickMerchantBuyOffer(bird, world);
      if (offer) {
        bird.gold -= offer.price;
        outcome.merchantBuyAttempt = { itemId: offer.itemId, amount: 1, totalCost: offer.price };
      }
      bird.targetKind = null;
      bird.workProgress = 0;
    }
  }
  return outcome;
}

// Any bird that rolls combat fights whichever enemy is nearest to it.
function executeCombat(bird: BirdState, def: CharacterDef, world: AiWorld): AiStepOutcome {
  const outcome = emptyOutcome();
  const aliveEnemies = world.enemies.filter((e) => !e.defeated && e.hp > 0);

  if (!bird.targetRefUid || !aliveEnemies.some((e) => e.uid === bird.targetRefUid)) {
    const target = nearest(aliveEnemies, bird.x, bird.y);
    if (!target) {
      bird.targetKind = null;
      return outcome;
    }
    bird.targetKind = 'enemy';
    bird.targetRefUid = target.uid;
  }

  const enemy = aliveEnemies.find((e) => e.uid === bird.targetRefUid)!;
  const arrived = moveToward(bird, enemy.x, enemy.y);
  bird.activity = 'enemy';
  if (arrived) {
    outcome.assignments.push({
      unitUid: bird.defId,
      enemyUid: enemy.uid,
      damage: getEffectiveStats(bird).atk,
      materialBonusPercent: def.materialBonusPercent ?? 0,
    });
  }
  return outcome;
}

// Any bird that rolls mining gathers whichever rock/treasure is nearest.
function executeGather(bird: BirdState, def: CharacterDef, world: AiWorld): AiStepOutcome {
  const outcome = emptyOutcome();
  const uncollectedMining = world.miningNodes.filter((m) => !m.collected);
  const uncollectedTreasure = world.treasures.filter((t) => !t.collected);

  const stillValid =
    (bird.targetKind === 'mining' && uncollectedMining.some((m) => m.uid === bird.targetRefUid)) ||
    (bird.targetKind === 'treasure' && uncollectedTreasure.some((t) => t.uid === bird.targetRefUid));

  if (!stillValid) {
    const nearestMining = nearest(uncollectedMining, bird.x, bird.y);
    const nearestTreasure = nearest(uncollectedTreasure, bird.x, bird.y);
    const miningDist = nearestMining ? Math.hypot(nearestMining.x - bird.x, nearestMining.y - bird.y) : Infinity;
    const treasureDist = nearestTreasure ? Math.hypot(nearestTreasure.x - bird.x, nearestTreasure.y - bird.y) : Infinity;

    if (miningDist === Infinity && treasureDist === Infinity) {
      bird.targetKind = null;
      return outcome;
    } else if (miningDist <= treasureDist) {
      bird.targetKind = 'mining';
      bird.targetRefUid = nearestMining!.uid;
    } else {
      bird.targetKind = 'treasure';
      bird.targetRefUid = nearestTreasure!.uid;
    }
    bird.workProgress = 0;
  }

  if (bird.targetKind === 'mining' && bird.targetRefUid) {
    const node = uncollectedMining.find((m) => m.uid === bird.targetRefUid);
    if (node) {
      const arrived = moveToward(bird, node.x, node.y);
      bird.activity = 'mining';
      if (arrived) {
        bird.workProgress += 1;
        if (bird.workProgress >= ENCOUNTER_HOLD_TICKS) {
          bird.carrying = { materialId: node.resource, amount: node.amount };
          outcome.miningCollectedUid = node.uid;
          // A few precious nodes have a low-chance bonus roll on top of the
          // guaranteed resource — credited straight to the bird (unlike the
          // main haul, it doesn't need carrying home) since it's a rare
          // windfall, not the point of the trip.
          for (const entry of node.bonusDropTable ?? []) {
            if (Math.random() >= entry.chance) continue;
            if (entry.kind === 'item') {
              // Bonus-table items are convertible treasure today, not
              // equip-category gear, so this never actually hits the
              // equip spare cap — routed through the same capped helper as
              // combat drops anyway, so that stays true if the data ever
              // changes rather than relying on it staying that way.
              addItemCapped(bird, entry.itemId, 1);
              maybeAutoEquip(bird, entry.itemId);
              outcome.bonusItemFound = entry.itemId;
            } else {
              addCappedInventory(bird.inventory, entry.materialId, entry.amount);
            }
            break;
          }
          bird.targetKind = null;
          bird.targetRefUid = null;
          bird.workProgress = 0;
        }
      }
      return outcome;
    }
  }

  if (bird.targetKind === 'treasure' && bird.targetRefUid) {
    const treasure = uncollectedTreasure.find((t) => t.uid === bird.targetRefUid);
    if (treasure) {
      const arrived = moveToward(bird, treasure.x, treasure.y);
      bird.activity = 'treasure';
      if (arrived) {
        bird.workProgress += 1;
        if (bird.workProgress >= ENCOUNTER_HOLD_TICKS) {
          bird.gold += treasure.goldReward;
          outcome.treasureCollectedUid = treasure.uid;
          bird.targetKind = null;
          bird.targetRefUid = null;
          bird.workProgress = 0;
        }
      }
      return outcome;
    }
  }

  return outcome;
}

// Explore: head to a random spot out in the field. Each leg concludes on
// arrival (clearing targetKind) so the bird reconsiders its next move
// fresh, rather than wandering forever once picked.
function executeExplore(bird: BirdState, world: AiWorld): AiStepOutcome {
  const hasDest = bird.wanderX !== null && bird.wanderY !== null;
  if (!hasDest) {
    const dest = randomPointInField(world.townZoneRadius);
    bird.wanderX = dest.x;
    bird.wanderY = dest.y;
    bird.targetKind = 'explore';
    bird.activity = 'idle';
    return emptyOutcome();
  }
  const arrived = moveToward(bird, bird.wanderX!, bird.wanderY!);
  bird.activity = 'idle';
  if (arrived) {
    bird.targetKind = null;
    bird.wanderX = null;
    bird.wanderY = null;
  }
  return emptyOutcome();
}

// Rest: either relax at a river/pond for a while, or just mill around near
// town — either way it's a deliberate choice, not a fallback.
function executeRest(bird: BirdState, world: AiWorld): AiStepOutcome {
  if (bird.targetKind === 'river' || bird.targetKind === 'pond') {
    const spot = world.leisureSpots.find((s) => s.uid === bird.targetRefUid);
    if (!spot) {
      bird.targetKind = null;
      return emptyOutcome();
    }
    const arrived = moveToward(bird, spot.x, spot.y);
    bird.activity = spot.kind === 'river' ? 'bathing' : 'fishing';
    if (arrived) {
      bird.workProgress += 1;
      if (bird.workProgress >= LEISURE_DWELL_TICKS) {
        bird.targetKind = null;
        bird.targetRefUid = null;
        bird.workProgress = 0;
      }
    }
    return emptyOutcome();
  }

  if (bird.targetKind === 'rest') {
    const hasDest = bird.wanderX !== null && bird.wanderY !== null;
    const arrived = hasDest ? moveToward(bird, bird.wanderX!, bird.wanderY!) : true;
    bird.activity = 'idle';
    if (!hasDest || arrived) {
      bird.targetKind = null;
      bird.wanderX = null;
      bird.wanderY = null;
    }
    return emptyOutcome();
  }

  if (bird.targetKind === 'nap') {
    return executeNap(bird, world);
  }

  // Fresh decision: a nap at home, a leisure spot, or just a stroll near
  // town. Checked first (see NAP_GOOD_MOOD_THRESHOLD) so a comfortable bird
  // reliably gets a shot at the calmer option instead of it always losing
  // out to LEISURE_CHANCE's fairly high roll.
  const goodMood = bird.happiness >= NAP_GOOD_MOOD_THRESHOLD && bird.satiety >= NAP_GOOD_MOOD_THRESHOLD;
  if (Math.random() < (goodMood ? NAP_CHANCE_GOOD_MOOD : NAP_CHANCE_BASE)) {
    bird.targetKind = 'nap';
    bird.targetRefUid = null;
    bird.workProgress = 0;
    return executeNap(bird, world);
  }
  if (world.leisureSpots.length > 0 && Math.random() < LEISURE_CHANCE) {
    const spot = nearest(world.leisureSpots, bird.x, bird.y);
    if (spot) {
      bird.targetKind = spot.kind;
      bird.targetRefUid = spot.uid;
      bird.workProgress = 0;
      bird.activity = spot.kind === 'river' ? 'bathing' : 'fishing';
      return emptyOutcome();
    }
  }
  const dest = randomPointNearTown(world.townZoneRadius, world.occupiedSpots);
  bird.wanderX = dest.x;
  bird.wanderY = dest.y;
  bird.targetKind = 'rest';
  bird.activity = 'idle';
  return emptyOutcome();
}

// A little detour — real-device request: "寄り道する(例えば街をぶらぶら歩く、
// 花を眺めるなど)". The first version walked to a random nearby point, but
// since that point always sat well within a single tick's MOVE_SPEED, the
// whole thing resolved in 1-2 ticks — too fast to actually notice among 4
// independently-moving birds (a second real-device report). Rather than
// walk anywhere, the bird just stops in place for DETOUR_DWELL_TICKS ticks
// with the strolling badge up — a real, visible pause instead of a blink-
// and-miss-it teleport. Entered only from stepBird's fresh-decision point
// (see detourChance), never as a mid-pursuit interrupt, so it can't stall
// out a job/combat/mining pursuit already underway.
function executeDetour(bird: BirdState): AiStepOutcome {
  const outcome = emptyOutcome();
  bird.activity = 'strolling';
  bird.workProgress += 1;
  if (bird.workProgress === 1) outcome.detourStarted = true;
  if (bird.workProgress >= DETOUR_DWELL_TICKS) {
    bird.targetKind = null;
    bird.workProgress = 0;
  }
  return outcome;
}

// A longer, discretionary at-home rest — real-device request: birds looked
// restless with nothing but short activities in between errands. Unlike
// stepHomeNeed's forced "sleepy mood" homing, this is just one of rest's own
// sub-choices (see executeRest), picked more often when the bird is already
// comfortable (see NAP_GOOD_MOOD_THRESHOLD) rather than only when actually
// tired. Dwells far longer than any other rest sub-behavior (NAP_DWELL_TICKS)
// so it reads as an actual pause in the pace, not another quick errand.
function executeNap(bird: BirdState, world: AiWorld): AiStepOutcome {
  const outcome = emptyOutcome();
  const house = getHomePosition(world, bird.defId);
  const arrived = moveToward(bird, house.x, house.y);
  bird.activity = 'napping';
  if (arrived) {
    bird.workProgress += 1;
    if (bird.workProgress === 1) outcome.startedNapping = true;
    if (bird.workProgress >= NAP_DWELL_TICKS) {
      bird.targetKind = null;
      bird.workProgress = 0;
    }
  }
  return outcome;
}

// A permanent, small stat bump — one of five candidates picked uniformly.
// maxHp bumps current hp along with it (same shape as grantExp's level-up
// gains in useWorldStore), the other four are flat +1 (or +2 for luck, see
// data/skills.ts's own luck-skill note) additions to the bird's base stat.
function applyStatInspiration(bird: BirdState): InspirationStat {
  const stats: InspirationStat[] = ['atk', 'defense', 'speed', 'luck', 'maxHp'];
  const stat = stats[Math.floor(Math.random() * stats.length)];
  if (stat === 'maxHp') {
    bird.maxHp += INSPIRATION_HP_GAIN;
    bird.hp += INSPIRATION_HP_GAIN;
  } else {
    bird[stat] += INSPIRATION_STAT_GAIN;
  }
  return stat;
}

// Playing at a park/bathhouse — the destination for Phase 11's "遊ぶ"
// behavior. Same one-leg-then-dwell shape as executeRest's leisure-spot
// branch. Each tick spent actually playing independently rolls for a rare
// permanent skill (checked first, since it's the rarer of the two) or a
// small stat bump — see config.ts's INSPIRATION_* constants.
function executePlay(bird: BirdState, world: AiWorld): AiStepOutcome {
  const outcome = emptyOutcome();
  const stillValid = bird.targetKind === 'play' && world.amenityPositions.some((a) => a.id === bird.targetRefUid);
  if (!stillValid) {
    const spot = nearest(world.amenityPositions, bird.x, bird.y);
    if (!spot) {
      bird.targetKind = null;
      return outcome;
    }
    bird.targetKind = 'play';
    bird.targetRefUid = spot.id;
    bird.workProgress = 0;
  }
  const spot = world.amenityPositions.find((a) => a.id === bird.targetRefUid);
  if (!spot) return outcome;

  const arrived = moveToward(bird, spot.x, spot.y);
  bird.activity = 'playing';
  if (arrived) {
    bird.workProgress += 1;
    if (bird.workProgress === 1) outcome.startedPlaying = spot.kind;

    if (Math.random() < INSPIRATION_SKILL_CHANCE) {
      const owned = new Set(bird.skills);
      const candidates = BIRD_SKILL_DEFS.filter((s) => !owned.has(s.id));
      if (candidates.length > 0) {
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        bird.skills = [...bird.skills, pick.id];
        outcome.inspiration = { kind: 'skill', skillId: pick.id };
      }
    } else if (Math.random() < INSPIRATION_STAT_CHANCE) {
      const stat = applyStatInspiration(bird);
      // A lightweight "💡" speech bubble — reuses the same ephemeral chat-
      // bubble field the ambient bird-to-bird chat event uses (see
      // useWorldStore's tick), since both are just cosmetic flavor.
      bird.chatLine = '💡ひらめいた!';
      bird.chatLineSetAt = Date.now();
      outcome.inspiration = { kind: 'stat', stat, amount: stat === 'maxHp' ? INSPIRATION_HP_GAIN : INSPIRATION_STAT_GAIN };
    }

    if (bird.workProgress >= PLAY_DWELL_TICKS) {
      bird.targetKind = null;
      bird.targetRefUid = null;
      bird.workProgress = 0;
    }
  }
  return outcome;
}

// Any bird with an accepted job pursues it — this overrides normal category
// selection until the job concludes. Only 'gather' and 'hunt' jobs ever end
// up here (see useWorldStore's acceptance loop): 'craft'/'merchantDeliver'
// jobs are player actions, so an accepting bird for those never gets
// currentJobId set at all and just keeps acting normally.
//
// A job is a 3-leg errand tracked by bird.jobStage, not just an instant
// status flip (real-device request): 'toAccept' walks to the town hall
// before any work starts, 'working' is the actual gather/hunt pursuit
// (unchanged below), and 'toDeliver' walks back to the town hall once the
// quota's met — only then does the reward/exp/log actually land (see
// useWorldStore's outcome.jobCompletedId handling and the hunt-completion
// branch of its kills loop, both of which now just flip jobStage to
// 'toDeliver' instead of granting anything immediately).
function stepJob(bird: BirdState, def: CharacterDef, world: AiWorld): AiStepOutcome {
  const outcome = emptyOutcome();
  const request = world.requests.find((r) => r.id === bird.currentJobId);
  if (!request || request.status !== 'inProgress') {
    bird.currentJobId = null;
    bird.targetKind = null;
    bird.targetRefUid = null;
    bird.jobStage = null;
    return outcome;
  }

  if (bird.jobStage === 'toAccept' || bird.jobStage === null) {
    bird.targetKind = 'townHall';
    bird.targetRefUid = null;
    bird.activity = 'idle';
    if (moveToward(bird, TOWN_X, TOWN_Y)) {
      bird.jobStage = 'working';
      bird.targetKind = null;
    }
    return outcome;
  }

  if (bird.jobStage === 'toDeliver') {
    bird.targetKind = 'townHall';
    bird.targetRefUid = null;
    bird.activity = 'idle';
    if (moveToward(bird, TOWN_X, TOWN_Y)) {
      outcome.jobCompletedId = request.id;
      bird.currentJobId = null;
      bird.jobStage = null;
      bird.targetKind = null;
    }
    return outcome;
  }

  if (request.kind === 'hunt') {
    return stepHuntJob(bird, def, world, request.enemyName!);
  }

  // Gather, jobStage === 'working': use whatever the bird's already
  // personally carrying first — a real-device request, since a bird
  // sitting on a big personal stash of a material shouldn't have to fetch
  // 5 more of it from a field node before the job counts it. Only travels
  // to a node if the bird's own stock isn't already enough by itself.
  const materialId = request.materialId!;
  const owned = bird.inventory[materialId] ?? 0;
  if (owned > 0 && request.delivered < request.amount) {
    const used = Math.min(owned, request.amount - request.delivered);
    bird.inventory[materialId] = owned - used;
    request.delivered += used;
  }
  if (request.delivered >= request.amount) {
    bird.jobStage = 'toDeliver';
    return outcome;
  }

  const matching = world.miningNodes.filter((m) => !m.collected && m.resource === request.materialId);
  const stillValid = bird.targetKind === 'mining' && matching.some((m) => m.uid === bird.targetRefUid);
  if (!stillValid) {
    const node = nearest(matching, bird.x, bird.y);
    if (!node) {
      // Nothing available right now — hang around town and keep the job.
      const hasDest = bird.wanderX !== null && bird.wanderY !== null;
      const arrived = hasDest ? moveToward(bird, bird.wanderX!, bird.wanderY!) : true;
      if (!hasDest || arrived) {
        const dest = randomPointNearTown(world.townZoneRadius, world.occupiedSpots);
        bird.wanderX = dest.x;
        bird.wanderY = dest.y;
      }
      bird.activity = 'idle';
      return outcome;
    }
    bird.targetKind = 'mining';
    bird.targetRefUid = node.uid;
    bird.workProgress = 0;
  }

  const node = matching.find((m) => m.uid === bird.targetRefUid);
  if (!node) return outcome;

  const arrived = moveToward(bird, node.x, node.y);
  bird.activity = 'mining';
  if (arrived) {
    bird.workProgress += 1;
    if (bird.workProgress >= ENCOUNTER_HOLD_TICKS) {
      outcome.materialsCollected[node.resource] = (outcome.materialsCollected[node.resource] ?? 0) + node.amount;
      outcome.miningCollectedUid = node.uid;
      // Progress accumulates across trips (mutated on the shared request
      // object, same as status/acceptedBy elsewhere) rather than always
      // completing after a single gather — harmless today since every
      // preset's amount fits in one node's yield, but correct if that ever
      // changes (a request needing more than one node's worth used to
      // complete instantly after the first delivery regardless of amount).
      request.delivered += node.amount;
      bird.targetKind = null;
      bird.targetRefUid = null;
      bird.workProgress = 0;
      if (request.delivered >= request.amount) {
        bird.jobStage = 'toDeliver';
      }
    }
  }
  return outcome;
}

// A 'hunt' job's bird actively seeks out the specific enemy species by name
// (enemies share a name across their several map spawns) instead of just
// fighting whatever's nearest, same shape as stepJob's gather pursuit. Only
// pushes the attack assignment — the kill itself resolves later in the same
// tick (see combat.ts's resolveAttacks), and useWorldStore's kills loop is
// what actually counts progress/completes the job and clears currentJobId,
// since a single kill can finish off a job even mid-tick relative to this
// function's own bookkeeping.
function stepHuntJob(bird: BirdState, def: CharacterDef, world: AiWorld, enemyName: string): AiStepOutcome {
  const outcome = emptyOutcome();
  const matching = world.enemies.filter((e) => !e.defeated && e.hp > 0 && e.name === enemyName);
  const stillValid = bird.targetKind === 'enemy' && matching.some((e) => e.uid === bird.targetRefUid);
  if (!stillValid) {
    const target = nearest(matching, bird.x, bird.y);
    if (!target) {
      // None of that species alive right now — hang around town and keep
      // the job, same fallback as gather's "nothing available" case.
      const hasDest = bird.wanderX !== null && bird.wanderY !== null;
      const arrived = hasDest ? moveToward(bird, bird.wanderX!, bird.wanderY!) : true;
      if (!hasDest || arrived) {
        const dest = randomPointNearTown(world.townZoneRadius, world.occupiedSpots);
        bird.wanderX = dest.x;
        bird.wanderY = dest.y;
      }
      bird.activity = 'idle';
      return outcome;
    }
    bird.targetKind = 'enemy';
    bird.targetRefUid = target.uid;
  }

  const enemy = matching.find((e) => e.uid === bird.targetRefUid);
  if (!enemy) return outcome;

  const arrived = moveToward(bird, enemy.x, enemy.y);
  bird.activity = 'enemy';
  if (arrived) {
    outcome.assignments.push({
      unitUid: bird.defId,
      enemyUid: enemy.uid,
      damage: getEffectiveStats(bird).atk,
      materialBonusPercent: def.materialBonusPercent ?? 0,
    });
  }
  return outcome;
}

// Gently pushes any two birds that ended up too close apart, so several
// independently-acting birds never visually stack on top of each other
// (e.g. when more than one heads for the same enemy or resource).
export function separateBirds(birds: BirdState[]): BirdState[] {
  const next = birds.map((b) => ({ ...b }));
  for (let i = 0; i < next.length; i++) {
    for (let j = i + 1; j < next.length; j++) {
      const a = next[i];
      const b = next[j];
      if (a.hp <= 0 || b.hp <= 0) continue; // a bird heading home to recover isn't jostled by this
      if (!a.isRecruited || !b.isRecruited) continue; // dormant birds don't interact with anyone

      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      if (dist >= MIN_BIRD_DISTANCE) continue;

      const angle = dist > 0.0001 ? Math.atan2(dy, dx) : Math.random() * Math.PI * 2;
      const push = (MIN_BIRD_DISTANCE - dist) / 2;
      a.x -= Math.cos(angle) * push;
      a.y -= Math.sin(angle) * push;
      b.x += Math.cos(angle) * push;
      b.y += Math.sin(angle) * push;
    }
  }
  for (const b of next) {
    b.x = Math.min(0.95, Math.max(0.05, b.x));
    b.y = Math.min(0.92, Math.max(0.08, b.y));
  }
  return next;
}
