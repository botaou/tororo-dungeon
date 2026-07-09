import { CharacterDef } from '../types';

// 主人公の4羽のコザクラインコ。街と外を自分の意思で生活する。
export const CHARACTERS: CharacterDef[] = [
  {
    id: 'tororo',
    name: 'トロロ',
    role: 'attacker',
    personality: 'vanguard',
    description: '好奇心旺盛・外に出たがる、敵や未知の場所に向かいやすい',
    color: '#4caf7d',
    emoji: '🟢',
    baseAtk: 10,
    baseHp: 70,
  },
  {
    id: 'vivi',
    name: 'ビビ',
    role: 'attacker',
    personality: 'clingy',
    description: '甘えん坊・仲間の近くにいたい、誰かと一緒なら依頼も受けやすい',
    color: '#e0b400',
    emoji: '💛',
    baseAtk: 18,
    baseHp: 25,
  },
  {
    id: 'haku',
    name: 'ハク',
    role: 'healer',
    personality: 'cautious',
    description: '慎重・危険地帯は嫌がる、回復や支援が得意',
    color: '#4fb6e0',
    emoji: '🩵',
    baseAtk: 8, // heal power / enraged attack power
    baseHp: 35,
  },
  {
    id: 'mone',
    name: 'モネ',
    role: 'attacker',
    personality: 'freeSpirit',
    description: '自由人・鉱石や宝箱が好き、敵より資源を優先(納品+20%)',
    color: '#f2c14e',
    emoji: '✨',
    baseAtk: 8,
    baseHp: 30,
    materialBonusPercent: 20,
  },
];

export function getCharacterDef(defId: string): CharacterDef {
  const def = CHARACTERS.find((c) => c.id === defId);
  if (!def) throw new Error(`Unknown character: ${defId}`);
  return def;
}
