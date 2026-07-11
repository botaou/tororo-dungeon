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
  ENCOUNTER_HOLD_TICKS,
  FOOD_PRICE,
  GEAR_SHOP_CHECK_CHANCE,
  HOME_NEED_TICKS,
  LEISURE_CHANCE,
  LEISURE_DWELL_TICKS,
  MERCHANT_BUY_CHECK_CHANCE,
  MERCHANT_SELL_CHECK_CHANCE,
  MIN_BIRD_DISTANCE,
  MOVE_SPEED,
  SELL_CHECK_CHANCE_BASE,
  SELL_CHECK_CHANCE_WANTS_MONEY,
  SELL_DWELL_TICKS,
  SELL_MAX_PER_TRIP,
  STARTING_SATIETY,
} from './config';
import { TOWN_RADIUS, TOWN_X, TOWN_Y } from '../data/world';
import { getHousePosition } from '../data/houses';
import { getShopPosition, MERCHANT_SPOT } from '../data/townGrid';
import { CONVERTIBLE_ITEM_IDS, ITEM_DEF_MAP, ITEM_DEFS } from '../data/items';
import { getEffectiveStats, maybeAutoEquip } from './birdStats';
import { AttackAssignment } from './combat';

// A fainted bird (hp hit 0) rests in place and slowly recovers before
// resuming any activity, rather than vanishing or teleporting home.
const FAINT_RECOVERY_PER_TICK = 5;

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
  dangerAversion: number; // 0 = fearless, 1 = avoids anything but the weakest foe
}

const PERSONALITY_PROFILES: Record<Personality, PersonalityProfile> = {
  vanguard: { combat: 0.55, explore: 0.3, mining: 0.1, rest: 0.05, dangerAversion: 0 },
  freeSpirit: { combat: 0.2, explore: 0.2, mining: 0.55, rest: 0.05, dangerAversion: 0.35 },
  clingy: { combat: 0.25, explore: 0.2, mining: 0.15, rest: 0.4, dangerAversion: 0.5 },
  cautious: { combat: 0.3, explore: 0.15, mining: 0.1, rest: 0.45, dangerAversion: 0.85 },
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

function randomPointInField(): { x: number; y: number } {
  for (let attempt = 0; attempt < 8; attempt++) {
    const x = 0.1 + Math.random() * 0.8;
    const y = 0.15 + Math.random() * 0.7;
    if (Math.hypot(x - TOWN_X, y - TOWN_Y) > TOWN_RADIUS * 1.2) return { x, y };
  }
  return { x: 0.15, y: 0.2 };
}

function randomPointNearTown(radius: number): { x: number; y: number } {
  const angle = Math.random() * Math.PI * 2;
  const dist = Math.random() * radius;
  return {
    x: Math.min(0.92, Math.max(0.08, TOWN_X + Math.cos(angle) * dist)),
    y: Math.min(0.88, Math.max(0.16, TOWN_Y + Math.sin(angle) * dist)),
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
  // The visiting merchant, if one currently has its stall set up — null
  // between visits. Read-only from the AI's perspective, same as shopStock.
  merchant: MerchantState | null;
}

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
  sellAttempt: Partial<Record<MaterialId, number>> | null;
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
      return 'rest';
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

  let combatWeight = 0;
  if (nearestEnemy) {
    const danger = Math.min(1, nearestEnemy.atk / DANGER_ATK_REFERENCE);
    combatWeight = Math.max(0, profile.combat * (1 - profile.dangerAversion * danger));
  }
  const miningWeight = hasGatherable ? profile.mining : 0;
  const exploreWeight = profile.explore;
  const restWeight = profile.rest;

  const total = combatWeight + miningWeight + exploreWeight + restWeight;
  let roll = Math.random() * total;
  if ((roll -= combatWeight) < 0) return 'combat';
  if ((roll -= miningWeight) < 0) return 'mining';
  if ((roll -= exploreWeight) < 0) return 'explore';
  return 'rest';
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
  }
}

