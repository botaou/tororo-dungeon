import { EnemyInstance, MaterialId, SummonedUnit } from '../types';

export interface CombatRoundResult {
  enemies: EnemyInstance[];
  summonedUnits: SummonedUnit[];
  rewards: Partial<Record<MaterialId, number>>;
  logs: string[];
}

// One round of auto-battle: every living summoned unit hits the front enemy,
// every living enemy hits a random living summoned unit. Pure function so it
// stays easy to reason about/test independent of store wiring.
export function resolveCombatRound(
  enemies: EnemyInstance[],
  summonedUnits: SummonedUnit[]
): CombatRoundResult {
  const logs: string[] = [];
  const rewards: Partial<Record<MaterialId, number>> = {};

  const nextEnemies = enemies.map((e) => ({ ...e }));
  const nextUnits = summonedUnits.map((u) => ({ ...u }));

  const frontEnemy = nextEnemies.find((e) => !e.defeated && e.hp > 0);
  const aliveUnits = nextUnits.filter((u) => u.hp > 0);

  if (frontEnemy && aliveUnits.length > 0) {
    for (const unit of aliveUnits) {
      if (frontEnemy.hp <= 0) break;
      frontEnemy.hp = Math.max(0, frontEnemy.hp - unit.atk);
    }
    if (frontEnemy.hp <= 0) {
      frontEnemy.defeated = true;
      rewards[frontEnemy.rewardMaterial] = (rewards[frontEnemy.rewardMaterial] ?? 0) + frontEnemy.rewardAmount;
      logs.push(`${frontEnemy.name}を倒した！ +${frontEnemy.rewardAmount}${frontEnemy.rewardMaterial}`);
    }
  }

  const aliveEnemies = nextEnemies.filter((e) => !e.defeated && e.hp > 0);
  const survivingUnits = nextUnits.filter((u) => u.hp > 0);
  for (const enemy of aliveEnemies) {
    const targets = survivingUnits.filter((u) => u.hp > 0);
    if (targets.length === 0) break;
    const target = targets[Math.floor(Math.random() * targets.length)];
    target.hp = Math.max(0, target.hp - enemy.atk);
    if (target.hp <= 0) {
      logs.push(`${target.name}が倒された…`);
    }
  }

  const remainingUnits = nextUnits.filter((u) => u.hp > 0);

  return { enemies: nextEnemies, summonedUnits: remainingUnits, rewards, logs };
}
