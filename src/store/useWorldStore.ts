import { create } from 'zustand';

import {
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
import {
  ENEMY_RESPAWN_MS,
  MINING_RESPAWN_MS,
  MOOD_REFRESH_MS,
  REQUEST_CHECK_CHANCE,
  TREASURE_RESPAWN_MS,
} from '../game/config';
import { usePlayerStore } from './usePlayerStore';

let uidCounter = 0;
function uid(prefix: string): string {
  uidCounter += 1;
  return `${prefix}_${uidCounter}_${Date.now()}`;
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
    defeated: false,
    respawnAt: null,
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

  const birds: BirdState[] = CHARACTERS.map((c) => ({
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
    wanderX: null,
    wanderY: null,
  }));

  return { enemies, miningNodes, treasures, leisureSpots, birds, requests: [] };
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
  world: { enemies: [], miningNodes: [], treasures: [], leisureSpots: [], birds: [], requests: [] },

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

    // Depleted enemies/resources come back once their respawn timer is up,
    // so the world never runs permanently dry.
    let enemies = world.enemies.map((e) =>
      e.defeated && e.respawnAt !== null && now >= e.respawnAt
        ? { ...e, defeated: false, hp: e.maxHp, respawnAt: null }
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
        const treasure = treasures.find((t) => t.uid === outcome.treasureCollectedUid);
        if (treasure) goldToAdd += treasure.goldReward;
        treasures = treasures.map((t) =>
          t.uid === outcome.treasureCollectedUid ? { ...t, collected: true, respawnAt: now + TREASURE_RESPAWN_MS } : t
        );
        aiWorld.treasures = treasures;
      }
      if (outcome.jobCompletedId) {
        completedJobIds.add(outcome.jobCompletedId);
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
    goldToAdd += combatResult.goldReward;

    for (const { enemyUid, damage } of combatResult.retaliations) {
      const attackerUids = new Set(allAssignments.filter((a) => a.enemyUid === enemyUid).map((a) => a.unitUid));
      const candidates = nextBirds.filter((b) => attackerUids.has(b.defId) && b.hp > 0);
      if (candidates.length > 0) {
        const victim = candidates[Math.floor(Math.random() * candidates.length)];
        victim.hp = Math.max(0, victim.hp - damage);
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

    set({
      world: {
        enemies,
        miningNodes,
        treasures,
        leisureSpots: world.leisureSpots,
        birds: finalBirds,
        requests,
      },
    });
  },
}));

// Kept for potential external scoring/inspection (e.g. debugging tools).
export { scoreRequestAcceptance };
