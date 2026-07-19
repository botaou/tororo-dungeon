import { create } from 'zustand';

import {
  ActivityLogEntry,
  BirdState,
  CosmeticSource,
  EnemyInstance,
  ItemId,
  JobRequest,
  LeisureSpotInstance,
  MaterialId,
  MerchantLineupEntry,
  MerchantState,
  MiningNodeInstance,
  RecipeSource,
  TreasureNodeInstance,
  WorldState,
} from '../types';
import { CHARACTERS, getCharacterDef } from '../data/characters';
import {
  ENEMY_DEFS,
  LEISURE_SPOT_DEFS,
  MINING_NODE_DEFS,
  TOWN_RADIUS,
  TOWN_X,
  TOWN_Y,
  TREASURE_DEFS,
} from '../data/world';
import { rollRandomMood } from '../data/moods';
import { AiWorld, InspirationStat, separateBirds, stepBird } from '../game/ai';
import { addCappedInventory, addItemCapped } from '../game/inventoryCap';
import { BIRD_SKILL_DEF_MAP } from '../data/skills';
import { CHAT_LINES } from '../game/thoughts';
import { respawnPosition, stepEnemy } from '../game/enemyAi';
import { AttackAssignment, applyHealing, resolveAttacks } from '../game/combat';
import { scoreRequestAcceptance, tryAcceptRequest } from '../game/requests';
import {
  checkHaku,
  checkMoneEncounter,
  checkTororoEncounter,
  checkVivi,
  HAKU_QUEST_ID,
  MONE_WOLF_KILL_MILESTONE_ID,
  WOLF_ENEMY_NAME,
} from '../game/recruitment';
import { getEffectiveStats, maybeAutoEquip } from '../game/birdStats';
import { useCosmeticStore } from './useCosmeticStore';
import { MATERIAL_LABEL } from '../data/materials';
import { describeJobTarget, JOB_KIND_UNIT_LABEL, JobPreset } from '../data/jobPresets';
import {
  CONVERTIBLE_ITEM_IDS,
  ITEM_DEF_MAP,
  MERCHANT_COMMON_ITEM_IDS,
  MERCHANT_RARE_ITEM_IDS,
  RESTOCKED_ITEM_IDS,
} from '../data/items';
import { MATERIAL_SELL_PRICE } from '../data/marketPrices';
import {
  ACTIVITY_LOG_MAX,
  CHAT_CHANCE_BASE,
  CHAT_CHANCE_LOW_MOOD_BONUS,
  CHAT_PAUSE_TICKS,
  CHAT_PROXIMITY_DIST,
  ENEMY_RESPAWN_MS,
  expToNextLevel,
  FEED_RESTOCK_CHECK_CHANCE,
  FEED_RESTOCK_TARGET,
  HAPPINESS_LOW_THRESHOLD,
  LEVEL_UP_ATK_GAIN,
  LEVEL_UP_DEFENSE_GAIN,
  LEVEL_UP_HP_GAIN,
  LEVEL_UP_SPEED_GAIN,
  MAX_ACTIVE_REQUESTS,
  MERCHANT_ARRIVAL_CHECK_CHANCE,
  MERCHANT_BUYBACK_SPLIT,
  MERCHANT_ITEM_STOCK_MAX,
  MERCHANT_ITEM_STOCK_MIN,
  MERCHANT_LINEUP_SIZE,
  MERCHANT_RARE_CHANCE,
  MERCHANT_RECIPE_OFFER_CHANCE,
  MERCHANT_VISIT_DURATION_MAX_MS,
  MERCHANT_VISIT_DURATION_MIN_MS,
  MINING_RESPAWN_MS,
  HOUSE_FOOD_CAP,
  HOUSE_TREASURE_CAP,
  MOOD_REFRESH_MS,
  OVERFLOW_SELL_MAX_GOLD_PER_TRIP,
  COSMETIC_DROP_CHANCE,
  COSMETIC_FIND_CHANCE,
  RECIPE_COMBAT_CHANCE,
  RECIPE_GIFT_CHANCE,
  RECIPE_QUEST_CHANCE,
  REQUEST_CHECK_CHANCE,
  SATIETY_DECAY_PER_TICK,
  SATIETY_HUNGRY_THRESHOLD,
  SELL_MAX_GOLD_PER_TRIP,
  TICK_MS,
  TRAVELER_CHECK_CHANCE,
  TRAVELER_MAX_PURCHASE,
  TREASURE_RESPAWN_MS,
} from '../game/config';
import { maybeUnlockRandomRecipe, rollMerchantRecipeOffer } from '../game/recipeUnlocks';
import { maybeAwardCosmeticTicket } from '../game/cosmeticUnlocks';
import { CRAFTING_RECIPES } from '../data/recipes';
import { usePlayerStore } from './usePlayerStore';
import { BirdWallet, useBirdEconomyStore } from './useBirdEconomyStore';
import { useGameTimeStore } from './useGameTimeStore';
import { useQuestStore } from './useQuestStore';
import { useRecipeStore } from './useRecipeStore';
import { useTownStore } from './useTownStore';
import { getAllAmenityPositions, getAllBuiltPlotPositions, getAllShopPositions, getTownZoneRadius } from '../data/townGrid';
import { checkTownQuestCondition, TOWN_QUESTS } from '../data/townQuests';

const INSPIRATION_STAT_LABEL: Record<InspirationStat, string> = {
  atk: '攻撃力',
  defense: '防御力',
  speed: '素早さ',
  luck: '運',
  maxHp: 'HP',
};

// The two flavor phrasings for a fresh detour's log line (see
// ai.ts's executeDetour) — picked randomly each time one starts.
const DETOUR_LOG_LINES = ['が街をぶらぶら歩いている', 'が花を眺めている'];

let uidCounter = 0;
function uid(prefix: string): string {
  uidCounter += 1;
  return `${prefix}_${uidCounter}_${Date.now()}`;
}

let logIdCounter = 0;
function makeLogEntry(birdName: string | null, action: string, detail: string): ActivityLogEntry {
  logIdCounter += 1;
  return { id: `log_${logIdCounter}_${Date.now()}`, timestamp: Date.now(), birdName, action, detail };
}

// A touch of organic variation around each def's hand-placed position, so
// the layout still reads as designed rather than perfectly gridded.
function jitterPosition(x: number, y: number): { x: number; y: number } {
  const jx = x + (Math.random() - 0.5) * 0.03;
  const jy = y + (Math.random() - 0.5) * 0.03;
  return { x: Math.min(0.94, Math.max(0.06, jx)), y: Math.min(0.9, Math.max(0.1, jy)) };
}

