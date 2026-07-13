import { create } from 'zustand';

import {
  ActivityLogEntry,
  BirdState,
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
import { AiWorld, separateBirds, stepBird } from '../game/ai';
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
import { MATERIAL_LABEL } from '../data/materials';
import { JOB_PRESETS, JobPreset } from '../data/jobPresets';
import { ITEM_DEF_MAP, MERCHANT_COMMON_ITEM_IDS, MERCHANT_RARE_ITEM_IDS, RESTOCKED_ITEM_IDS } from '../data/items';
import { MATERIAL_SELL_PRICE } from '../data/marketPrices';
import {
  ACTIVITY_LOG_MAX,
  ENEMY_RESPAWN_MS,
  expToNextLevel,
  FEED_RESTOCK_CHECK_CHANCE,
  FEED_RESTOCK_TARGET,
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
  MOOD_REFRESH_MS,
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
import { CRAFTING_RECIPES } from '../data/recipes';
import { usePlayerStore } from './usePlayerStore';
import { BirdWallet, useBirdEconomyStore } from './useBirdEconomyStore';
import { useGameTimeStore } from './useGameTimeStore';
import { useQuestStore } from './useQuestStore';
import { useRecipeStore } from './useRecipeStore';
import { useTownStore } from './useTownStore';
import { getAllShopPositions, getTownLevel, getTownZoneRadius } from '../data/townGrid';

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
      hp: c.baseHp,
      maxHp: c.baseHp,
      atk: c.baseAtk,
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
      carrying: null,
      gold: wallet.gold,
      inventory: { ...wallet.inventory },
      items: { ...wallet.items },
      equipment: { ...wallet.equipment },
      level: wallet.level,
      exp: wallet.exp,
      wanderX: null,
      wanderY: null,
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
  usePlayerStore.getState().addGold(-request.reward);

  let nextRequests = world.requests.map((r) => (r.id === request.id ? { ...r, status: 'done' as const } : r));
  const activeCount = nextRequests.filter((r) => r.status !== 'done').length;
  if (activeCount < MAX_ACTIVE_REQUESTS) {
    const preset = JOB_PRESETS[Math.floor(Math.random() * JOB_PRESETS.length)];
    nextRequests = [...nextRequests, buildRequestFromPreset(preset)];
  }

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
    // minTownLevel).
    const townLevel = getTownLevel(useTownStore.getState().developmentPoints);

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
    const currentTownZoneRadius = getTownZoneRadius(townLevel);
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
    function tryRecipeUnlock(chance: number, source: 'gift' | 'quest' | 'combat', birdName: string | null) {
      const result = maybeUnlockRandomRecipe(chance, source);
      if (!result) return;
      newRecipeUnlockEvents.push({ recipeId: result.recipeId, source });
      newLog.push(
        makeLogEntry(birdName, 'recipe', `${birdName ? birdName + 'が' : ''}新しいレシピ「${result.itemName}」を見つけた!`)
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
        completedJobIds.add(outcome.jobCompletedId);
        const request = requests.find((r) => r.id === outcome.jobCompletedId);
        if (request) {
          grantExp(bird, request.expReward, newLog);
          useTownStore.getState().addDevelopmentPoints(request.developmentPoints);
          useTownStore.getState().addReputation(request.reputationPoints);
          // Only 'gather' jobs ever set outcome.jobCompletedId — 'hunt'
          // completions are detected later, in the kills loop below.
          newLog.push(
            makeLogEntry(
              bird.name,
              'job',
              `${bird.name}が依頼(${MATERIAL_LABEL[request.materialId!]}${request.amount}個)を達成した!(報酬${request.reward}G/経験値${request.expReward})`
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
      if (outcome.sellAttempt) {
        // A bird offers one material at a time (see pickSellOffer in ai.ts).
        // If the player can't afford the full offer, buy as much of it as
        // they can instead of failing the whole trip — otherwise a well-
        // stocked bird's asking price can permanently outpace the player's
        // slow trickle of income and trade just stalls.
        const [materialId, offeredAmount] = Object.entries(outcome.sellAttempt)[0] as [MaterialId, number];
        const unitPrice = MATERIAL_SELL_PRICE[materialId];
        const spendCap = Math.min(usePlayerStore.getState().gold, SELL_MAX_GOLD_PER_TRIP);
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
        bird.items[itemId] = (bird.items[itemId] ?? 0) + amount;
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
          completedJobIds.add(huntRequest.id);
          const bird = nextBirds.find((b) => b.defId === huntRequest.acceptedBy);
          if (bird) {
            grantExp(bird, huntRequest.expReward, newLog);
            useTownStore.getState().addDevelopmentPoints(huntRequest.developmentPoints);
            useTownStore.getState().addReputation(huntRequest.reputationPoints);
            bird.gold += huntRequest.reward;
            bird.currentJobId = null;
            newLog.push(
              makeLogEntry(
                bird.name,
                'job',
                `${bird.name}が依頼(${huntRequest.enemyName}${huntRequest.amount}体討伐)を達成した!(報酬${huntRequest.reward}G/経験値${huntRequest.expReward})`
              )
            );
            // Recipe-unlock route 3 ("依頼掲示板の報酬").
            tryRecipeUnlock(RECIPE_QUEST_CHANCE, 'quest', bird.name);
          }
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
          bird.inventory[drop.materialId] = (bird.inventory[drop.materialId] ?? 0) + drop.amount;
          newLog.push(
            makeLogEntry(bird.name, 'drop', `${bird.name}が${kill.enemyName}から${MATERIAL_LABEL[drop.materialId]}をドロップで手に入れた`)
          );
        } else {
          bird.items[drop.itemId] = (bird.items[drop.itemId] ?? 0) + 1;
          maybeAutoEquip(bird, drop.itemId);
          newLog.push(
            makeLogEntry(bird.name, 'drop', `${bird.name}が${kill.enemyName}から${ITEM_DEF_MAP[drop.itemId].name}をドロップで手に入れた!`)
          );
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
      // Refill 1:1 for each slot that just freed up, capped at
      // MAX_ACTIVE_REQUESTS — keeps the board a steady, bounded pool without
      // overriding the player's own choice of which presets to post.
      let activeCount = requests.filter((r) => r.status !== 'done').length;
      for (let i = 0; i < completedJobIds.size && activeCount < MAX_ACTIVE_REQUESTS; i++) {
        const preset = JOB_PRESETS[Math.floor(Math.random() * JOB_PRESETS.length)];
        requests = [...requests, buildRequestFromPreset(preset)];
        activeCount += 1;
      }
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
    for (const itemId of RESTOCKED_ITEM_IDS) {
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
        level: b.level,
        exp: b.exp,
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
      },
    });
  },
}));

// Kept for potential external scoring/inspection (e.g. debugging tools).
export { scoreRequestAcceptance };