export function stepBird(bird: BirdState, def: CharacterDef, world: AiWorld): AiStepOutcome {
  if (bird.hp <= 0) {
    bird.hp = Math.min(bird.maxHp, bird.hp + FAINT_RECOVERY_PER_TICK);
    bird.activity = 'resting';
    bird.targetKind = null;
    bird.targetRefUid = null;
    return emptyOutcome();
  }

  if (bird.currentJobId) {
    return stepJob(bird, def, world);
  }

  if (bird.carrying) {
    return stepCarrying(bird);
  }

  if (bird.mood === 'hungry') {
    return stepShopFood(bird, world);
  }
  if (bird.mood === 'sleepy') {
    return stepHomeNeed(bird, 'resting');
  }

  // Continue an already-committed selling trip, or roll to start a new one.
  if (bird.targetKind === 'shop' && bird.activity === 'selling') {
    return executeSellTrip(bird);
  }
  if (hasSellableInventory(bird)) {
    const chance = bird.mood === 'wantsMoney' ? SELL_CHECK_CHANCE_WANTS_MONEY : SELL_CHECK_CHANCE_BASE;
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

  let category = categoryOf(bird.targetKind);
  if (!category || !isStillPursuing(bird, category, world)) {
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
      return executeExplore(bird);
    case 'rest':
      return executeRest(bird, world);
  }
}

// Sleepy → go home and rest. Once satisfied for HOME_NEED_TICKS the mood
// clears back to normal instead of waiting on the ambient refresh timer.
// "Home" is the bird's own house.
function stepHomeNeed(bird: BirdState, activity: 'resting'): AiStepOutcome {
  if (bird.activity !== activity) {
    bird.workProgress = 0;
  }
  const house = getHousePosition(bird.defId);
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

// Picks an affordable, in-stock food item at the feed shop for a hungry
// bird to treat itself to, instead of the always-free basic ration. Purely
// a nicer-than-necessary upgrade — returns null (fall back to the free
// ration) whenever nothing fits, so hunger never fails to resolve.
function pickFoodTreat(bird: BirdState, world: AiWorld): { itemId: ItemId; price: number } | null {
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
function stepCarrying(bird: BirdState): AiStepOutcome {
  const outcome = emptyOutcome();
  const house = getHousePosition(bird.defId);
  const arrived = moveToward(bird, house.x, house.y);
  bird.activity = 'carrying';
  if (arrived && bird.carrying) {
    const { materialId, amount } = bird.carrying;
    bird.inventory[materialId] = (bird.inventory[materialId] ?? 0) + amount;
    outcome.deliveredMaterial = { materialId, amount };
    bird.carrying = null;
  }
  return outcome;
}

function hasSellableInventory(bird: BirdState): boolean {
  return Object.values(bird.inventory).some((amount) => (amount ?? 0) > 0);
}

// Picks the single most-plentiful material to offer this trip (capped), not
// the whole stash at once — otherwise a well-stocked bird's asking price
// quickly outgrows what the player can ever afford, and trade freezes up
// entirely instead of trickling along a little at a time.
function pickSellOffer(bird: BirdState): { materialId: MaterialId; amount: number } | null {
  let bestId: MaterialId | null = null;
  let bestAmount = 0;
  for (const [key, amount] of Object.entries(bird.inventory) as [MaterialId, number][]) {
    if ((amount ?? 0) > bestAmount) {
      bestAmount = amount ?? 0;
      bestId = key;
    }
  }
  if (!bestId) return null;
  return { materialId: bestId, amount: Math.min(bestAmount, SELL_MAX_PER_TRIP) };
}

// A bird with something to sell (more likely while "wantsMoney") walks to
// the general shop and offers its best-stocked material — the store decides
// whether the player can actually afford to buy it.
function executeSellTrip(bird: BirdState): AiStepOutcome {
  const outcome = emptyOutcome();
  const shop = getShopPosition('general');
  const arrived = moveToward(bird, shop.x, shop.y);
  bird.activity = 'selling';
  if (arrived) {
    bird.workProgress += 1;
    if (bird.workProgress >= SELL_DWELL_TICKS) {
      const offer = pickSellOffer(bird);
      if (offer) outcome.sellAttempt = { [offer.materialId]: offer.amount };
      bird.targetKind = null;
      bird.workProgress = 0;
    }
  }
  return outcome;
}

// A bird missing any of its four equipment slots checks the general shop's
// shelf, in slot priority order (weapon > armor > hat > shield). Owning one
// of a category is "enough" for now (no stacking/upgrading loop), keeping
// this a one-time self-equip rather than something birds keep doing forever.
function pickGearOffer(bird: BirdState, world: AiWorld): { itemId: ItemId; price: number } | null {
  const shelf = world.shopStock.general;
  for (const category of ['weapon', 'armor', 'hat', 'shield'] as const) {
    if (bird.equipment[category]) continue;
    const candidates = ITEM_DEFS.filter(
      (d) => d.category === category && (shelf[d.id] ?? 0) > 0 && d.buyPrice <= bird.gold
    );
    if (candidates.length > 0) {
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      return { itemId: pick.id, price: pick.buyPrice };
    }
  }
  return null;
}

// Walks to the general shop and, once there, buys whichever weapon/armor
// pickGearOffer settled on. If stock/affordability changed since the trip
// was committed to, the trip just concludes with nothing bought.
function executeGearShopTrip(bird: BirdState, world: AiWorld): AiStepOutcome {
  const outcome = emptyOutcome();
  const shop = getShopPosition('general');
  const arrived = moveToward(bird, shop.x, shop.y);
  bird.activity = 'buyingGear';
  if (arrived) {
    bird.workProgress += 1;
    if (bird.workProgress >= SELL_DWELL_TICKS) {
      const offer = pickGearOffer(bird, world);
      if (offer) {
        bird.gold -= offer.price;
        outcome.shopPurchase = { shopKind: 'general', itemId: offer.itemId, amount: 1, totalCost: offer.price };
      }
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
              bird.items[entry.itemId] = (bird.items[entry.itemId] ?? 0) + 1;
              maybeAutoEquip(bird, entry.itemId);
              outcome.bonusItemFound = entry.itemId;
            } else {
              bird.inventory[entry.materialId] = (bird.inventory[entry.materialId] ?? 0) + entry.amount;
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
function executeExplore(bird: BirdState): AiStepOutcome {
  const hasDest = bird.wanderX !== null && bird.wanderY !== null;
  if (!hasDest) {
    const dest = randomPointInField();
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

  // Fresh decision: leisure spot or just a stroll near town.
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
  const dest = randomPointNearTown(TOWN_RADIUS * 1.6);
  bird.wanderX = dest.x;
  bird.wanderY = dest.y;
  bird.targetKind = 'rest';
  bird.activity = 'idle';
  return emptyOutcome();
}

// Any bird with an accepted job heads for the nearest unclaimed node of the
// requested material, delivers it, and collects the bounty on completion —
// this overrides normal category selection until the job concludes.
function stepJob(bird: BirdState, def: CharacterDef, world: AiWorld): AiStepOutcome {
  const outcome = emptyOutcome();
  const request = world.requests.find((r) => r.id === bird.currentJobId);
  if (!request || request.status !== 'inProgress') {
    bird.currentJobId = null;
    bird.targetKind = null;
    bird.targetRefUid = null;
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
        const dest = randomPointNearTown(TOWN_RADIUS * 1.6);
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
      outcome.jobCompletedId = request.id;
      bird.gold += request.reward; // the player pays this out in the store
      bird.currentJobId = null;
      bird.targetKind = null;
      bird.targetRefUid = null;
      bird.workProgress = 0;
    }
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
      if (a.hp <= 0 || b.hp <= 0) continue; // fainted birds stay put
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
