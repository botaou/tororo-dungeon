// Phase 14: this used to be the *entire* house system — one fixed house per
// one of exactly 4 characters, position/art/identity all baked into the
// bird's own defId (see the git history of this file for the original
// design). It's now only a one-time migration seed (see useTownStore's
// persist migrate, version 1→2): a pre-existing save's 4 already-lived-in
// houses need to become real HouseState entries with their resident already
// assigned, so a returning player's town looks identical the moment this
// ships — nothing here is read at runtime by anything else anymore (ai.ts/
// WorldMap.tsx now resolve a bird's home via useTownStore's houses, looking
// up whichever house has residentDefId === that bird's defId, since houses
// are no longer 1:1 with characters — the roster is meant to grow past 4
// over time, per the original design docs).
export const HOUSE_POSITIONS: Record<string, { x: number; y: number }> = {
  tororo: { x: 0.4639, y: 0.4304 }, // NW
  vivi: { x: 0.5361, y: 0.5696 }, // SE
  haku: { x: 0.4639, y: 0.5696 }, // SW
  mone: { x: 0.5361, y: 0.4304 }, // NE
};
