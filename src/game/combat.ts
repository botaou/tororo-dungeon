import { EnemyInstance, MaterialId, SummonedUnit } from '../types';
import { getCharacterDef } from '../data/characters';

export interface CombatRoundResult {
  enemies: EnemyInstance[];
  summonedUnits: SummonedUnit[];
  rewards: Partial<Record<MaterialId, number>>;
}

// One round of auto-battle against a specific target enemy: living attackers
// hit it, living healers top off the lowest-HP ally instead, every living
// enemy on the field hits a random living unit back. Pure function so it
// stays easy to reason about/test independent of store wiring.
export function resolveCombatRound(
  enemies: EnemyInstance[],
  summonedUnits: SummonedUnit[],
  targetEnemyUid: string
): CombatRoundResult {
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

  const target = nextEnemies.find((e) => e.uid === targetEnemyUid && !e.defeated && e.hp > 0);

  if (target && attackers.length > 0) {
    for (const unit of attackers) {
      if (target.hp <= 0) break;
      target.hp = Math.max(0, target.hp - unit.atk);
    }
    if (target.hp <= 0) {
      target.defeated = true;
      const bonusPercent = aliveUnits.reduce(
        (max, u) => Math.max(max, getCharacterDef(u.defId).materialBonusPercent ?? 0),
        0
      );
      const rewardAmount = Math.round(target.rewardAmount * (1 + bonusPercent / 100));
      rewards[target.rewardMaterial] = (rewards[target.rewardMaterial] ?? 0) + rewardAmount;
    }
  }

  // Only the engaged target fights back — other enemies are elsewhere in
  // the arena and not yet in the fray.
  if (target && target.hp > 0) {
    const survivingUnits = nextUnits.filter((u) => u.hp > 0);
    if (survivingUnits.length > 0) {
      const victim = survivingUnits[Math.floor(Math.random() * survivingUnits.length)];
      victim.hp = Math.max(0, victim.hp - target.atk);
    }
  }

  const remainingUnits = nextUnits.filter((u) => u.hp > 0);

  return { enemies: nextEnemies, summonedUnits: remainingUnits, rewards };
}
