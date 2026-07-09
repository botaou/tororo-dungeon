import {
  BirdState,
  CharacterDef,
  EnemyInstance,
  JobRequest,
  LeisureSpotInstance,
  MiningNodeInstance,
  TreasureNodeInstance,
} from '../types';
import {
  ARRIVAL_THRESHOLD,
  ENCOUNTER_HOLD_TICKS,
  HOME_NEED_TICKS,
  LEISURE_CHANCE,
  LEISURE_DWELL_TICKS,
  MOVE_SPEED,
} from './config';
import { TOWN_RADIUS, TOWN_X, TOWN_Y } from '../data/world';
import { AttackAssignment } from './combat';

// How close an enemy needs to get to the cautious personality before she
// panics and fights back, and how much harder she hits while enraged.
export const PANIC_RADIUS = 0.16;
export const ENRAGED_MULTIPLIER = 2.5;
// How close the vanguard must be to its target before assist personalities
// (clingy) can land ranged hits on it — otherwise they'd be sniping enemies
// the vanguard hasn't actually reached yet.
const ASSIST_RADIUS = 0.2;
// A fainted bird (hp hit 0) rests in place and slowly recovers before
// resuming any activity, rather than vanishing or teleporting home.
const FAINT_RECOVERY_PER_TICK = 5;

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

