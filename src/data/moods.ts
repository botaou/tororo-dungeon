import { MoodDef, MoodId } from '../types';

export const MOODS: MoodDef[] = [
  { id: 'normal', label: '' },
  { id: 'sleepy', label: '眠い' },
  { id: 'happy', label: 'ご機嫌' },
  { id: 'hungry', label: 'お腹すいた' },
  { id: 'wantsMoney', label: 'お金が欲しい' },
];

export function getMoodDef(id: MoodId): MoodDef {
  return MOODS.find((m) => m.id === id) ?? MOODS[0];
}

// 'hungry' is deliberately not in this table — it's now driven by the
// satiety meter (see SATIETY_HUNGRY_THRESHOLD in game/config.ts) instead of
// being randomly rolled, so hunger reflects an actual need rather than luck.
export function rollRandomMood(): MoodId {
  // Weighted so birds are "normal" most of the time.
  const roll = Math.random();
  if (roll < 0.55) return 'normal';
  if (roll < 0.72) return 'sleepy';
  if (roll < 0.9) return 'happy';
  return 'wantsMoney';
}