function buildInitialWorld(): WorldState {
  const enemies: EnemyInstance[] = ENEMY_DEFS.map((e) => {
    const spot = jitterPosition(e.x, e.y);
    return {
      uid: uid('enemy'),
      defId: e.id,
      name: e.name,
      emoji: e.emoji,
      x: spot.x,
      y: spot.y,
      hp: e.hp,
      maxHp: e.hp,
      atk: e.atk,
      goldReward: e.goldReward,
      expReward: e.expReward,
      dropTable: e.dropTable ?? [],
      defeated: false,
      respawnAt: null,
      damageLog: {},
      anchorX: spot.x,
      anchorY: spot.y,
      roamState: 'patrol',
      wanderX: null,
      wanderY: null,
      chaseTargetId: null,
      minTownLevel: e.minTownLevel ?? 1,
    };
  });
  const miningNodes: MiningNodeInstance[] = MINING_NODE_DEFS.map((m) => ({
    uid: uid('mine'),
    defId: m.id,
    name: m.name,
    ...jitterPosition(m.x, m.y),
    resource: m.resource,
    amount: m.amount,
    bonusDropTable: m.bonusDropTable ?? [],
    collected: false,
    respawnAt: null,
    minTownLevel: m.minTownLevel ?? 1,
  }));
  const treasures: TreasureNodeInstance[] = TREASURE_DEFS.map((t) => ({
    uid: uid('treasure'),
    defId: t.id,
    name: t.name,
    x: t.x,
    y: t.y,
    goldReward: t.goldReward,
    collected: false,
    respawnAt: null,
  }));
  const leisureSpots: LeisureSpotInstance[] = LEISURE_SPOT_DEFS.map((s) => ({
    uid: uid('leisure'),
    defId: s.id,
    name: s.name,
    emoji: s.emoji,
    kind: s.kind,
    x: s.x,
    y: s.y,
  }));

  const birds: BirdState[] = CHARACTERS.map((c) => {
    const wallet = useBirdEconomyStore.getState().getWallet(c.id);
    return {
      defId: c.id,
      name: c.name,
      isRecruited: wallet.isRecruited,
      x: TOWN_X + (Math.random() - 0.5) * 0.05,
      y: TOWN_Y + (Math.random() - 0.5) * 0.05,
      hp: wallet.maxHp,
      maxHp: wallet.maxHp,
      atk: wallet.atk,
      defense: wallet.defense,
      speed: wallet.speed,
      luck: wallet.luck,
      satiety: wallet.satiety,
      happiness: wallet.happiness,
      mood: rollRandomMood(),
      moodChangedAt: Date.now(),
      targetKind: null,
      targetRefUid: null,
      workProgress: 0,
      activity: 'idle',
      currentJobId: null,
      jobStage: null,
      carrying: null,
      gold: wallet.gold,
      inventory: { ...wallet.inventory },
      items: { ...wallet.items },
      equipment: { ...wallet.equipment },
      cosmeticId:
        wallet.cosmeticId != null && useCosmeticStore.getState().isCosmeticUnlocked(wallet.cosmeticId)
          ? wallet.cosmeticId
          : null,
      houseFood: { ...wallet.houseFood },
      houseTreasureIds: [...wallet.houseTreasureIds],
      skills: [...wallet.skills],
      level: wallet.level,
      exp: wallet.exp,
      wanderX: null,
      wanderY: null,
      chatLine: null,
      chatLineSetAt: 0,
      chatPauseTicks: 0,
    };
  });

  return {
    enemies,
    miningNodes,
    treasures,
    leisureSpots,
    birds,
    requests: [],
    activityLog: [],
    merchant: null,
    recruitmentEvents: [],
    recipeUnlockEvents: [],
    skillUnlockEvents: [],
    cosmeticTicketEvents: [],
  };
}

// Rolls a fresh randomized shelf for a new merchant visit — each slot
// independently drawn from the rare pool at MERCHANT_RARE_CHANCE, otherwise
// the common pool. Duplicate itemIds across slots are merged into one
// lineup entry rather than wasting a separate slot.
function rollMerchantLineup(): MerchantLineupEntry[] {
  const counts = new Map<ItemId, number>();
  for (let i = 0; i < MERCHANT_LINEUP_SIZE; i++) {
    const pool = Math.random() < MERCHANT_RARE_CHANCE ? MERCHANT_RARE_ITEM_IDS : MERCHANT_COMMON_ITEM_IDS;
    const itemId = pool[Math.floor(Math.random() * pool.length)];
    const amount =
      MERCHANT_ITEM_STOCK_MIN + Math.floor(Math.random() * (MERCHANT_ITEM_STOCK_MAX - MERCHANT_ITEM_STOCK_MIN + 1));
    counts.set(itemId, (counts.get(itemId) ?? 0) + amount);
  }
  return Array.from(counts.entries()).map(([itemId, amount]) => ({ itemId, amount }));
}

function buildMerchantVisit(now: number): MerchantState {
  const duration =
    MERCHANT_VISIT_DURATION_MIN_MS + Math.random() * (MERCHANT_VISIT_DURATION_MAX_MS - MERCHANT_VISIT_DURATION_MIN_MS);
  const recipeOffer = Math.random() < MERCHANT_RECIPE_OFFER_CHANCE ? rollMerchantRecipeOffer() : null;
  return { arrivedAt: now, departsAt: now + duration, lineup: rollMerchantLineup(), recipeOffer };
}

// Applies exp to a bird in place, looping through as many level-ups as the
// gain covers, and logs each one — a flat amount per kill (not split like
// gold), so fighting alongside others doesn't dilute anyone's growth.
function grantExp(bird: BirdState, amount: number, log: ActivityLogEntry[]) {
  bird.exp += amount;
  while (bird.exp >= expToNextLevel(bird.level)) {
    bird.exp -= expToNextLevel(bird.level);
    bird.level += 1;
    bird.atk += LEVEL_UP_ATK_GAIN;
    bird.maxHp += LEVEL_UP_HP_GAIN;
    bird.hp += LEVEL_UP_HP_GAIN;
    bird.defense += LEVEL_UP_DEFENSE_GAIN;
    bird.speed += LEVEL_UP_SPEED_GAIN;
    log.push(makeLogEntry(bird.name, 'levelUp', `${bird.name}がLv${bird.level}になった!`));
  }
}

// Shared by postRequest (manual posting) and tick's auto-refill (a completed
// slot rolls a fresh random preset) so both build the same shape of request.
function buildRequestFromPreset(preset: JobPreset): JobRequest {
  return {
    id: uid('job'),
    kind: preset.kind,
    materialId: preset.materialId,
    enemyName: preset.enemyName,
    itemId: preset.itemId,
    amount: preset.amount,
    reward: preset.reward,
    expReward: preset.expReward,
    developmentPoints: preset.developmentPoints,
    reputationPoints: preset.reputationPoints,
    status: 'open',
    acceptedBy: null,
    createdAt: Date.now(),
    delivered: 0,
  };
}

interface WorldActions {
  initWorld: () => void;
  tick: () => void;
  postRequest: (preset: JobPreset) => boolean;
  // Called after a successful craftItem() — advances any matching in-progress
  // 'craft' job's progress (a player action, not something the accepting
  // bird does itself; see ai.ts's stepJob comment).
  reportCraftCompleted: (itemId: ItemId) => void;
  // Delivers as much as the player's warehouse currently has (up to what's
  // still needed) toward a 'merchantDeliver' job — only while a merchant is
  // actually present. Returns false (no state change) if there's no
  // merchant, the request doesn't match, or the warehouse has none to give.
  deliverToMerchant: (requestId: string) => boolean;
  // Recipe-unlock route 1 ("商人が売りに来る") — spends gold to buy the
  // visiting merchant's current recipeOffer, if any. Player-initiated
  // (unlike the merchant's item lineup, which birds buy from
  // autonomously) since a recipe is player knowledge, not something a bird
  // carries or uses. Returns false if there's no merchant, no offer, or not
  // enough gold.
  buyMerchantRecipe: () => boolean;
  // House storage (see HouseInventoryModal) — all four return false (no
  // state change) if the move isn't possible (nothing to move, no room at
  // the destination, wrong item category, etc.) rather than partially
  // applying or throwing.
  depositFoodToHouse: (defId: string, itemId: ItemId, amount: number) => boolean;
  withdrawFoodFromHouse: (defId: string, itemId: ItemId, amount: number) => boolean;
  favoriteTreasure: (defId: string, itemId: ItemId) => boolean;
  unfavoriteTreasure: (defId: string, itemId: ItemId) => boolean;
  // Look-only costume change (see data/cosmetics.ts) — always available,
  // never validated against ownership/cost (out of scope for now, see
  // COSMETIC_ITEMS's own comment), and never touches stats. Pass null to
  // unequip back to the bird's plain look. Returns false only if defId
  // doesn't match a known bird.
  setCosmetic: (defId: string, cosmeticId: string | null) => boolean;
}

