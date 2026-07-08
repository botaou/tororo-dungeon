import { EnemyInstance, MaterialId, SummonedUnit } from '../types';
import { getCharacterDef } from '../data/characters';

export interface CombatRoundResult {
  enemies: EnemyInstance[];
  summonedUnits: SummonedUnit[];
  rewards: Partial<Record<MaterialId, number>>;
  logs: string[];
}

// One round of auto-battle: living attackers hit the front enemy, living
// healers top off the lowest-HP ally instead, every living enemy hits a
// random living unit. Pure function so it stays easy to reason about/test
// independent of store wiring.
export function resolveCombatRound(
  enemies: EnemyInstance[],
  summonedUnits: SummonedUnit[]
): CombatRoundResult {
  const logs: string[] = [];
  const rewards: Partial<Record<MaterialId, number>> = {};

  const nextEnemies = enemies.map((e) => ({ ...e }));
  const nextUnits = summonedUnits.map((u) => ({ ...u }));

  const aliveUnits = nextUnits.filter((u) => u.hp > 0);
  const attackers = aliveUnits.filter((u) => getCharacterDef(u.defId).role === 'attacker');
  const healers = aliveUnits.filter((u) => getCharacterDef(u.defId).role === 'healer');

  for (const healer of healers) {
    const injured = aliveUnits
      .filter((u) => u.hp > 0 && u.hp < u.maxHp)
      .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
    if (injured) {
      injured.hp = Math.min(injured.maxHp, injured.hp + healer.atk);
    }
  }

  const frontEnemy = nextEnemies.find((e) => !e.defeated && e.hp > 0);

  if (frontEnemy && attackers.length > 0) {
    for (const unit of attackers) {
      if (frontEnemy.hp <= 0) break;
      frontEnemy.hp = Math.max(0, frontEnemy.hp - unit.atk);
    }
    if (frontEnemy.hp <= 0) {
      frontEnemy.defeated = true;
      const bonusPercent = aliveUnits.reduce(
        (max, u) => Math.max(max, getCharacterDef(u.defId).materialBonusPercent ?? 0),
        0
      );
      const rewardAmount = Math.round(frontEnemy.rewardAmount * (1 + bonusPercent / 100));
      rewards[frontEnemy.rewardMaterial] = (rewards[frontEnemy.rewardMaterial] ?? 0) + rewardAmount;
      logs.push(`${frontEnemy.name}を倒した！ +${rewardAmount}${frontEnemy.rewardMaterial}`);
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
