import { create } from 'zustand';

import {
  ActivityLogEntry,
  BirdState,
  EnemyInstance,
  JobRequest,
  LeisureSpotInstance,
  MaterialId,
  MiningNodeInstance,
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
import { AttackAssignment, applyHealing, resolveAttacks } from '../game/combat';
import { scoreRequestAcceptance, tryAcceptRequest } from '../game/requests';
import { MATERIAL_LABEL } from '../data/materials';
import { ITEM_DEF_MAP } from '../data/items';
import { MATERIAL_SELL_PRICE } from '../data/marketPrices';
import {
  ACTIVITY_LOG_MAX,
  ENEMY_RESPAWN_MS,
  expToNextLevel,
  LEVEL_UP_ATK_GAIN,
  LEVEL_UP_HP_GAIN,
  MINING_RESPAWN_MS,
  MOOD_REFRESH_MS,
  REQUEST_CHECK_CHANCE,
  SELL_MAX_GOLD_PER_TRIP,
  TRAVELER_CHECK_CHANCE,
  TRAVELER_MAX_PURCHASE,
  TREASURE_RESPAWN_MS,
} from '../game/config';
import { usePlayerStore } from './usePlayerStore';
import { BirdWallet, useBirdEconomyStore } from './useBirdEconomyStore';

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
  const enemies: EnemyInstance[] = ENEMY_DEFS.map((e) => ({
    uid: uid('enemy'),
    defId: e.id,
    name: e.name,
    emoji: e.emoji,
    ...jitterPosition(e.x, e.y),
    hp: e.hp,
    maxHp: e.hp,
    atk: e.atk,
    goldReward: e.goldReward,
    expReward: e.expReward,
    dropTable: e.dropTable ?? [],
    defeated: false,
    respawnAt: null,
    damageLog: {},
  }));
  const miningNodes: MiningNodeInstance[] = MINING_NODE_DEFS.map((m) => ({
    uid: uid('mine'),
    defId: m.id,
    name: m.name,
    ...jitterPosition(m.x, m.y),
    resource: m.resource,
    amount: m.amount,
    collected: false,
    respawnAt: null,
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
      x: TOWN_X + (Math.random() - 0.5) * 0.05,
      y: TOWN_Y + (Math.random() - 0.5) * 0.05,
      hp: c.baseHp,
      maxHp: c.baseHp,
      atk: c.baseAtk,
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
      level: wallet.level,
      exp: wallet.exp,
      wanderX: null,
      wanderY: null,
    };
  });

  return { enemies, miningNodes, treasures, leisureSpots, birds, requests: [], activityLog: [] };
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
    log.push(makeLogEntry(bird.name, 'levelUp', `${bird.name}がLv${bird.level}になった!`));
  }
}

interface WorldActions {
  initWorld: () => void;
  tick: () => void;
  postRequest: (materialId: MaterialId, amount: number, reward: number) => boolean;
}

interface WorldStore {
  world: WorldState;
}

