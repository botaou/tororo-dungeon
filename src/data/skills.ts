import { SkillDef, SkillId } from '../types';

export const SKILLS: SkillDef[] = [
  { id: 'atk_up', name: '攻撃強化', description: '召喚キャラの攻撃力+30%' },
  { id: 'hp_up', name: '体力強化', description: '召喚キャラの最大HP+30%' },
  { id: 'energy_regen_up', name: '集中', description: 'エナジー回復速度+50%' },
];

export function getSkillDef(id: SkillId): SkillDef {
  const def = SKILLS.find((s) => s.id === id);
  if (!def) throw new Error(`Unknown skill: ${id}`);
  return def;
}

// Pick a random offer of 3 distinct skills for the player to choose from.
export function rollSkillOffer(): SkillDef[] {
  const shuffled = [...SKILLS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(3, shuffled.length));
}
