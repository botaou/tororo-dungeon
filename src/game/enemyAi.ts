// Enemy movement AI — independent of the birds' AI in ai.ts. An enemy
// patrols near its anchor point when nothing's around, chases whichever
// bird wanders within aggro range, and gives up (walking back to its
// anchor) once the target's gone or too far away. Purely positional: the
// bird's own AI still decides when to actually attack once it's close
// enough (see ai.ts's executeCombat), and combat.ts still resolves damage —
// this module never touches hp/damage.

import { BirdState, EnemyInstance } from '../types';
import { TOWN_X, TOWN_Y } from '../data/world';
import {
  ARRIVAL_THRESHOLD,
  ENEMY_AGGRO_RANGE,
  ENEMY_CHASE_GIVEUP_RANGE,
  ENEMY_MOVE_SPEED,
  ENEMY_PATROL_RADIUS,
  ENEMY_RESPAWN_POSITION_RADIUS,
} from './config';

// Whether a point has crossed into the town's "core" ellipse (see
// townGrid.ts's getTownZoneRadius) — used only to keep a chasing enemy from
// following a fleeing bird all the way into town. Static enemy anchors are
// already verified to sit outside this fixed radius (see data/townGrid.ts's
// TOWN_ZONE_RADIUS comment), but that check says nothing about where a
// *chase* can wander, since chasing just walks straight at the target's
// live position with no boundary awareness.
function isInsideTownZone(x: number, y: number, zoneRadius: { rx: number; ry: number }): boolean {
  const dx = (x - TOWN_X) / zoneRadius.rx;
  const dy = (y - TOWN_Y) / zoneRadius.ry;
  return dx * dx + dy * dy <= 1;
}

function moveToward(e: EnemyInstance, tx: number, ty: number): boolean {
  const dx = tx - e.x;
  const dy = ty - e.y;
  const dist = Math.hypot(dx, dy);
  if (dist <= ARRIVAL_THRESHOLD) return true;
  const step = Math.min(dist, ENEMY_MOVE_SPEED);
  e.x += (dx / dist) * step;
  e.y += (dy / dist) * step;
  return false;
}

function randomPointNear(anchorX: number, anchorY: number, radius: number): { x: number; y: number } {
  const angle = Math.random() * Math.PI * 2;
  const dist = Math.random() * radius;
  return {
    x: Math.min(0.94, Math.max(0.06, anchorX + Math.cos(angle) * dist)),
    y: Math.min(0.9, Math.max(0.1, anchorY + Math.sin(angle) * dist)),
  };
}

// One enemy's movement for this tick. Priority: keep chasing its current
// target if still in range → notice and start chasing a newly-nearby bird
// → walk back to its anchor if it just gave up a chase → wander near its
// anchor otherwise. `zoneRadius` is the town's current core ellipse (see
// townGrid.ts's getTownZoneRadius) — a bird that's inside it is treated as
// "safe home turf" and dropped from consideration entirely, so an enemy
// never starts (or continues) chasing into town.
export function stepEnemy(enemy: EnemyInstance, birds: BirdState[], zoneRadius: { rx: number; ry: number }): EnemyInstance {
  const next = { ...enemy };
  const aliveBirds = birds.filter((b) => b.isRecruited && b.hp > 0 && !isInsideTownZone(b.x, b.y, zoneRadius));

  if (next.roamState === 'chase') {
    const target = aliveBirds.find((b) => b.defId === next.chaseTargetId);
    const dist = target ? Math.hypot(target.x - next.x, target.y - next.y) : Infinity;
    if (!target || dist > ENEMY_CHASE_GIVEUP_RANGE) {
      next.roamState = 'return';
      next.chaseTargetId = null;
    } else {
      const prevX = next.x;
      const prevY = next.y;
      moveToward(next, target.x, target.y);
      if (isInsideTownZone(next.x, next.y, zoneRadius)) {
        // The straight-line path toward the target clipped the town zone
        // even though the target itself is just outside it — stop right
        // here instead of stepping in, and give up the chase.
        next.x = prevX;
        next.y = prevY;
        next.roamState = 'return';
        next.chaseTargetId = null;
      } else {
        return next;
      }
    }
  }

  if (next.roamState !== 'return') {
    let nearestBird: BirdState | null = null;
    let nearestDist = Infinity;
    for (const b of aliveBirds) {
      const d = Math.hypot(b.x - next.x, b.y - next.y);
      if (d < nearestDist) {
        nearestDist = d;
        nearestBird = b;
      }
    }
    if (nearestBird && nearestDist <= ENEMY_AGGRO_RANGE) {
      next.roamState = 'chase';
      next.chaseTargetId = nearestBird.defId;
      next.wanderX = null;
      next.wanderY = null;
      moveToward(next, nearestBird.x, nearestBird.y);
      return next;
    }
  }

  if (next.roamState === 'return') {
    const arrived = moveToward(next, next.anchorX, next.anchorY);
    if (arrived) next.roamState = 'patrol';
    return next;
  }

  next.roamState = 'patrol';
  if (next.wanderX === null || next.wanderY === null) {
    const dest = randomPointNear(next.anchorX, next.anchorY, ENEMY_PATROL_RADIUS);
    next.wanderX = dest.x;
    next.wanderY = dest.y;
  }
  const arrived = moveToward(next, next.wanderX, next.wanderY);
  if (arrived) {
    next.wanderX = null;
    next.wanderY = null;
  }
  return next;
}

// Where a defeated enemy reappears — near its original design-time spot
// (homeX/homeY, from its EnemyDef) rather than exactly on top of it, and
// becomes its new patrol anchor for this life, so each respawn visibly
// relocates within its zone instead of always landing on the same pixel.
export function respawnPosition(homeX: number, homeY: number): { x: number; y: number } {
  return randomPointNear(homeX, homeY, ENEMY_RESPAWN_POSITION_RADIUS);
}
