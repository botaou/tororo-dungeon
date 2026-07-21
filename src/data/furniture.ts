// Phase 15①: the mayor's room's placeable decorations — a handful of sample
// types, per the request's own "まずは数点のサンプルで構いません". Emoji-based
// (same "sample-level, no new reference sheet" call as data/shrine.ts) rather
// than painted art, since this is a brand-new catalog with no existing
// reference sheet to crop from.
//
// No cost field here — a piece is acquired by crafting it first (see
// data/furnitureRecipes.ts, useMayorRoomStore's craftFurniture), same "spend
// materials at the 家具屋, then place for free" flow Phase 15③'s tailor
// requirement asks for, rather than paying again at placement time.
export type FurnitureKind = 'furniture' | 'mannequin';

export interface FurnitureDef {
  id: string;
  name: string;
  emoji: string;
  kind: FurnitureKind;
}

export const FURNITURE_DEFS: FurnitureDef[] = [
  { id: 'chair', name: '椅子', emoji: '🪑', kind: 'furniture' },
  { id: 'table', name: 'テーブル', emoji: '🛋️', kind: 'furniture' },
  { id: 'bookshelf', name: '本棚', emoji: '📚', kind: 'furniture' },
  { id: 'plant', name: '観葉植物', emoji: '🪴', kind: 'furniture' },
  { id: 'mannequin_a', name: 'マネキン(素朴)', emoji: '🧍', kind: 'mannequin' },
  { id: 'mannequin_b', name: 'マネキン(華やか)', emoji: '💃', kind: 'mannequin' },
];

export const FURNITURE_DEF_MAP: Record<string, FurnitureDef> = Object.fromEntries(
  FURNITURE_DEFS.map((f) => [f.id, f])
);
