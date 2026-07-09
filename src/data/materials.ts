import { MaterialId } from '../types';

// Single source of truth for how each material is labeled/iconified,
// shared by the top bar, request board, etc.
export const MATERIAL_LABEL: Record<MaterialId, string> = {
  wood: '木材',
  ore: '鉱石',
  mushroom: 'キノコ',
  berry: '木の実',
  herb: '薬草',
  feather: '羽根',
  gem: '宝石',
  coal: '石炭',
  fish: '魚',
  pearl: '真珠',
  waterweed: '水草',
  relic: '遺物',
  magicStone: '魔石',
  oldCoin: '古いコイン',
};

export const MATERIAL_ICON: Record<MaterialId, string> = {
  wood: '🪵',
  ore: '⛏️',
  mushroom: '🍄',
  berry: '🌰',
  herb: '🌿',
  feather: '🪶',
  gem: '💎',
  coal: '⚫',
  fish: '🐟',
  pearl: '🦪',
  waterweed: '🌱',
  relic: '🏺',
  magicStone: '🔮',
  oldCoin: '🟠',
};
