import { ItemStatBonus } from '../types';

// A bird's permanent skill, acquired via Phase 11's rare "ひらめき"
// (inspiration) roll while playing at a park/bathhouse (see ai.ts's
// executePlay). Deliberately scoped to a flat stat bonus, merged the exact
// same way an equipped item's statBonus already is (see game/birdStats.ts's
// getEffectiveStats) — a skill behaves like an invisible extra piece of
// equipment that can never be unequipped, rather than a new mechanic of its
// own. This keeps the whole feature low-risk: no new drop-rate rolls, no new
// combat hooks, nothing that could touch the job/mining/combat systems that
// have already been the source of several real-device bugs this project.
//
// The design request's own example for 幸運体質 was "ドロップ率アップ" (a
// drop-rate bonus) — substituted here for a flat luck-stat bump instead,
// since luck isn't consumed by any drop-rate roll yet either; wiring an
// actual drop-rate mechanic is a bigger, separate change than this pass's
// scope.
export interface BirdSkillDef {
  id: string;
  name: string;
  description: string;
  statBonus: ItemStatBonus;
}

export const BIRD_SKILL_DEFS: BirdSkillDef[] = [
  { id: 'full_vigor', name: '体力全開', description: '攻撃力に小さなボーナスがかかる', statBonus: { atk: 1 } },
  { id: 'sturdy_body', name: '頑丈な体', description: '防御力に小さなボーナスがかかる', statBonus: { defense: 1 } },
  { id: 'swift_feet', name: '俊足', description: '素早さに小さなボーナスがかかる', statBonus: { speed: 1 } },
  { id: 'lucky_body', name: '幸運体質', description: '運に小さなボーナスがかかる', statBonus: { luck: 2 } },
];

export const BIRD_SKILL_DEF_MAP: Record<string, BirdSkillDef> = Object.fromEntries(
  BIRD_SKILL_DEFS.map((s) => [s.id, s])
);