// Shared by reportCraftCompleted and deliverToMerchant — both are player-
// triggered completions outside the tick loop, so they commit their own
// world update instead of folding into the tick's one big set() call. Pays
// the reward + exp to the accepting bird, grants the town's dev/reputation
// points, marks the request done, and refills the board — the same
// completion pipeline the tick applies to finished gather/hunt jobs.
function finalizeStandaloneJob(world: WorldState, request: JobRequest, actionFragment: string): WorldState {
  const birdIndex = world.birds.findIndex((b) => b.defId === request.acceptedBy);
  const nextBirds = [...world.birds];
  const tempLog: ActivityLogEntry[] = [];
  let newRecipeUnlockEvent: { recipeId: string; source: RecipeSource } | null = null;
  if (birdIndex !== -1) {
    const bird = { ...world.birds[birdIndex] };
    grantExp(bird, request.expReward, tempLog);
    bird.gold += request.reward;
    nextBirds[birdIndex] = bird;
    tempLog.push(
      makeLogEntry(
        bird.name,
        'job',
        `${bird.name}が依頼(${actionFragment})を達成した!(報酬${request.reward}G/経験値${request.expReward})`
      )
    );
    // Recipe-unlock route 3 ("依頼掲示板の報酬") — craft/merchantDeliver
    // jobs complete here rather than in tick(), so this route needs its own
    // roll (gather/hunt kinds roll inside tick() itself).
    const recipeResult = maybeUnlockRandomRecipe(RECIPE_QUEST_CHANCE, 'quest');
    if (recipeResult) {
      tempLog.push(makeLogEntry(bird.name, 'recipe', `${bird.name}が新しいレシピ「${recipeResult.itemName}」を見つけた!`));
      newRecipeUnlockEvent = { recipeId: recipeResult.recipeId, source: 'quest' };
    }
  }
  useTownStore.getState().addDevelopmentPoints(request.developmentPoints);
  useTownStore.getState().addReputation(request.reputationPoints);
  useTownStore.getState().recordRequestCompleted(); // feeds the 'five_requests' town quest (data/townQuests.ts)
  usePlayerStore.getState().addGold(-request.reward);

  // No auto-refill here either — see tick()'s matching comment. This just
  // frees the slot; the player posts whatever they want next themselves.
  const nextRequests = world.requests.map((r) => (r.id === request.id ? { ...r, status: 'done' as const } : r));

  return {
    ...world,
    birds: nextBirds,
    requests: nextRequests,
    recipeUnlockEvents: newRecipeUnlockEvent ? [...world.recipeUnlockEvents, newRecipeUnlockEvent] : world.recipeUnlockEvents,
    activityLog: [...tempLog, ...world.activityLog].slice(0, ACTIVITY_LOG_MAX),
  };
}

interface WorldStore {
  world: WorldState;
}

