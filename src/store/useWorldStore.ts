import { create } from 'zustand';

import {
  BirdState,
  EnemyInstance,
  JobRequest,
  LeisureSpotInstance,
  MaterialId,
  MiningNodeInstance,
  Personality,
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
import { AiWorld, stepBird } from '../game/ai';
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

// Scatter `count` points across the world on a jittered grid so items don't
// overlap, leaving a clear ring around the town for its own footprint.
function scatterPositions(count: number): { x: number; y: number }[] {
  if (count === 0) return [];
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  const cells: { x: number; y: number }[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells.push({ x: (c + 0.5) / cols, y: (r + 0.5) / rows });
    }
  }
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  return cells.slice(0, count).map((cell) => {
    const jitterX = (Math.random() - 0.5) * (0.7 / cols);
    const jitterY = (Math.random() - 0.5) * (0.7 / rows);
    let x = 0.1 + cell.x * 0.8 + jitterX;
    let y = 0.15 + cell.y * 0.7 + jitterY;
    const dx = x - TOWN_X;
    const dy = y - TOWN_Y;
    if (Math.hypot(dx, dy) < TOWN_RADIUS * 1.3) {
      const angle = Math.atan2(dy, dx) || Math.random() * Math.PI * 2;
      x = TOWN_X + Math.cos(angle) * TOWN_RADIUS * 1.4;
      y = TOWN_Y + Math.sin(angle) * TOWN_RADIUS * 1.4;
    }
    return { x: Math.min(0.92, Math.max(0.08, x)), y: Math.min(0.88, Math.max(0.16, y)) };
  });
}

const PERSONALITY_ORDER: Record<Personality, number> = {
  vanguard: 0,
  freeSpirit: 1,
  clingy: 2,
  cautious: 3,
};

function buildInitialWorld(): WorldState {
  const positions = scatterPositions(
    ENEMY_DEFS.length + MINING_NODE_DEFS.length + TREASURE_DEFS.length + LEISURE_SPOT_DEFS.length
  );
  let cursor = 0;

  const enemies: EnemyInstance[] = ENEMY_DEFS.map((e) => ({
    uid: uid('enemy'),
    defId: e.id,
    name: e.name,
    emoji: e.emoji,
    ...positions[cursor++],
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
    ...positions[cursor++],
    resource: m.resource,
    amount: m.amount,
    collected: false,
    respawnAt: null,
  }));
  const treasures: TreasureNodeInstance[] = TREASURE_DEFS.map((t) => ({
    uid: uid('treasure'),
    defId: t.id,
    name: t.name,
    ...positions[cursor++],
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
    ...positions[cursor++],
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

    // Each bird acts independently; sort so the vanguard decides first, so
    // assist personalities can read its decision this same tick.
    const nextBirds = birdsWithMood.sort(
      (a, b) => PERSONALITY_ORDER[getCharacterDef(a.defId).personality] - PERSONALITY_ORDER[getCharacterDef(b.defId).personality]
    );
    const vanguard = nextBirds.find((b) => getCharacterDef(b.defId).personality === 'vanguard') ?? null;
    const aiWorld: AiWorld = {
      enemies,
      miningNodes,
      treasures,
      leisureSpots: world.leisureSpots,
      requests,
      vanguard,
      allBirds: nextBirds,
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
        birds: healedBirds,
        requests,
      },
    });
  },
}));

// Kept for potential external scoring/inspection (e.g. debugging tools).
export { scoreRequestAcceptance };
