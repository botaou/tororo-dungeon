import { CharacterDef } from '../types';

// 主人公の4羽のコザクラインコ。街と外を自分の意思で生活する。
export const CHARACTERS: CharacterDef[] = [
  {
    id: 'tororo',
    name: 'トロロ',
    role: 'attacker',
    personality: 'vanguard',
    description: '元気となつっこさを併せ持つ、賢い性格。気になる敵や未知の場所へまっすぐ向かっていく、頼れる先陣役。',
    roleLabel: '探検・先陣役',
    color: '#4caf7d',
    emoji: '🟢',
    baseAtk: 10,
    baseHp: 70,
    baseDefense: 2,
    baseSpeed: 6,
    baseLuck: 4,
  },
  {
    id: 'vivi',
    name: 'ビビ',
    role: 'attacker',
    personality: 'clingy',
    description: '仲間の近くにいたがる甘えん坊。穏やかな性格で、気づけばすぐ眠ってしまう。誰かと一緒なら依頼も受けやすい、大の食いしん坊。',
    roleLabel: '甘えん坊・のんびり屋',
    color: '#e0b400',
    emoji: '💛',
    baseAtk: 18,
    baseHp: 25,
    baseDefense: 1,
    baseSpeed: 8,
    baseLuck: 5,
  },
  {
    id: 'haku',
    name: 'ハク',
    role: 'healer',
    personality: 'cautious',
    description: 'クールビューティだけど、一度決めたら譲らないしつこい一面も。危険な場所は苦手だけど、仲間の回復や支援では頼りになる。',
    roleLabel: '回復・サポート役',
    color: '#4fb6e0',
    emoji: '🩵',
    baseAtk: 8, // heal power / enraged attack power
    baseHp: 35,
    baseDefense: 5,
    baseSpeed: 3,
    baseLuck: 6,
  },
  {
    id: 'mone',
    name: 'モネ',
    role: 'attacker',
    personality: 'freeSpirit',
    description: '自由人で好奇心旺盛。攻撃力が高く、いざとなれば頼れる火力役。鉱石やお宝を見つけるのも得意(納品+20%)。',
    roleLabel: '自由人・高火力',
    color: '#f2c14e',
    emoji: '✨',
    baseAtk: 15,
    baseHp: 30,
    baseDefense: 3,
    baseSpeed: 5,
    baseLuck: 8,
    materialBonusPercent: 20,
  },
  // Phase 15②: joins once the town's abandoned shrine finishes its own
  // gradual restoration (see game/recruitment.ts's checkAlshel, data/
  // shrine.ts's SHRINE_STAGE_DEFS) — not one of the other 4 birds' own
  // triggers, and not offered on the starter picker (see isStarter below).
  {
    id: 'alshel',
    name: 'アルシェル',
    role: 'healer',
    personality: 'cautious',
    description: '街はずれの廃神社に長いこと眠っていた、物静かな鳥。街が育っていく気配を感じ取って、少しずつ姿を見せるようになった。',
    roleLabel: '癒し・見守り役',
    color: '#b9a4e0',
    emoji: '🤍',
    baseAtk: 12,
    baseHp: 40,
    baseDefense: 6,
    baseSpeed: 4,
    baseLuck: 7,
    isStarter: false,
  },
];

export function getCharacterDef(defId: string): CharacterDef {
  const def = CHARACTERS.find((c) => c.id === defId);
  if (!def) throw new Error(`Unknown character: ${defId}`);
  return def;
}
