import { CharacterDef } from '../types';

// 主人公の4羽のコザクラインコ。
export const CHARACTERS: CharacterDef[] = [
  {
    id: 'tororo',
    name: 'トロロ',
    role: 'attacker',
    description: '戦士・HP高め',
    color: '#4caf7d',
    emoji: '🟢',
    baseAtk: 10,
    baseHp: 70,
    summonCost: 12,
  },
  {
    id: 'vivi',
    name: 'ビビ',
    role: 'attacker',
    description: '魔法・遠距離攻撃',
    color: '#e0b400',
    emoji: '💛',
    baseAtk: 18,
    baseHp: 25,
    summonCost: 16,
  },
  {
    id: 'haku',
    name: 'ハク',
    role: 'healer',
    description: '回復・バフ',
    color: '#4fb6e0',
    emoji: '🩵',
    baseAtk: 8, // heal power
    baseHp: 35,
    summonCost: 14,
  },
  {
    id: 'mone',
    name: 'モネ',
    role: 'attacker',
    description: '素材集め・レア発見(撃破報酬+20%)',
    color: '#f2c14e',
    emoji: '✨',
    baseAtk: 8,
    baseHp: 30,
    summonCost: 10,
    materialBonusPercent: 20,
  },
];

export function getCharacterDef(defId: string): CharacterDef {
  const def = CHARACTERS.find((c) => c.id === defId);
  if (!def) throw new Error(`Unknown character: ${defId}`);
  return def;
}