function nearestWithinRadius<T extends { x: number; y: number }>(
  items: T[],
  x: number,
  y: number,
  radius: number
): T | null {
  const found = nearest(items, x, y);
  if (!found) return null;
  return Math.hypot(found.x - x, found.y - y) <= radius ? found : null;
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
  vanguard: BirdState | null; // this tick's vanguard, already stepped
  allBirds: BirdState[]; // shared, mutated in place as each bird steps
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

// Every bird always resolves to *some* concrete thing to do, in priority
// order: recover if fainted, finish a job if it took one, satisfy hunger/
// sleep at home, then fall back to its personality's own drive — which
// itself always ends in either a leisure visit or a purposeful walk, never
// an undefined "nothing to do" limbo.
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

  switch (def.personality) {
    case 'vanguard':
      return stepVanguard(bird, def, world);
    case 'freeSpirit':
      return stepFreeSpirit(bird, def, world);
    case 'clingy':
      return stepClingy(bird, def, world);
    case 'cautious':
      return stepCautious(bird, def, world);
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

function stepWander(bird: BirdState, bounds: 'field' | 'town'): AiStepOutcome {
  const hasDest = bird.wanderX !== null && bird.wanderY !== null;
  const arrived = hasDest ? moveToward(bird, bird.wanderX!, bird.wanderY!) : true;
  if (!hasDest || arrived) {
    const dest = bounds === 'town' ? randomPointNearTown(TOWN_RADIUS * 1.6) : randomPointInField();
    bird.wanderX = dest.x;
    bird.wanderY = dest.y;
  }
  bird.targetKind = 'wander';
  bird.targetRefUid = null;
  bird.activity = 'idle';
  return emptyOutcome();
}

// The "I have nothing pressing to do" fallback: sometimes go bathe/fish at
// a leisure spot, otherwise take a purposeful walk. Never just freezes.
function stepLeisureOrWander(bird: BirdState, world: AiWorld, bounds: 'field' | 'town'): AiStepOutcome {
  const outcome = emptyOutcome();

  if (bird.targetKind === 'river' || bird.targetKind === 'pond') {
    const spot = world.leisureSpots.find((s) => s.uid === bird.targetRefUid);
    if (spot) {
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
      return outcome;
    }
    bird.targetKind = null;
    bird.targetRefUid = null;
  }

  if (bird.targetKind === 'wander') {
    return stepWander(bird, bounds);
  }

  if (world.leisureSpots.length > 0 && Math.random() < LEISURE_CHANCE) {
    const spot = nearest(world.leisureSpots, bird.x, bird.y);
    if (spot) {
      bird.targetKind = spot.kind;
      bird.targetRefUid = spot.uid;
      bird.workProgress = 0;
      bird.activity = spot.kind === 'river' ? 'bathing' : 'fishing';
      return outcome;
    }
  }

  return stepWander(bird, bounds);
}

// Tororo: seeks out the nearest enemy to fight; with nothing dangerous
// around, he roams the whole field (or hangs near town if he's itching
// for a paid job) looking for something new.
function stepVanguard(bird: BirdState, def: CharacterDef, world: AiWorld): AiStepOutcome {
  const outcome = emptyOutcome();
  const aliveEnemies = world.enemies.filter((e) => !e.defeated && e.hp > 0);

  if (aliveEnemies.length === 0) {
    return stepLeisureOrWander(bird, world, bird.mood === 'wantsMoney' ? 'town' : 'field');
  }

  if (!bird.targetRefUid || !aliveEnemies.some((e) => e.uid === bird.targetRefUid)) {
    const target = nearest(aliveEnemies, bird.x, bird.y);
    bird.targetKind = target ? 'enemy' : null;
    bird.targetRefUid = target?.uid ?? null;
  }
  if (!bird.targetRefUid) return stepLeisureOrWander(bird, world, 'field');

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

// Mone: prioritizes the nearest unclaimed rock/treasure; with nothing left
// to gather, she relaxes or wanders looking for more.
function stepFreeSpirit(bird: BirdState, def: CharacterDef, world: AiWorld): AiStepOutcome {
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
      bird.targetRefUid = null;
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

  return stepLeisureOrWander(bird, world, bird.mood === 'wantsMoney' ? 'town' : 'field');
}

// The enemy the vanguard is close enough to for assist personalities to
// meaningfully pitch in on — null if it hasn't picked one, or hasn't
// gotten near it yet.
function vanguardEngagedEnemy(world: AiWorld): EnemyInstance | null {
  const vanguard = world.vanguard;
  if (!vanguard || vanguard.hp <= 0 || vanguard.targetKind !== 'enemy' || !vanguard.targetRefUid) return null;
  const enemy = world.enemies.find((e) => e.uid === vanguard.targetRefUid && !e.defeated && e.hp > 0);
  if (!enemy) return null;
  const dist = Math.hypot(enemy.x - vanguard.x, enemy.y - vanguard.y);
  return dist <= ASSIST_RADIUS ? enemy : null;
}

// Vivi: sticks close to the vanguard wherever it goes, and pitches in
// ranged damage once it's actually engaged with something nearby.
function stepClingy(bird: BirdState, def: CharacterDef, world: AiWorld): AiStepOutcome {
  const outcome = emptyOutcome();
  if (!world.vanguard || world.vanguard.hp <= 0) {
    return stepLeisureOrWander(bird, world, 'town');
  }
  moveToward(bird, world.vanguard.x - 0.055, world.vanguard.y + 0.035);
  bird.targetKind = null;
  bird.targetRefUid = null;
  const engaged = vanguardEngagedEnemy(world);
  if (engaged) {
    bird.activity = 'enemy';
    outcome.assignments.push({
      unitUid: bird.defId,
      enemyUid: engaged.uid,
      damage: bird.atk,
      materialBonusPercent: def.materialBonusPercent ?? 0,
    });
  } else {
    bird.activity = 'idle';
  }
  return outcome;
}

// Haku: stays near town, healing from a distance — unless an enemy gets
// within her panic radius, at which point she fights fiercely from where
// she stands instead of retreating.
function stepCautious(bird: BirdState, def: CharacterDef, world: AiWorld): AiStepOutcome {
  const outcome = emptyOutcome();
  const aliveEnemies = world.enemies.filter((e) => !e.defeated && e.hp > 0);
  const threat = nearestWithinRadius(aliveEnemies, bird.x, bird.y, PANIC_RADIUS);

  if (threat) {
    bird.activity = 'enemy';
    outcome.assignments.push({
      unitUid: bird.defId,
      enemyUid: threat.uid,
      damage: Math.round(bird.atk * ENRAGED_MULTIPLIER),
      materialBonusPercent: def.materialBonusPercent ?? 0,
    });
    return outcome;
  }

  return stepLeisureOrWander(bird, world, 'town');
}

// Any bird with an accepted job heads for the nearest unclaimed node of the
// requested material, delivers it, and collects the bounty on completion.
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
      return stepWander(bird, 'town');
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