export const useWorldStore = create<WorldStore & WorldActions>()((set, get) => ({
  world: {
    enemies: [],
    miningNodes: [],
    treasures: [],
    leisureSpots: [],
    birds: [],
    requests: [],
    activityLog: [],
    merchant: null,
    recruitmentEvents: [],
    recipeUnlockEvents: [],
    skillUnlockEvents: [],
    cosmeticTicketEvents: [],
  },

  initWorld: () => set({ world: buildInitialWorld() }),

  postRequest: (preset) => {
    // Posting itself is free; the reward is only paid out on completion.
    // We just check affordability up front so the player can't stack up
    // more promises than they could ever pay.
    if (usePlayerStore.getState().gold < preset.reward) return false;
    const activeCount = get().world.requests.filter((r) => r.status !== 'done').length;
    if (activeCount >= MAX_ACTIVE_REQUESTS) return false;

    const request = buildRequestFromPreset(preset);
    set({ world: { ...get().world, requests: [...get().world.requests, request] } });
    return true;
  },

  reportCraftCompleted: (itemId) => {
    const { world } = get();
    const request = world.requests.find((r) => r.kind === 'craft' && r.status === 'inProgress' && r.itemId === itemId);
    if (!request) return;
    request.delivered += 1; // mutated in place, same convention as gather/hunt progress
    if (request.delivered < request.amount) {
      set({ world: { ...world, requests: [...world.requests] } });
      return;
    }
    set({ world: finalizeStandaloneJob(world, request, `${ITEM_DEF_MAP[itemId].name}を${request.amount}個加工`) });
  },

  deliverToMerchant: (requestId) => {
    const { world } = get();
    if (!world.merchant) return false;
    const request = world.requests.find((r) => r.id === requestId);
    if (!request || request.kind !== 'merchantDeliver' || request.status !== 'inProgress' || !request.itemId) return false;
    const remaining = request.amount - request.delivered;
    if (remaining <= 0) return false;
    const owned = usePlayerStore.getState().items[request.itemId] ?? 0;
    const deliverAmount = Math.min(remaining, owned);
    if (deliverAmount <= 0) return false;
    usePlayerStore.getState().consumeItems(request.itemId, deliverAmount);
    request.delivered += deliverAmount;
    if (request.delivered < request.amount) {
      set({ world: { ...world, requests: [...world.requests] } });
      return true;
    }
    set({ world: finalizeStandaloneJob(world, request, `${ITEM_DEF_MAP[request.itemId].name}を商人に${request.amount}個納品`) });
    return true;
  },

  buyMerchantRecipe: () => {
    const { world } = get();
    const offer = world.merchant?.recipeOffer;
    if (!world.merchant || !offer) return false;
    if (!usePlayerStore.getState().trySpendGold(offer.price)) return false;
    const recipe = CRAFTING_RECIPES.find((r) => r.id === offer.recipeId);
    if (!useRecipeStore.getState().unlockRecipe(offer.recipeId, 'merchant') || !recipe) {
      // Already unlocked some other way in the meantime — refund and bail.
      usePlayerStore.getState().addGold(offer.price);
      return false;
    }
    const itemName = ITEM_DEF_MAP[recipe.resultItemId].name;
    const log = makeLogEntry(null, 'recipe', `商人から新しいレシピ「${itemName}」を購入した!(-${offer.price}G)`);
    set({
      world: {
        ...world,
        merchant: { ...world.merchant, recipeOffer: null },
        activityLog: [log, ...world.activityLog].slice(0, ACTIVITY_LOG_MAX),
        recipeUnlockEvents: [...world.recipeUnlockEvents, { recipeId: offer.recipeId, source: 'merchant' }],
      },
    });
    return true;
  },

  depositFoodToHouse: (defId, itemId, amount) => {
    if (ITEM_DEF_MAP[itemId].category !== 'food') return false;
    const { world } = get();
    const birdIndex = world.birds.findIndex((b) => b.defId === defId);
    if (birdIndex === -1) return false;
    const bird = world.birds[birdIndex];
    const currentTotal = Object.values(bird.houseFood).reduce((sum, a) => sum + (a ?? 0), 0);
    const headroom = HOUSE_FOOD_CAP - currentTotal;
    const owned = usePlayerStore.getState().items[itemId] ?? 0;
    const moved = Math.min(amount, headroom, owned);
    if (moved <= 0) return false;
    usePlayerStore.getState().consumeItems(itemId, moved);
    const nextBirds = [...world.birds];
    nextBirds[birdIndex] = { ...bird, houseFood: { ...bird.houseFood, [itemId]: (bird.houseFood[itemId] ?? 0) + moved } };
    set({ world: { ...world, birds: nextBirds } });
    return true;
  },

  withdrawFoodFromHouse: (defId, itemId, amount) => {
    const { world } = get();
    const birdIndex = world.birds.findIndex((b) => b.defId === defId);
    if (birdIndex === -1) return false;
    const bird = world.birds[birdIndex];
    const stocked = bird.houseFood[itemId] ?? 0;
    const moved = Math.min(amount, stocked);
    if (moved <= 0) return false;
    usePlayerStore.getState().addItems(itemId, moved);
    const nextBirds = [...world.birds];
    nextBirds[birdIndex] = { ...bird, houseFood: { ...bird.houseFood, [itemId]: stocked - moved } };
    set({ world: { ...world, birds: nextBirds } });
    return true;
  },

  // Moves one unit of a convertible item out of `items` and into the
  // bird's favorites list — physically removing it from `items` (not just
  // flagging it) is what keeps it out of hasConvertibleItems/
  // pickMerchantSellOffer's reach in ai.ts, so a favorited treasure can
  // never get auto-sold to the merchant.
  favoriteTreasure: (defId, itemId) => {
    if (!CONVERTIBLE_ITEM_IDS.includes(itemId)) return false;
    const { world } = get();
    const birdIndex = world.birds.findIndex((b) => b.defId === defId);
    if (birdIndex === -1) return false;
    const bird = world.birds[birdIndex];
    if (bird.houseTreasureIds.length >= HOUSE_TREASURE_CAP) return false;
    const owned = bird.items[itemId] ?? 0;
    if (owned <= 0) return false;
    const nextBirds = [...world.birds];
    nextBirds[birdIndex] = {
      ...bird,
      items: { ...bird.items, [itemId]: owned - 1 },
      houseTreasureIds: [...bird.houseTreasureIds, itemId],
    };
    set({ world: { ...world, birds: nextBirds } });
    return true;
  },

  // Reverse of favoriteTreasure — moves one unit back into `items`, making
  // it sellable to the merchant again.
  unfavoriteTreasure: (defId, itemId) => {
    const { world } = get();
    const birdIndex = world.birds.findIndex((b) => b.defId === defId);
    if (birdIndex === -1) return false;
    const bird = world.birds[birdIndex];
    const idx = bird.houseTreasureIds.indexOf(itemId);
    if (idx === -1) return false;
    const nextTreasureIds = [...bird.houseTreasureIds];
    nextTreasureIds.splice(idx, 1);
    const nextBirds = [...world.birds];
    nextBirds[birdIndex] = {
      ...bird,
      items: { ...bird.items, [itemId]: (bird.items[itemId] ?? 0) + 1 },
      houseTreasureIds: nextTreasureIds,
    };
    set({ world: { ...world, birds: nextBirds } });
    return true;
  },

  setCosmetic: (defId, cosmeticId) => {
    // Reject anything the player hasn't actually unlocked yet (see
    // useCosmeticStore) — never trust a caller-supplied id, since a stale
    // persisted value or a future UI path could otherwise re-introduce the
    // "wearing something you don't own" bug.
    if (cosmeticId !== null && !useCosmeticStore.getState().isCosmeticUnlocked(cosmeticId)) return false;
    const { world } = get();
    const birdIndex = world.birds.findIndex((b) => b.defId === defId);
    if (birdIndex === -1) return false;
    const nextBirds = [...world.birds];
    nextBirds[birdIndex] = { ...world.birds[birdIndex], cosmeticId };
    set({ world: { ...world, birds: nextBirds } });
    return true;
  },

  tick: () => {
    const { world } = get();
    if (world.birds.length === 0) return; // world not initialized yet

    const now = Date.now();
    const newLog: ActivityLogEntry[] = [];

    // Computed once, up front, since it gates both the enemy-patrol step
    // below and the AI's view of the field further down — field-zone
    // content past this level stays fully inert (no patrol/chase, never
    // targetable) rather than just hidden, so an "invisible" deep-zone
    // enemy can never ambush a bird that happens to wander near it before
    // the town's actually reached the required level (see EnemyDef's
    // minTownLevel). Phase 12②: no longer derived from developmentPoints —
    // townLevel is now an explicit, quest-driven field on useTownStore (see
    // data/townQuests.ts/useTownStore's completeTownQuest).
    const townLevel = useTownStore.getState().townLevel;

    // Advances the cosmetic game calendar in lockstep with this tick — see
    // config.ts's ONLINE_TIME_SCALE and useGameTimeStore.
    useGameTimeStore.getState().advanceOnline(TICK_MS);

    // Depleted enemies/resources come back once their respawn timer is up,
    // so the world never runs permanently dry. A respawning enemy also
    // reappears at a new random spot near its original design-time
    // position (see enemyAi.ts's respawnPosition) rather than exactly
    // where it died or fell back to the same pixel every time, and that
    // becomes its new patrol anchor.
    let enemies = world.enemies.map((e) => {
      if (!e.defeated || e.respawnAt === null || now < e.respawnAt) return e;
      const def = ENEMY_DEFS.find((d) => d.id === e.defId)!;
      const spot = respawnPosition(def.x, def.y);
      return {
        ...e,
        defeated: false,
        hp: e.maxHp,
        respawnAt: null,
        damageLog: {},
        x: spot.x,
        y: spot.y,
        anchorX: spot.x,
        anchorY: spot.y,
        roamState: 'patrol' as const,
        wanderX: null,
        wanderY: null,
        chaseTargetId: null,
      };
    });
    let miningNodes = world.miningNodes.map((m) =>
      m.collected && m.respawnAt !== null && now >= m.respawnAt
        ? { ...m, collected: false, respawnAt: null }
        : m
    );
    let treasures = world.treasures.map((t) =>
      t.collected && t.respawnAt !== null && now >= t.respawnAt
        ? { ...t, collected: false, respawnAt: null }
        : t
    );
    let requests = world.requests;

    // The visiting merchant — distinct from the traveler below: it lingers
    // for a whole visit instead of a single instant, and (unlike the
    // traveler, which only ever buys from town stock) both sells its own
    // randomized lineup and buys convertible treasure off birds.
    let merchant = world.merchant;
    if (merchant && now >= merchant.departsAt) {
      newLog.push(makeLogEntry(null, 'merchant', '商人が街を去っていった'));
      merchant = null;
    }
    if (!merchant && Math.random() < MERCHANT_ARRIVAL_CHECK_CHANCE) {
      merchant = buildMerchantVisit(now);
      newLog.push(makeLogEntry(null, 'merchant', `商人が街にやってきた!(商品${merchant.lineup.length}種類)`));
    }

    // Satiety always decays and happiness always drifts, regardless of the
    // mood-refresh timer. Once satiety bottoms out, mood is forced to
    // 'hungry' — and, unlike the other moods, 'hungry' is never overwritten
    // by the ambient timer below; it only clears when the bird actually eats
    // (see stepShopFood in ai.ts, which resets satiety back to full).
    // A bird that hasn't joined the town yet is completely frozen — no
    // decay, no mood changes, no AI — until a future recruitment trigger
    // flips isRecruited to true.
    const birdsWithMood = world.birds.map((b) => {
      if (!b.isRecruited) return b;
      const satiety = Math.max(0, b.satiety - SATIETY_DECAY_PER_TICK);
      const happiness = Math.min(
        100,
        Math.max(0, b.happiness + (b.mood === 'happy' ? 1 : b.mood === 'hungry' ? -1 : 0))
      );
      if (satiety <= SATIETY_HUNGRY_THRESHOLD && b.mood !== 'hungry') {
        return { ...b, satiety, happiness, mood: 'hungry' as const, moodChangedAt: now };
      }
      if (b.mood !== 'hungry' && now - b.moodChangedAt > MOOD_REFRESH_MS) {
        return { ...b, satiety, happiness, mood: rollRandomMood(), moodChangedAt: now };
      }
      return { ...b, satiety, happiness };
    });

    // Enemies patrol/chase/return on their own each tick, independent of
    // whichever bird might be heading toward them (see enemyAi.ts) — birds
    // still decide when to actually attack once in range (ai.ts). Enemies
    // past the current town level stay completely inert (no patrol/chase)
    // rather than just unrendered/untargetable — otherwise a deep-zone
    // enemy could still "ambush" a bird that wanders near it before the
    // town's actually unlocked that ground.
    const currentTownZoneRadius = getTownZoneRadius();
    enemies = enemies.map((e) =>
      e.defeated || e.minTownLevel > townLevel ? e : stepEnemy(e, birdsWithMood, currentTownZoneRadius)
    );

    // Free (jobless) birds occasionally check the request board.
    const openRequests = requests.filter((r) => r.status === 'open');
    const vanguardBird =
      birdsWithMood.find((b) => b.isRecruited && getCharacterDef(b.defId).personality === 'vanguard') ?? null;
    const vanguardOutInField = !!vanguardBird && Math.hypot(vanguardBird.x - TOWN_X, vanguardBird.y - TOWN_Y) > TOWN_RADIUS * 1.5;

    if (openRequests.length > 0) {
      for (const bird of birdsWithMood) {
        if (!bird.isRecruited || bird.currentJobId || bird.hp <= 0) continue;
        if (Math.random() > REQUEST_CHECK_CHANCE) continue;
        const def = getCharacterDef(bird.defId);
        const accepted = tryAcceptRequest(bird, def, openRequests, { vanguardOutInField });
        if (accepted) {
          // 'craft'/'merchantDeliver' jobs are player actions (see
          // reportCraftCompleted/deliverToMerchant) — the accepting bird
          // just "owns" the reward, it has no work of its own to pursue, so
          // it stays free to act normally instead of getting tied up.
          if (accepted.kind === 'gather' || accepted.kind === 'hunt') {
            bird.currentJobId = accepted.id;
            bird.jobStage = 'toAccept';
            bird.targetKind = null;
            bird.targetRefUid = null;
            bird.workProgress = 0;
          }
          accepted.status = 'inProgress';
          accepted.acceptedBy = bird.defId;
        }
      }
    }

    // Each bird now acts fully independently — no personality gets to see
    // another's decision first, since none of them assist/follow anymore.
    const nextBirds = birdsWithMood;
    // Field-zone content past the current level is left out of aiWorld
    // entirely — not deleted from `enemies`/`miningNodes` themselves, just
    // never targetable — so it starts showing up the moment the town
    // crosses the threshold, no special-case unlock step needed (see
    // EnemyDef/MiningNodeDef's minTownLevel).
    const aiWorld: AiWorld = {
      enemies: enemies.filter((e) => e.minTownLevel <= townLevel),
      miningNodes: miningNodes.filter((m) => m.minTownLevel <= townLevel),
      treasures,
      leisureSpots: world.leisureSpots,
      requests,
      shopStock: usePlayerStore.getState().shopStock,
      shopPositions: getAllShopPositions(useTownStore.getState().plots),
      merchant,
      townZoneRadius: currentTownZoneRadius,
      playerGold: usePlayerStore.getState().gold,
      amenityPositions: getAllAmenityPositions(useTownStore.getState().plots),
      // Phase 12③: town hall (always at TOWN_X/TOWN_Y) plus every plot that
      // actually has something built on it — see ai.ts's randomPointNearTown.
      occupiedSpots: [{ x: TOWN_X, y: TOWN_Y }, ...getAllBuiltPlotPositions(useTownStore.getState().plots)],
    };

    const allAssignments: AttackAssignment[] = [];
    const materialsToAdd: Partial<Record<MaterialId, number>> = {};
    let goldToAdd = 0;
    const completedJobIds = new Set<string>();
    // Recipe-unlock routes 'gift' (gather completion) and 'combat' (kill)
    // roll straight into this during the loops below; 'quest' (job-board
    // completion) rolls happen alongside each completedJobIds.add() call,
    // gather/hunt kinds here and craft/merchantDeliver in
    // finalizeStandaloneJob (which merges its own roll in separately, since
    // it commits its own set() call outside tick() entirely).
    const newRecipeUnlockEvents: { recipeId: string; source: 'gift' | 'quest' | 'combat' }[] = [];
    // Phase 11: queued the same way (see outcome.inspiration's handling
    // below) — only a new *skill* gets its own notification modal; a plain
    // stat-up inspiration is common enough to just be a log line + the
    // lightweight chat-bubble cue ai.ts's executePlay already set directly.
    const newSkillUnlockEvents: { birdName: string; skillId: string }[] = [];
    function tryRecipeUnlock(chance: number, source: 'gift' | 'quest' | 'combat', birdName: string | null) {
      const result = maybeUnlockRandomRecipe(chance, source);
      if (!result) return;
      newRecipeUnlockEvents.push({ recipeId: result.recipeId, source });
      newLog.push(
        makeLogEntry(birdName, 'recipe', `${birdName ? birdName + 'が' : ''}新しいレシピ「${result.itemName}」を見つけた!`)
      );
    }

    // Costume-ticket ambient routes (see game/cosmeticUnlocks.ts) — same
    // queued-event/logging shape as tryRecipeUnlock above, just awarding a
    // ticket (see useCosmeticStore) instead of an instant unlock.
    const newCosmeticTicketEvents: { cosmeticId: string; source: CosmeticSource }[] = [];
    function tryCosmeticTicket(chance: number, source: CosmeticSource, birdName: string | null) {
      const result = maybeAwardCosmeticTicket(chance);
      if (!result) return;
      newCosmeticTicketEvents.push({ cosmeticId: result.cosmeticId, source });
      newLog.push(
        makeLogEntry(birdName, 'cosmetic', `${birdName ? birdName + 'が' : ''}コスチューム「${result.name}」を見つけた!`)
      );
    }

    for (const bird of nextBirds) {
      if (!bird.isRecruited) continue;
      const def = getCharacterDef(bird.defId);
      const outcome = stepBird(bird, def, aiWorld);
      allAssignments.push(...outcome.assignments);
      for (const key of Object.keys(outcome.materialsCollected) as MaterialId[]) {
        materialsToAdd[key] = (materialsToAdd[key] ?? 0) + (outcome.materialsCollected[key] ?? 0);
      }
      if (outcome.miningCollectedUid) {
        miningNodes = miningNodes.map((m) =>
          m.uid === outcome.miningCollectedUid ? { ...m, collected: true, respawnAt: now + MINING_RESPAWN_MS } : m
        );
        aiWorld.miningNodes = miningNodes.filter((m) => m.minTownLevel <= townLevel);
        // Haku's recruitment quest — "successfully gather something for the
        // first time" — covers both free-roam and job gathers, since both
        // paths set miningCollectedUid. useQuestStore.complete is a no-op
        // once already done, so this is safe to call every time.
        useQuestStore.getState().complete(HAKU_QUEST_ID);
        // Recipe-unlock route 2 ("鳥が見つけてプレゼント") — a small chance
        // on any successful gather, free-roam or job alike.
        tryRecipeUnlock(RECIPE_GIFT_CHANCE, 'gift', bird.name);
        // Costume "find" route — same granularity as the recipe roll above.
        tryCosmeticTicket(COSMETIC_FIND_CHANCE, 'find', bird.name);
      }
      if (outcome.treasureCollectedUid) {
        // Treasure gold goes straight to the finding bird (handled in ai.ts)
        // rather than the player, so no player-side credit here anymore.
        const treasure = treasures.find((t) => t.uid === outcome.treasureCollectedUid);
        if (treasure) {
          newLog.push(makeLogEntry(bird.name, 'treasure', `${bird.name}が宝箱を見つけた!(+${treasure.goldReward}G)`));
        }
        treasures = treasures.map((t) =>
          t.uid === outcome.treasureCollectedUid ? { ...t, collected: true, respawnAt: now + TREASURE_RESPAWN_MS } : t
        );
        aiWorld.treasures = treasures;
      }
      if (outcome.deliveredMaterial) {
        const { materialId, amount } = outcome.deliveredMaterial;
        newLog.push(
          makeLogEntry(bird.name, 'gather', `${bird.name}が${MATERIAL_LABEL[materialId]}を${amount}個持ち帰った`)
        );
      }
      if (outcome.jobCompletedId) {
        // Raised by ai.ts's stepJob only once the bird's actually walked
        // back to the town hall with the job done (gather's own inventory-
        // /node-delivery and hunt's kill-count both just flip jobStage to
        // 'toDeliver' and let this shared arrival path grant everything —
        // see stepJob's and the kills loop's comments).
        completedJobIds.add(outcome.jobCompletedId);
        const request = requests.find((r) => r.id === outcome.jobCompletedId);
        if (request) {
          grantExp(bird, request.expReward, newLog);
          useTownStore.getState().addDevelopmentPoints(request.developmentPoints);
          useTownStore.getState().addReputation(request.reputationPoints);
          useTownStore.getState().recordRequestCompleted(); // feeds the 'five_requests' town quest (data/townQuests.ts)
          bird.gold += request.reward;
          const { label } = describeJobTarget(request);
          newLog.push(
            makeLogEntry(
              bird.name,
              'job',
              `${bird.name}が依頼(${label}${request.amount}${JOB_KIND_UNIT_LABEL[request.kind]})を達成した!(報酬${request.reward}G/経験値${request.expReward})`
            )
          );
          // Recipe-unlock route 3 ("依頼掲示板の報酬").
          tryRecipeUnlock(RECIPE_QUEST_CHANCE, 'quest', bird.name);
        }
      }
      if (outcome.foodPurchase > 0) {
        usePlayerStore.getState().creditFoodToll(outcome.foodPurchase);
        newLog.push(makeLogEntry(bird.name, 'buyFood', `${bird.name}が餌を購入した(+${outcome.foodPurchase}G)`));
      }
      if (outcome.ateHouseFood) {
        newLog.push(
          makeLogEntry(bird.name, 'buyFood', `${bird.name}が家に備蓄していた${ITEM_DEF_MAP[outcome.ateHouseFood].name}を食べた`)
        );
      }
      if (outcome.startedPlaying) {
        const placeLabel = outcome.startedPlaying === 'park' ? '公園' : '水浴び場';
        newLog.push(makeLogEntry(bird.name, 'play', `${bird.name}が${placeLabel}で遊んでいる`));
      }
      if (outcome.detourStarted) {
        const line = DETOUR_LOG_LINES[Math.floor(Math.random() * DETOUR_LOG_LINES.length)];
        newLog.push(makeLogEntry(bird.name, 'detour', `${bird.name}${line}`));
      }
      if (outcome.startedNapping) {
        newLog.push(makeLogEntry(bird.name, 'nap', `${bird.name}が家でのんびり昼寝している`));
      }
      if (outcome.inspiration) {
        if (outcome.inspiration.kind === 'skill') {
          const skillDef = BIRD_SKILL_DEF_MAP[outcome.inspiration.skillId];
          newLog.push(
            makeLogEntry(bird.name, 'inspiration', `${bird.name}は遊んでいるうちに、新しいスキル「${skillDef.name}」をひらめいた!`)
          );
          newSkillUnlockEvents.push({ birdName: bird.name, skillId: outcome.inspiration.skillId });
        } else {
          const statLabel = INSPIRATION_STAT_LABEL[outcome.inspiration.stat];
          newLog.push(
            makeLogEntry(
              bird.name,
              'inspiration',
              `${bird.name}は遊んでいるうちに、何かひらめいた!(${statLabel}+${outcome.inspiration.amount})`
            )
          );
        }
      }
      if (outcome.sellAttempt) {
        // A bird offers one material at a time (see pickSellOffer in ai.ts).
        // If the player can't afford the full offer, buy as much of it as
        // they can instead of failing the whole trip — otherwise a well-
        // stocked bird's asking price can permanently outpace the player's
        // slow trickle of income and trade just stalls.
        //
        // An overflow sell (bird.inventory over BIRD_INVENTORY_CAP) uses a
        // much larger gold cap than a casual trickle-trade — real-device
        // bug: applying the casual SELL_MAX_GOLD_PER_TRIP (15G) here meant a
        // full bird could only ever offload 1-3 units of a cheap material
        // per trip, nowhere near enough to clear a 150-unit cap, so it just
        // re-triggered a forced sell trip every single tick forever.
        const { materialId, amount: offeredAmount, overflow } = outcome.sellAttempt;
        const unitPrice = MATERIAL_SELL_PRICE[materialId];
        const goldCeiling = overflow ? OVERFLOW_SELL_MAX_GOLD_PER_TRIP : SELL_MAX_GOLD_PER_TRIP;
        const spendCap = Math.min(usePlayerStore.getState().gold, goldCeiling);
        const affordableUnits = unitPrice > 0 ? Math.floor(spendCap / unitPrice) : 0;
        const soldAmount = Math.min(offeredAmount ?? 0, affordableUnits);
        if (soldAmount > 0) {
          const cost = soldAmount * unitPrice;
          usePlayerStore.getState().trySpendGold(cost);
          usePlayerStore.getState().addMaterials({ [materialId]: soldAmount });
          bird.gold += cost;
          bird.inventory[materialId] = Math.max(0, (bird.inventory[materialId] ?? 0) - soldAmount);
          newLog.push(
            makeLogEntry(bird.name, 'sell', `${bird.name}が${MATERIAL_LABEL[materialId]}を${soldAmount}個売った(+${cost}G)`)
          );
        }
      }
      if (outcome.shopPurchase) {
        const { shopKind, itemId, amount, totalCost } = outcome.shopPurchase;
        usePlayerStore.getState().fulfillShopPurchase(shopKind, itemId, amount, totalCost);
        // In practice a gear purchase never hits the equip spare cap here —
        // pickGearOffer (ai.ts) already refuses to shop for a category
        // that's already equipped — but routing through the same capped
        // helper as combat drops keeps that guarantee even if that gating
        // ever changes, rather than depending on two places staying in sync.
        addItemCapped(bird, itemId, amount);
        maybeAutoEquip(bird, itemId);
        newLog.push(
          makeLogEntry(bird.name, 'buyShop', `${bird.name}が${ITEM_DEF_MAP[itemId].name}を買った(街に+${totalCost}G)`)
        );
      }
      if (outcome.bonusItemFound) {
        newLog.push(
          makeLogEntry(bird.name, 'drop', `${bird.name}が採集中に${ITEM_DEF_MAP[outcome.bonusItemFound].name}を見つけた!`)
        );
      }
      if (outcome.merchantSellAttempt) {
        // The 50/50 "market usage fee" split — separate from the combat
        // security fee (SECURITY_FEE_RATE), which never touches convertible
        // items at all (see combat.ts's resolveAttacks).
        const { itemId, amount } = outcome.merchantSellAttempt;
        const totalValue = ITEM_DEF_MAP[itemId].buyPrice * amount;
        const birdShare = Math.round(totalValue * (1 - MERCHANT_BUYBACK_SPLIT));
        const townShare = totalValue - birdShare;
        bird.items[itemId] = Math.max(0, (bird.items[itemId] ?? 0) - amount);
        bird.gold += birdShare;
        usePlayerStore.getState().creditMerchantToll(townShare);
        newLog.push(
          makeLogEntry(
            bird.name,
            'merchantSell',
            `${bird.name}が商人に${ITEM_DEF_MAP[itemId].name}を売った(鳥+${birdShare}G/街+${townShare}G)`
          )
        );
      }
      if (outcome.merchantBuyAttempt && merchant) {
        const { itemId, amount, totalCost } = outcome.merchantBuyAttempt;
        const entry = merchant.lineup.find((l) => l.itemId === itemId);
        if (entry) entry.amount = Math.max(0, entry.amount - amount);
        bird.items[itemId] = (bird.items[itemId] ?? 0) + amount;
        maybeAutoEquip(bird, itemId);
        newLog.push(
          makeLogEntry(bird.name, 'merchantBuy', `${bird.name}が商人から${ITEM_DEF_MAP[itemId].name}を買った(-${totalCost}G)`)
        );
      }
    }

    const combatResult = resolveAttacks(enemies, allAssignments);
    enemies = combatResult.enemies.map((e) =>
      e.defeated && e.respawnAt === null ? { ...e, respawnAt: now + ENEMY_RESPAWN_MS } : e
    );
    for (const kill of combatResult.kills) {
      usePlayerStore.getState().creditHuntToll(kill.feeGold);
      // Mone's alternate recruitment path — the town's first wolf-tier kill.
      if (kill.enemyName === WOLF_ENEMY_NAME) {
        useQuestStore.getState().complete(MONE_WOLF_KILL_MILESTONE_ID);
      }
      // Recipe-unlock route 4 ("討伐報酬") — once per kill, not per
      // participant, same granularity as the security-fee/toll above.
      tryRecipeUnlock(RECIPE_COMBAT_CHANCE, 'combat', null);
      // Costume "drop" route — same granularity as the recipe roll above.
      tryCosmeticTicket(COSMETIC_DROP_CHANCE, 'drop', null);
      // 'hunt' job progress — only counts toward the bird that actually
      // accepted the job (mirrors gather, where the accepting bird is the
      // one that has to do the delivering), not just anyone who helped.
      const huntRequest = requests.find(
        (r) =>
          r.kind === 'hunt' &&
          r.status === 'inProgress' &&
          r.enemyName === kill.enemyName &&
          r.acceptedBy &&
          kill.participants.includes(r.acceptedBy)
      );
      if (huntRequest) {
        huntRequest.delivered += 1;
        if (huntRequest.delivered >= huntRequest.amount) {
          // Don't grant anything yet — the accepting bird still has to walk
          // back to the town hall to hand the job in (real-device request).
          // ai.ts's stepJob drives that walk once jobStage flips to
          // 'toDeliver', and only raises outcome.jobCompletedId on arrival —
          // that shared path (see below) is what actually grants gold/exp/
          // dev/reputation and logs the completion, same as gather jobs.
          const bird = nextBirds.find((b) => b.defId === huntRequest.acceptedBy);
          if (bird) bird.jobStage = 'toDeliver';
        }
      }
      for (const { unitUid, gold } of kill.rewards) {
        const bird = nextBirds.find((b) => b.defId === unitUid);
        if (bird) bird.gold += gold;
      }
      for (const unitUid of kill.participants) {
        const bird = nextBirds.find((b) => b.defId === unitUid);
        if (bird) grantExp(bird, kill.expReward, newLog);
      }
      for (const drop of kill.drops) {
        const bird = nextBirds.find((b) => b.defId === drop.unitUid);
        if (!bird) continue;
        if (drop.kind === 'material') {
          const before = bird.inventory[drop.materialId] ?? 0;
          addCappedInventory(bird.inventory, drop.materialId, drop.amount);
          const added = (bird.inventory[drop.materialId] ?? 0) - before;
          // A basket already at BIRD_INVENTORY_CAP has no room for the drop
          // at all — skip the log line rather than claiming it was picked up.
          if (added > 0) {
            newLog.push(
              makeLogEntry(bird.name, 'drop', `${bird.name}が${kill.enemyName}から${MATERIAL_LABEL[drop.materialId]}をドロップで手に入れた`)
            );
          }
        } else {
          const result = addItemCapped(bird, drop.itemId, 1);
          maybeAutoEquip(bird, drop.itemId);
          if (result.added > 0) {
            newLog.push(
              makeLogEntry(bird.name, 'drop', `${bird.name}が${kill.enemyName}から${ITEM_DEF_MAP[drop.itemId].name}をドロップで手に入れた!`)
            );
          } else {
            // Equip-category spare cap hit (see EQUIPMENT_SPARE_CAP) — a
            // real-device report found 193 spare copies of one weapon piled
            // up here with no cap at all. Salvaged for gold instead of
            // silently vanishing.
            newLog.push(
              makeLogEntry(
                bird.name,
                'drop',
                `${bird.name}が${kill.enemyName}から${ITEM_DEF_MAP[drop.itemId].name}をドロップしたが、予備が十分だったため換金した(+${result.salvageGold}G)`
              )
            );
          }
        }
      }
      const participantNames = kill.participants
        .map((uid) => nextBirds.find((b) => b.defId === uid)?.name)
        .filter((n): n is string => !!n);
      if (participantNames.length > 0) {
        newLog.push(
          makeLogEntry(
            null,
            'kill',
            `${participantNames.join('・')}が${kill.enemyName}を倒した!(報酬${kill.totalGold}G、街に${kill.feeGold}G)`
          )
        );
      }
    }

    if (completedJobIds.size > 0) {
      requests = requests.map((r) => {
        if (!completedJobIds.has(r.id)) return r;
        goldToAdd -= r.reward; // paid out below alongside the gathered material's own gold-neutral value
        return { ...r, status: 'done' as const };
      });
      // A completed slot used to auto-refill with a random preset — real-
      // device feedback was that this fills the board with things the
      // player didn't ask for, right when they wanted to post something of
      // their own. A finished request now just frees its slot for the
      // player's next manual post instead of being replaced automatically.
    }

    for (const { enemyUid, damage } of combatResult.retaliations) {
      const attackerUids = new Set(allAssignments.filter((a) => a.enemyUid === enemyUid).map((a) => a.unitUid));
      const candidates = nextBirds.filter((b) => attackerUids.has(b.defId) && b.hp > 0);
      if (candidates.length > 0) {
        const victim = candidates[Math.floor(Math.random() * candidates.length)];
        const mitigated = Math.max(1, damage - getEffectiveStats(victim).defense);
        victim.hp = Math.max(0, victim.hp - mitigated);
      }
    }

    // A simple stand-in for a real traveler NPC: occasionally buys a random
    // material straight out of the shared warehouse, no bird involved.
    if (Math.random() < TRAVELER_CHECK_CHANCE) {
      const playerMaterials = usePlayerStore.getState().materials;
      const owned = (Object.keys(MATERIAL_SELL_PRICE) as MaterialId[]).filter((k) => (playerMaterials[k] ?? 0) > 0);
      if (owned.length > 0) {
        const materialId = owned[Math.floor(Math.random() * owned.length)];
        const stock = playerMaterials[materialId] ?? 0;
        const amount = Math.min(stock, 1 + Math.floor(Math.random() * TRAVELER_MAX_PURCHASE));
        const revenue = amount * MATERIAL_SELL_PRICE[materialId];
        if (amount > 0 && revenue > 0) {
          usePlayerStore.getState().addMaterials({ [materialId]: -amount });
          usePlayerStore.getState().creditTravelerToll(revenue);
          newLog.push(makeLogEntry(null, 'traveler', `旅人が${MATERIAL_LABEL[materialId]}を${amount}個買っていった(+${revenue}G)`));
        }
      }
    }

    // The feed shop's NPC supplier: top up any commodity staple that's
    // fallen below its target shelf quantity, straight out of the treasury
    // (unlike crafted goods, these never pass through the player's warehouse).
    // Gated on a feed shop actually being constructed somewhere (Phase 12①)
    // — otherwise the shelf would keep quietly restocking itself behind a
    // building that doesn't exist yet.
    for (const itemId of aiWorld.shopPositions.feed ? RESTOCKED_ITEM_IDS : []) {
      if (Math.random() >= FEED_RESTOCK_CHECK_CHANCE) continue;
      const current = usePlayerStore.getState().shopStock.feed[itemId] ?? 0;
      if (current >= FEED_RESTOCK_TARGET) continue;
      const shortfall = FEED_RESTOCK_TARGET - current;
      const unitCost = ITEM_DEF_MAP[itemId].restockCost ?? 0;
      usePlayerStore.getState().restockShopItem('feed', itemId, shortfall, unitCost);
      newLog.push(
        makeLogEntry(null, 'restock', `餌屋に${ITEM_DEF_MAP[itemId].name}が${shortfall}個補充された(-${shortfall * unitCost}G)`)
      );
    }

    const healer = nextBirds.find((b) => b.isRecruited && getCharacterDef(b.defId).role === 'healer' && b.hp > 0);
    const healedBirds = healer ? applyHealing(nextBirds, healer.defId, getEffectiveStats(healer).atk) : nextBirds;
    const finalBirds = separateBirds(healedBirds);

    // Phase 11's ambient "chat" flavor: two nearby recruited birds
    // occasionally pause to exchange a line — a cosmetic speech-bubble
    // overlay (see BirdState.chatLine) plus a brief in-place pause (see
    // BirdState.chatPauseTicks/stepBird), so the bubble actually reads as
    // "why they stopped" rather than a blink during otherwise-constant
    // motion (real-device report). This has to live here rather than in
    // ai.ts's stepBird (which only ever sees one bird at a time) since only
    // the tick loop has every bird's final position at once. Checked after
    // separateBirds so positions are this tick's real, final ones.
    //
    // Only eligible while a bird is already doing something "free" —
    // pausing mid-combat/mid-job/mid-carry would either look broken (a
    // fighting bird frozen next to its target) or interfere with the job/
    // delivery flow this feature is explicitly not supposed to touch.
    const CHAT_ELIGIBLE_ACTIVITIES = new Set(['idle', 'resting', 'strolling', 'playing', 'bathing', 'fishing']);
    for (let i = 0; i < finalBirds.length; i++) {
      const a = finalBirds[i];
      if (!a.isRecruited || a.hp <= 0 || a.currentJobId || !CHAT_ELIGIBLE_ACTIVITIES.has(a.activity)) continue;
      for (let j = i + 1; j < finalBirds.length; j++) {
        const b = finalBirds[j];
        if (!b.isRecruited || b.hp <= 0 || b.currentJobId || !CHAT_ELIGIBLE_ACTIVITIES.has(b.activity)) continue;
        if (Math.hypot(a.x - b.x, a.y - b.y) > CHAT_PROXIMITY_DIST) continue;
        // Additive, not multiplicative — a real-device report found chat
        // almost never fired because a tiny base chance got multiplied by
        // the mood boost, so a bird whose happiness stayed comfortably high
        // (the common case) got the *smallest* version of an already-tiny
        // number. A flat base rate now fires regardless of mood, with only
        // a modest top-up when either bird is unhappy.
        const lowMoodBonus =
          a.happiness <= HAPPINESS_LOW_THRESHOLD || b.happiness <= HAPPINESS_LOW_THRESHOLD ? CHAT_CHANCE_LOW_MOOD_BONUS : 0;
        if (Math.random() >= CHAT_CHANCE_BASE + lowMoodBonus) continue;
        a.chatLine = CHAT_LINES[Math.floor(Math.random() * CHAT_LINES.length)];
        a.chatLineSetAt = now;
        a.chatPauseTicks = CHAT_PAUSE_TICKS;
        b.chatLine = CHAT_LINES[Math.floor(Math.random() * CHAT_LINES.length)];
        b.chatLineSetAt = now;
        b.chatPauseTicks = CHAT_PAUSE_TICKS;
      }
    }

    // Phase 12②("クエスト連動の街発展"): checks the *currently active* town
    // quest (data/townQuests.ts) every tick — exactly one is ever active at
    // a time (see useTownStore's townQuestIndex), so this is a single
    // lookup + condition check, not a loop over every quest. Completing it
    // is the only thing that ever advances townLevel now (see
    // useTownStore's completeTownQuest) — routine job-board/plot-unlock
    // activity keeps feeding developmentPoints (flavor-only now) but no
    // longer bumps the town's tier on its own.
    const townState = useTownStore.getState();
    const activeTownQuest = TOWN_QUESTS[townState.townQuestIndex];
    if (
      activeTownQuest &&
      checkTownQuestCondition(activeTownQuest, { plots: townState.plots, completedRequestCount: townState.completedRequestCount })
    ) {
      useTownStore
        .getState()
        .completeTownQuest(activeTownQuest.id, activeTownQuest.name, activeTownQuest.rewardText, activeTownQuest.grantsTownLevel);
      newLog.push(makeLogEntry(null, 'levelUp', `街の発展クエスト「${activeTownQuest.name}」達成!${activeTownQuest.rewardText}`));
    }

    // Check each not-yet-recruited starter's own trigger — town-level for
    // Vivi, the one-off quest for Haku, and a chance map encounter (Mone's
    // has an alternate combat-milestone path too) for Tororo/Mone. Flipping
    // isRecruited here (on this tick's own BirdState) is enough to persist
    // it too — the wallet sync below rebuilds every wallet straight from
    // finalBirds, isRecruited included, so there's no separate recruitBird
    // call to make.
    const newRecruitmentEvents: string[] = [];
    const activeBirdPositions = finalBirds.filter((b) => b.isRecruited).map((b) => ({ x: b.x, y: b.y }));
    const quests = useQuestStore.getState();
    const recruitmentChecks: Record<string, () => boolean> = {
      vivi: () => checkVivi(townLevel),
      haku: () => checkHaku(quests.isComplete(HAKU_QUEST_ID)),
      tororo: () => checkTororoEncounter(activeBirdPositions),
      mone: () => checkMoneEncounter(activeBirdPositions, quests.isComplete(MONE_WOLF_KILL_MILESTONE_ID)),
    };
    for (const bird of finalBirds) {
      if (bird.isRecruited) continue;
      const check = recruitmentChecks[bird.defId];
      if (!check || !check()) continue;
      bird.isRecruited = true;
      newRecruitmentEvents.push(bird.defId);
      newLog.push(makeLogEntry(bird.name, 'recruit', `${bird.name}が仲間になった!`));
    }

    if (Object.keys(materialsToAdd).length > 0) {
      usePlayerStore.getState().addMaterials(materialsToAdd);
    }
    if (goldToAdd !== 0) {
      usePlayerStore.getState().addGold(goldToAdd);
    }

    const wallets: Record<string, BirdWallet> = {};
    for (const b of finalBirds)
      wallets[b.defId] = {
        gold: b.gold,
        inventory: b.inventory,
        items: b.items,
        equipment: b.equipment,
        cosmeticId: b.cosmeticId,
        houseFood: b.houseFood,
        houseTreasureIds: b.houseTreasureIds,
        skills: b.skills,
        level: b.level,
        exp: b.exp,
        atk: b.atk,
        maxHp: b.maxHp,
        defense: b.defense,
        speed: b.speed,
        luck: b.luck,
        satiety: b.satiety,
        happiness: b.happiness,
        isRecruited: b.isRecruited,
      };
    useBirdEconomyStore.getState().syncAll(wallets);

    const activityLog = [...newLog, ...world.activityLog].slice(0, ACTIVITY_LOG_MAX);

    set({
      world: {
        enemies,
        miningNodes,
        treasures,
        leisureSpots: world.leisureSpots,
        birds: finalBirds,
        requests,
        activityLog,
        merchant,
        recruitmentEvents:
          newRecruitmentEvents.length > 0 ? [...world.recruitmentEvents, ...newRecruitmentEvents] : world.recruitmentEvents,
        recipeUnlockEvents:
          newRecipeUnlockEvents.length > 0
            ? [...world.recipeUnlockEvents, ...newRecipeUnlockEvents]
            : world.recipeUnlockEvents,
        skillUnlockEvents:
          newSkillUnlockEvents.length > 0 ? [...world.skillUnlockEvents, ...newSkillUnlockEvents] : world.skillUnlockEvents,
        cosmeticTicketEvents:
          newCosmeticTicketEvents.length > 0
            ? [...world.cosmeticTicketEvents, ...newCosmeticTicketEvents]
            : world.cosmeticTicketEvents,
      },
    });
  },
}));

// Kept for potential external scoring/inspection (e.g. debugging tools).
export { scoreRequestAcceptance };
