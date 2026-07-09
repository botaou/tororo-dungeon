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

export function rollRandomMood(): MoodId {
  // Weighted so birds are "normal" most of the time.
  const roll = Math.random();
  if (roll < 0.5) return 'normal';
  if (roll < 0.65) return 'sleepy';
  if (roll < 0.8) return 'happy';
  if (roll < 0.9) return 'hungry';
  return 'wantsMoney';
}
