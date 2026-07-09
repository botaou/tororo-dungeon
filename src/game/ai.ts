import {
  ActivityCategory,
  BirdState,
  CharacterDef,
  EnemyInstance,
  JobRequest,
  LeisureSpotInstance,
  MiningNodeInstance,
  Personality,
  TreasureNodeInstance,
} from '../types';
import {
  ARRIVAL_THRESHOLD,
  ENCOUNTER_HOLD_TICKS,
  HOME_NEED_TICKS,
  LEISURE_CHANCE,
  LEISURE_DWELL_TICKS,
  MIN_BIRD_DISTANCE,
  MOVE_SPEED,
} from './config';
import { TOWN_RADIUS, TOWN_X, TOWN_Y } from '../data/world';
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
}

export interface AiStepOutcome {
  assignments: AttackAssignment[];
  materialsCollected: Partial<Record<string, number>>;
  treasureCollectedUid: string | null;
  miningCollectedUid: string | null;
  jobCompletedId: string | null;
}

function emptyOutcome(): AiStepOutcome {
  return {
    assignments: [],
    materialsCollected: {},
    treasureCollectedUid: null,
    miningCollectedUid: null,
    jobCompletedId: null,
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

  if (bird.mood === 'hungry') {
    return stepHomeNeed(bird, 'eating');
  }
  if (bird.mood === 'sleepy') {
    return stepHomeNeed(bird, 'resting');
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

// Hungry → go home and eat. Sleepy → go home and rest. Either way, once
// satisfied for HOME_NEED_TICKS the mood clears back to normal instead of
// waiting on the ambient mood-refresh timer.
function stepHomeNeed(bird: BirdState, activity: 'eating' | 'resting'): AiStepOutcome {
  if (bird.activity !== activity) {
    bird.workProgress = 0;
  }
  const arrived = moveToward(bird, TOWN_X, TOWN_Y);
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
      damage: bird.atk,
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
          outcome.materialsCollected[node.resource] = (outcome.materialsCollected[node.resource] ?? 0) + node.amount;
          outcome.miningCollectedUid = node.uid;
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
