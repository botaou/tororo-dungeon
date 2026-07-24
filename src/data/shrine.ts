// Phase 15②: the town's abandoned shrine (廃神社) — placed on the map from
// game start, nobody there, gradually restoring in appearance until
// アルシェル (its fixed keeper/spirit — see ALSHEL_NPC/ALSHEL_REVEAL_TOWN_LEVEL
// below, and components/WorldMap.tsx's AlshelSprite) appears once it's fully
// restored. Deliberately mirrors data/
// buildingImages.ts's TOWNHALL_IMAGES pattern exactly: keyed straight off
// townLevel (a number already tracked by useTownStore), with no separate
// persisted "restoration stage" field of its own — the same "stateless,
// level-derived visual tier" precedent the town hall itself already
// established, per the request's own "町役場の5段階と同じ仕組みを流用してよい".
//
// Real painted art (like TOWNHALL_IMAGES/HOUSE_IMAGES) is out of scope for
// this sample pass — emoji + opacity/decoration follows the same precedent
// already used elsewhere on the map for lighter-weight features (leisure
// spots, treasure chests, the encounter "❓" marker), rather than commissioning
// a new 5-image reference sheet for a single decorative building.
export interface ShrineStageDef {
  level: number;
  emoji: string;
  opacity: number;
  decor: string | null; // an extra small emoji shown once restoration is visibly underway
  label: string;
}

export const SHRINE_STAGE_DEFS: Record<number, ShrineStageDef> = {
  1: { level: 1, emoji: '⛩️', opacity: 0.45, decor: null, label: '廃神社' },
  2: { level: 2, emoji: '⛩️', opacity: 0.6, decor: null, label: '廃神社' },
  3: { level: 3, emoji: '⛩️', opacity: 0.78, decor: '🍃', label: '復興中の神社' },
  4: { level: 4, emoji: '⛩️', opacity: 0.92, decor: '🍃', label: '復興中の神社' },
  5: { level: 5, emoji: '⛩️', opacity: 1, decor: '🌸', label: 'アルシェルの社' },
};

export function getShrineStageDef(townLevel: number): ShrineStageDef {
  return SHRINE_STAGE_DEFS[townLevel] ?? SHRINE_STAGE_DEFS[1];
}

// A quiet, out-of-the-way corner of the field — checked against every
// hand-placed enemy/mining-node position in data/world.ts (closest is
// wolf_b at (0.75, 0.45), ~0.19 away) and well clear of the town's own plot
// grid, which never reaches past roughly TOWN_X/TOWN_Y ± 0.22.
export const SHRINE_SPOT = { x: 0.93, y: 0.52 };

// アルシェル: the shrine's own fixed keeper/spirit — NOT a recruitable bird
// (a spec correction from the original Phase 15② design, which mistakenly
// ran her through the normal bird-AI/recruitment pipeline). She's a
//神使(しんし) who has quietly lived at the ruined shrine from the start,
// revealing herself once it's fully restored, and never leaves it — no
// gathering/combat/shopping, no roster entry, no CHARACTERS row. Rendered as
// a fixed NPC (see components/WorldMap.tsx's AlshelSprite, modeled on
// ShopkeeperSprite) rather than a BirdState. Her actual roles (prayer buffs,
// seasonal events, calling rare birds/spirits, omikuji, shrine level
// management) are intentionally NOT implemented yet — this is just the
// "she exists, fixed at the shrine" foundation; each role is a separate
// future request.
export const ALSHEL_NPC = {
  name: 'アルシェル',
  emoji: '🤍',
  color: '#b9a4e0',
  description: '神社を守る不思議な存在。神様そのものではなく、神社に仕える神使。廃神社にひっそりと暮らしており、街が育っていく気配を感じ取って、少しずつ姿を見せるようになった。神社から離れることはなく、ずっとそこで暮らしている。',
};

// Same shape as game/recruitment.ts's checkVivi-style town-level gates — the
// shrine's own visual stage (see SHRINE_STAGE_DEFS above, whose level-5 label
// is already "アルシェルの社") is keyed off townLevel exactly like
// TOWNHALL_IMAGES already is, so "fully restored" and "town reached its top
// tier" are the same moment.
export const ALSHEL_REVEAL_TOWN_LEVEL = 5;
