import { BirdState, EnemyInstance } from '../types';

export interface AttackAssignment {
  unitUid: string;
  enemyUid: string;
  damage: number;
  materialBonusPercent: number;
}

export interface AttackResult {
  enemies: EnemyInstance[];
  goldReward: number;
  // Enemies that took damage this tick and are still alive hit back once,
  // against a random unit that attacked them.
  retaliations: { enemyUid: string; damage: number }[];
}

// Each bird decides independently whether it's attacking (and what), so
// several distinct enemies can be engaged in the same tick. Group the
// assignments by target enemy and resolve each independently.
export function resolveAttacks(enemies: EnemyInstance[], assignments: AttackAssignment[]): AttackResult {
  const nextEnemies = enemies.map((e) => ({ ...e }));
  let goldReward = 0;
  const retaliations: { enemyUid: string; damage: number }[] = [];

  const byEnemy = new Map<string, AttackAssignment[]>();
  for (const a of assignments) {
    if (!byEnemy.has(a.enemyUid)) byEnemy.set(a.enemyUid, []);
    byEnemy.get(a.enemyUid)!.push(a);
  }

  for (const [enemyUid, hits] of byEnemy) {
    const enemy = nextEnemies.find((e) => e.uid === enemyUid);
    if (!enemy || enemy.defeated || enemy.hp <= 0) continue;

    let bonusPercent = 0;
    for (const hit of hits) {
      if (enemy.hp <= 0) break;
      enemy.hp = Math.max(0, enemy.hp - hit.damage);
      bonusPercent = Math.max(bonusPercent, hit.materialBonusPercent);
    }

    if (enemy.hp <= 0) {
      enemy.defeated = true;
      goldReward += Math.round(enemy.goldReward * (1 + bonusPercent / 100));
    } else {
      retaliations.push({ enemyUid, damage: enemy.atk });
    }
  }

  return { enemies: nextEnemies, goldReward, retaliations };
}

// Healer support: top off the lowest-HP ally (excluding herself) each tick,
// independent of positioning/targeting.
export function applyHealing(birds: BirdState[], healerUid: string, healPower: number): BirdState[] {
  const next = birds.map((b) => ({ ...b }));
  const healer = next.find((b) => b.defId === healerUid);
  if (!healer || healer.hp <= 0) return next;

  const injured = next
    .filter((b) => b.defId !== healerUid && b.hp > 0 && b.hp < b.maxHp)
    .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
  if (injured) {
    injured.hp = Math.min(injured.maxHp, injured.hp + healPower);
  }
  return next;
}
