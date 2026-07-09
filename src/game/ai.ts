import {
  CharacterDef,
  EnemyInstance,
  MiningNodeInstance,
  SummonedUnit,
  TreasureNodeInstance,
} from '../types';
import { ARRIVAL_THRESHOLD, ENCOUNTER_HOLD_TICKS, PARTY_MOVE_SPEED } from './config';
import { AttackAssignment } from './combat';

// How close an enemy needs to get to the cautious personality before she
// panics and fights back, and how much harder she hits while enraged.
export const PANIC_RADIUS = 0.16;
export const ENRAGED_MULTIPLIER = 2.5;
// How close the vanguard must be to its target before assist personalities
// (clingy/free-spirit) can land ranged hits on it — otherwise they'd be
// sniping enemies the vanguard hasn't actually reached yet.
const ASSIST_RADIUS = 0.2;
const CAMP_X = 0.5;
const CAMP_Y = 0.5;

// Moves `unit` a constant-speed step toward (tx, ty); returns true once
// within arrival range (and stops moving) rather than overshooting.
function moveToward(unit: SummonedUnit, tx: number, ty: number): boolean {
  const dx = tx - unit.x;
  const dy = ty - unit.y;
  const dist = Math.hypot(dx, dy);
  if (dist <= ARRIVAL_THRESHOLD) return true;
  const step = Math.min(dist, PARTY_MOVE_SPEED);
  unit.x += (dx / dist) * step;
  unit.y += (dy / dist) * step;
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

// The enemy the vanguard is close enough to for assist personalities to
// meaningfully pitch in on — null if it hasn't picked a target yet, or
// hasn't gotten near it.
function vanguardEngagedEnemy(world: AiWorld): EnemyInstance | null {
  const vanguard = world.vanguard;
  if (!vanguard || vanguard.hp <= 0 || vanguard.targetKind !== 'enemy' || !vanguard.targetRefUid) return null;
  const enemy = world.enemies.find((e) => e.uid === vanguard.targetRefUid && !e.defeated && e.hp > 0);
  if (!enemy) return null;
  const dist = Math.hypot(enemy.x - vanguard.x, enemy.y - vanguard.y);
  return dist <= ASSIST_RADIUS ? enemy : null;
}

export interface AiWorld {
  enemies: EnemyInstance[];
  miningNodes: MiningNodeInstance[];
  treasure: TreasureNodeInstance | null;
  vanguard: SummonedUnit | null; // this tick's vanguard, already stepped
  allUnits: SummonedUnit[]; // shared, mutated in place as each unit steps
}

export interface AiStepOutcome {
  assignments: AttackAssignment[];
  materialsCollected: Partial<Record<string, number>>;
  treasureCollectedUid: string | null;
  miningCollectedUid: string | null;
}

function emptyOutcome(): AiStepOutcome {
  return { assignments: [], materialsCollected: {}, treasureCollectedUid: null, miningCollectedUid: null };
}

export function stepUnit(unit: SummonedUnit, def: CharacterDef, world: AiWorld): AiStepOutcome {
  switch (def.personality) {
    case 'vanguard':
      return stepVanguard(unit, def, world);
    case 'freeSpirit':
      return stepFreeSpirit(unit, def, world);
    case 'clingy':
      return stepClingy(unit, def, world);
    case 'cautious':
      return stepCautious(unit, def, world);
  }
}

// Tororo: beelines for whichever enemy is nearest and fights it in melee.
function stepVanguard(unit: SummonedUnit, def: CharacterDef, world: AiWorld): AiStepOutcome {
  const outcome = emptyOutcome();
  const aliveEnemies = world.enemies.filter((e) => !e.defeated && e.hp > 0);

  if (!unit.targetRefUid || !aliveEnemies.some((e) => e.uid === unit.targetRefUid)) {
    const target = nearest(aliveEnemies, unit.x, unit.y);
    unit.targetKind = target ? 'enemy' : null;
    unit.targetRefUid = target?.uid ?? null;
  }

  if (!unit.targetRefUid) {
    unit.activity = 'idle';
    return outcome;
  }

  const enemy = aliveEnemies.find((e) => e.uid === unit.targetRefUid)!;
  const arrived = moveToward(unit, enemy.x, enemy.y);
  unit.activity = 'enemy';
  if (arrived) {
    outcome.assignments.push({
      unitUid: unit.uid,
      enemyUid: enemy.uid,
      damage: unit.atk,
      materialBonusPercent: def.materialBonusPercent ?? 0,
    });
  }
  return outcome;
}

// Mone: prioritizes the nearest unclaimed rock/treasure; once nothing's
// left to gather, she pitches in on the vanguard's fight instead.
function stepFreeSpirit(unit: SummonedUnit, def: CharacterDef, world: AiWorld): AiStepOutcome {
  const outcome = emptyOutcome();
  const uncollectedMining = world.miningNodes.filter((m) => !m.collected);
  const treasureAvailable = world.treasure && !world.treasure.collected ? world.treasure : null;

  const stillValid =
    (unit.targetKind === 'mining' && uncollectedMining.some((m) => m.uid === unit.targetRefUid)) ||
    (unit.targetKind === 'treasure' && treasureAvailable?.uid === unit.targetRefUid);

  if (!stillValid) {
    const nearestMining = nearest(uncollectedMining, unit.x, unit.y);
    const nearestMiningDist = nearestMining ? Math.hypot(nearestMining.x - unit.x, nearestMining.y - unit.y) : Infinity;
    const nearestTreasureDist = treasureAvailable
      ? Math.hypot(treasureAvailable.x - unit.x, treasureAvailable.y - unit.y)
      : Infinity;

    if (nearestMiningDist === Infinity && nearestTreasureDist === Infinity) {
      unit.targetKind = null;
      unit.targetRefUid = null;
    } else if (nearestMiningDist <= nearestTreasureDist) {
      unit.targetKind = 'mining';
      unit.targetRefUid = nearestMining!.uid;
    } else {
      unit.targetKind = 'treasure';
      unit.targetRefUid = treasureAvailable!.uid;
    }
    unit.workProgress = 0;
  }

  if (unit.targetKind === 'mining' && unit.targetRefUid) {
    const node = uncollectedMining.find((m) => m.uid === unit.targetRefUid);
    if (node) {
      const arrived = moveToward(unit, node.x, node.y);
      unit.activity = 'mining';
      if (arrived) {
        unit.workProgress += 1;
        if (unit.workProgress >= ENCOUNTER_HOLD_TICKS) {
          outcome.materialsCollected[node.resource] = (outcome.materialsCollected[node.resource] ?? 0) + node.amount;
          outcome.miningCollectedUid = node.uid;
          unit.targetKind = null;
          unit.targetRefUid = null;
          unit.workProgress = 0;
        }
      }
      return outcome;
    }
  }

  if (unit.targetKind === 'treasure' && unit.targetRefUid && treasureAvailable) {
    const arrived = moveToward(unit, treasureAvailable.x, treasureAvailable.y);
    unit.activity = 'treasure';
    if (arrived) {
      unit.workProgress += 1;
      if (unit.workProgress >= ENCOUNTER_HOLD_TICKS) {
        // Reward is applied by the store via usePlayerStore.collectTreasure
        // (which also flips the persisted stageProgress flag) — don't also
        // stuff it into materialsCollected or it'll be double-counted.
        outcome.treasureCollectedUid = treasureAvailable.uid;
        unit.targetKind = null;
        unit.targetRefUid = null;
        unit.workProgress = 0;
      }
    }
    return outcome;
  }

  // Nothing left to gather — assist the vanguard's fight instead, once it's
  // actually close enough to whatever it's fighting.
  if (world.vanguard && world.vanguard.hp > 0) {
    moveToward(unit, world.vanguard.x, world.vanguard.y);
    const engaged = vanguardEngagedEnemy(world);
    if (engaged) {
      unit.activity = 'enemy';
      outcome.assignments.push({
        unitUid: unit.uid,
        enemyUid: engaged.uid,
        damage: unit.atk,
        materialBonusPercent: def.materialBonusPercent ?? 0,
      });
    } else {
      unit.activity = 'idle';
    }
  } else {
    unit.activity = 'idle';
  }
  return outcome;
}

// Vivi: always sticks close behind the vanguard and pitches in ranged
// damage on whatever it's fighting — never picks a target herself.
function stepClingy(unit: SummonedUnit, def: CharacterDef, world: AiWorld): AiStepOutcome {
  const outcome = emptyOutcome();
  if (!world.vanguard || world.vanguard.hp <= 0) {
    unit.activity = 'idle';
    return outcome;
  }
  moveToward(unit, world.vanguard.x - 0.055, world.vanguard.y + 0.035);
  const engaged = vanguardEngagedEnemy(world);
  if (engaged) {
    unit.activity = 'enemy';
    outcome.assignments.push({
      unitUid: unit.uid,
      enemyUid: engaged.uid,
      damage: unit.atk,
      materialBonusPercent: def.materialBonusPercent ?? 0,
    });
  } else {
    unit.activity = 'idle';
  }
  return outcome;
}

// Haku: hangs back behind the group (pulled slightly toward camp) and just
// heals — unless an enemy gets within her panic radius, at which point she
// stops retreating and fights fiercely from where she stands.
function stepCautious(unit: SummonedUnit, def: CharacterDef, world: AiWorld): AiStepOutcome {
  const outcome = emptyOutcome();
  const aliveEnemies = world.enemies.filter((e) => !e.defeated && e.hp > 0);
  const threat = aliveEnemies
    .map((e) => ({ e, d: Math.hypot(e.x - unit.x, e.y - unit.y) }))
    .filter((t) => t.d <= PANIC_RADIUS)
    .sort((a, b) => a.d - b.d)[0];

  if (threat) {
    unit.activity = 'enemy';
    outcome.assignments.push({
      unitUid: unit.uid,
      enemyUid: threat.e.uid,
      damage: Math.round(unit.atk * ENRAGED_MULTIPLIER),
      materialBonusPercent: def.materialBonusPercent ?? 0,
    });
    return outcome;
  }

  const others = world.allUnits.filter((u) => u.uid !== unit.uid && u.hp > 0);
  if (others.length === 0) {
    unit.activity = 'idle';
    return outcome;
  }
  const centroidX = others.reduce((sum, u) => sum + u.x, 0) / others.length;
  const centroidY = others.reduce((sum, u) => sum + u.y, 0) / others.length;
  moveToward(unit, centroidX * 0.7 + CAMP_X * 0.3, centroidY * 0.7 + CAMP_Y * 0.3);
  unit.activity = 'idle';
  return outcome;
}
