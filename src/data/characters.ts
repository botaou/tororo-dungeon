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
];
// アルシェル is deliberately NOT in this roster — a spec correction from her
// original Phase 15② design. She isn't a recruitable bird at all: she's the
// shrine's own fixed keeper/spirit, who never gathers/fights/shops and never
// leaves the shrine. See data/shrine.ts's ALSHEL_NPC/ALSHEL_REVEAL_TOWN_LEVEL
// and components/WorldMap.tsx's AlshelSprite (modeled on ShopkeeperSprite —
// a fixed, non-interactive NPC — rather than on the bird-AI/recruitment
// pipeline this array feeds).

export function getCharacterDef(defId: string): CharacterDef {
  const def = CHARACTERS.find((c) => c.id === defId);
  if (!def) throw new Error(`Unknown character: ${defId}`);
  return def;
}

// Guard for persisted data that may reference a defId no longer in this
// roster (e.g. a save from before アルシェル was pulled out of CHARACTERS —
// see useBirdEconomyStore's wallets and useTownStore's houses, both of
// which self-heal by dropping/vacating anything that fails this check
// instead of ever calling getCharacterDef on it and crashing at startup).
export function isKnownCharacterId(defId: string): boolean {
  return CHARACTERS.some((c) => c.id === defId);
}