export const useWorldStore = create<WorldStore & WorldActions>()((set, get) => ({
  world: { enemies: [], miningNodes: [], treasures: [], leisureSpots: [], birds: [], requests: [], activityLog: [] },

  initWorld: () => set({ world: buildInitialWorld() }),

  postRequest: (materialId, amount, reward) => {
    // Posting itself is free; the reward is only paid out on completion.
    // We just check affordability up front so the player can't stack up
    // more promises than they could ever pay.
    if (usePlayerStore.getState().gold < reward) return false;

    const request: JobRequest = {
      id: uid('job'),
      materialId,
      amount,
      reward,
      status: 'open',
      acceptedBy: null,
      createdAt: Date.now(),
    };
    set({ world: { ...get().world, requests: [...get().world.requests, request] } });
    return true;
  },

  tick: () => {
    const { world } = get();
    if (world.birds.length === 0) return; // world not initialized yet

    const now = Date.now();
    const newLog: ActivityLogEntry[] = [];

    // Depleted enemies/resources come back once their respawn timer is up,
    // so the world never runs permanently dry.
    let enemies = world.enemies.map((e) =>
      e.defeated && e.respawnAt !== null && now >= e.respawnAt
        ? { ...e, defeated: false, hp: e.maxHp, respawnAt: null, damageLog: {} }
        : e
    );
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

    // Refresh moods that have expired.
    const birdsWithMood = world.birds.map((b) =>
      now - b.moodChangedAt > MOOD_REFRESH_MS ? { ...b, mood: rollRandomMood(), moodChangedAt: now } : { ...b }
    );

    // Free (jobless) birds occasionally check the request board.
    const openRequests = requests.filter((r) => r.status === 'open');
    const vanguardBird = birdsWithMood.find((b) => getCharacterDef(b.defId).personality === 'vanguard') ?? null;
    const vanguardOutInField = !!vanguardBird && Math.hypot(vanguardBird.x - TOWN_X, vanguardBird.y - TOWN_Y) > TOWN_RADIUS * 1.5;

    if (openRequests.length > 0) {
      for (const bird of birdsWithMood) {
        if (bird.currentJobId || bird.hp <= 0) continue;
        if (Math.random() > REQUEST_CHECK_CHANCE) continue;
        const def = getCharacterDef(bird.defId);
        const accepted = tryAcceptRequest(bird, def, openRequests, { vanguardOutInField });
        if (accepted) {
          bird.currentJobId = accepted.id;
          bird.targetKind = null;
          bird.targetRefUid = null;
          bird.workProgress = 0;
          accepted.status = 'inProgress';
          accepted.acceptedBy = bird.defId;
        }
      }
    }

    // Each bird now acts fully independently — no personality gets to see
    // another's decision first, since none of them assist/follow anymore.
    const nextBirds = birdsWithMood;
    const aiWorld: AiWorld = {
      enemies,
      miningNodes,
      treasures,
      leisureSpots: world.leisureSpots,
      requests,
    };

    const allAssignments: AttackAssignment[] = [];
    const materialsToAdd: Partial<Record<MaterialId, number>> = {};
    let goldToAdd = 0;
    const completedJobIds = new Set<string>();

    for (const bird of nextBirds) {
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
        aiWorld.miningNodes = miningNodes;
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
          newLog.push(
            makeLogEntry(
              bird.name,
              'job',
              `${bird.name}が依頼(${MATERIAL_LABEL[request.materialId]}${request.amount}個)を達成した!(報酬${request.reward}G)`
            )
          );
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
    }

    if (completedJobIds.size > 0) {
      requests = requests.map((r) => {
        if (!completedJobIds.has(r.id)) return r;
        goldToAdd -= r.reward; // paid out below alongside the gathered material's own gold-neutral value
        return { ...r, status: 'done' as const };
      });
    }

    const combatResult = resolveAttacks(enemies, allAssignments);
    enemies = combatResult.enemies.map((e) =>
      e.defeated && e.respawnAt === null ? { ...e, respawnAt: now + ENEMY_RESPAWN_MS } : e
    );
    for (const kill of combatResult.kills) {
      usePlayerStore.getState().creditHuntToll(kill.feeGold);
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

    for (const { enemyUid, damage } of combatResult.retaliations) {
      const attackerUids = new Set(allAssignments.filter((a) => a.enemyUid === enemyUid).map((a) => a.unitUid));
      const candidates = nextBirds.filter((b) => attackerUids.has(b.defId) && b.hp > 0);
      if (candidates.length > 0) {
        const victim = candidates[Math.floor(Math.random() * candidates.length)];
        victim.hp = Math.max(0, victim.hp - damage);
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

    const healer = nextBirds.find((b) => getCharacterDef(b.defId).role === 'healer' && b.hp > 0);
    const healedBirds = healer ? applyHealing(nextBirds, healer.defId, healer.atk) : nextBirds;
    const finalBirds = separateBirds(healedBirds);

    if (Object.keys(materialsToAdd).length > 0) {
      usePlayerStore.getState().addMaterials(materialsToAdd);
    }
    if (goldToAdd !== 0) {
      usePlayerStore.getState().addGold(goldToAdd);
    }

    const wallets: Record<string, BirdWallet> = {};
    for (const b of finalBirds)
      wallets[b.defId] = { gold: b.gold, inventory: b.inventory, items: b.items, level: b.level, exp: b.exp };
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
      },
    });
  },
}));

// Kept for potential external scoring/inspection (e.g. debugging tools).
export { scoreRequestAcceptance };
