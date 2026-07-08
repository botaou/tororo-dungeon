import { StageDef } from '../types';

export const STAGES: StageDef[] = [
  {
    id: 'stage_1',
    name: '森の入り口',
    staminaCost: 5,
    clearRewardMaterial: 'gold',
    clearRewardAmount: 20,
    enemies: [
      { id: 'slime_a', name: 'スライム', hp: 30, atk: 3, rewardMaterial: 'gold', rewardAmount: 5 },
      { id: 'slime_b', name: 'スライム', hp: 30, atk: 3, rewardMaterial: 'gold', rewardAmount: 5 },
    ],
    miningNodes: [{ id: 'ore_node_1', name: '鉱石の岩', resource: 'ore', amount: 10 }],
  },
  {
    id: 'stage_2',
    name: '洞窟',
    staminaCost: 8,
    clearRewardMaterial: 'gold',
    clearRewardAmount: 40,
    enemies: [
      { id: 'bat_a', name: 'コウモリ', hp: 25, atk: 4, rewardMaterial: 'gold', rewardAmount: 8 },
      { id: 'bat_b', name: 'コウモリ', hp: 25, atk: 4, rewardMaterial: 'gold', rewardAmount: 8 },
      { id: 'bat_c', name: '大コウモリ', hp: 40, atk: 5, rewardMaterial: 'ore', rewardAmount: 6 },
    ],
    miningNodes: [
      { id: 'ore_node_2', name: '鉱石の岩', resource: 'ore', amount: 15 },
      { id: 'gem_node_2', name: '宝石の脈', resource: 'gem', amount: 3 },
    ],
    treasure: { id: 'treasure_2', name: '古びた宝箱', rewardMaterial: 'gold', rewardAmount: 100 },
  },
  {
    id: 'stage_3',
    name: '古代遺跡',
    staminaCost: 12,
    clearRewardMaterial: 'gem',
    clearRewardAmount: 5,
    enemies: [
      { id: 'skeleton_a', name: 'スケルトン', hp: 40, atk: 6, rewardMaterial: 'gold', rewardAmount: 12 },
      { id: 'skeleton_b', name: 'スケルトン', hp: 40, atk: 6, rewardMaterial: 'gold', rewardAmount: 12 },
      { id: 'golem', name: 'ゴーレム', hp: 80, atk: 8, rewardMaterial: 'ore', rewardAmount: 15 },
    ],
    miningNodes: [
      { id: 'ore_node_3', name: '鉱石の岩', resource: 'ore', amount: 20 },
      { id: 'gem_node_3', name: '宝石の脈', resource: 'gem', amount: 5 },
    ],
    treasure: { id: 'treasure_3', name: '封印の宝箱', rewardMaterial: 'gem', rewardAmount: 10 },
  },
  {
    id: 'stage_4',
    name: '竜の巣',
    staminaCost: 20,
    clearRewardMaterial: 'gem',
    clearRewardAmount: 15,
    enemies: [
      { id: 'wyvern_a', name: 'ワイバーン', hp: 100, atk: 10, rewardMaterial: 'gold', rewardAmount: 25 },
      { id: 'wyvern_b', name: 'ワイバーン', hp: 100, atk: 10, rewardMaterial: 'gold', rewardAmount: 25 },
      { id: 'dragon', name: 'ドラゴン', hp: 200, atk: 15, rewardMaterial: 'gem', rewardAmount: 20 },
    ],
    miningNodes: [
      { id: 'ore_node_4', name: '鉱石の岩', resource: 'ore', amount: 30 },
      { id: 'gem_node_4', name: '宝石の脈', resource: 'gem', amount: 8 },
    ],
    treasure: { id: 'treasure_4', name: '竜王の宝箱', rewardMaterial: 'gold', rewardAmount: 500 },
  },
];

export function getStageDef(stageId: string): StageDef {
  const def = STAGES.find((s) => s.id === stageId);
  if (!def) throw new Error(`Unknown stage: ${stageId}`);
  return def;
}

export function getNextStageId(stageId: string): string | null {
  const idx = STAGES.findIndex((s) => s.id === stageId);
  if (idx === -1 || idx === STAGES.length - 1) return null;
  return STAGES[idx + 1].id;
}
