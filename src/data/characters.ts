import { CharacterDef } from '../types';

export const CHARACTERS: CharacterDef[] = [
  { id: 'knight', name: 'ナイト', baseAtk: 8, baseHp: 60, summonCost: 10 },
  { id: 'mage', name: 'メイジ', baseAtk: 14, baseHp: 30, summonCost: 15 },
];

export function getCharacterDef(defId: string): CharacterDef {
  const def = CHARACTERS.find((c) => c.id === defId);
  if (!def) throw new Error(`Unknown character: ${defId}`);
  return def;
}
