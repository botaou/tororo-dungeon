import { EquipmentSetDef } from '../types';

// Set-effect mechanism (request item 4: "セット効果...今回は仕組みだけ") —
// wearing several pieces tagged with the same setId (see data/items.ts)
// grants an extra bonus on top of each piece's own statBonus. Only two
// sample sets exist so far, both spanning the 4 armor slots (head/body/
// hand/foot) at a single rarity tier each — a set never includes a weapon,
// since a bird only ever has one weapon slot, so a "weapon + armor set"
// would only ever be satisfiable by birds who happened to pick that exact
// weapon line, unlike armor which every bird always has all 4 slots for.
export const EQUIPMENT_SETS: EquipmentSetDef[] = [
  {
    id: 'forestSet',
    name: '森のセット',
    itemIds: ['headFlower', 'bodyTunic', 'handMitten', 'footFlower'],
    bonusTiers: [
      { piecesRequired: 2, statBonus: { defense: 3 }, label: '森の加護 (DEF+3)' },
      { piecesRequired: 4, statBonus: { atk: 2, defense: 2, speed: 2, luck: 2 }, label: '森の全開放 (全ステ+2)' },
    ],
  },
  {
    id: 'starSet',
    name: '星のセット',
    itemIds: ['headForest', 'bodyDress', 'handFlowerGlove', 'footForest'],
    bonusTiers: [
      { piecesRequired: 2, statBonus: { defense: 5, luck: 3 }, label: '星の守り (DEF+5 LUK+3)' },
      { piecesRequired: 4, statBonus: { atk: 4, defense: 4, speed: 4, luck: 4, hp: 10 }, label: '星の祝福 (全ステ+4 HP+10)' },
    ],
  },
];

export const EQUIPMENT_SET_MAP: Record<string, EquipmentSetDef> = Object.fromEntries(
  EQUIPMENT_SETS.map((s) => [s.id, s])
);
