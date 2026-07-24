import { TownBuildingInstance } from '../types';
import { getBuildingOption } from './buildingOptions';

// Phase 12②("クエスト連動の街発展"): townLevel used to advance automatically
// the instant cumulative developmentPoints (see useTownStore) crossed a
// numeric threshold (data/townGrid.ts's old TOWN_LEVEL_DEFS.threshold-based
// getTownLevel) — a town could level up purely as a side effect of routine
// job-board grinding, with no specific moment the player could point to as
// "I made the town grow." This questline is now the *only* thing that ever
// bumps townLevel (see useTownStore's completeTownQuest) — developmentPoints
// itself still accumulates from the same sources as before (flavor/
// reputation-adjacent, shown in TownStatusModal), it just no longer gates
// anything.
//
// Exactly one quest is ever "active" at a time (see useTownStore's
// townQuestIndex) — this is a strictly linear line, not a pool, mirroring
// how TOWN_LEVEL_DEFS's five stages are themselves a strict ladder. Each
// entry's grantsTownLevel lines up 1:1 with the next TOWN_LEVEL_DEFS tier
// (see data/townGrid.ts), so completing all four quests here walks the town
// from level 1 (ボロ役場) all the way to level 5 (トロロ自然保護本部).
export interface TownQuestDef {
  id: string;
  name: string;
  // Shown as the "next goal" in TownStatusModal while this quest is active.
  description: string;
  // Shown in the completion notification (see TownLevelUpModal) — phrased
  // as "what just became possible," per the request's own example ("新しい
  // 土地が使えるようになりました!").
  rewardText: string;
  grantsTownLevel: number;
}

export const TOWN_QUESTS: TownQuestDef[] = [
  {
    // Step B (building free placement) repurposed this quest: there's no
    // more separate "claim a plot of land" step (see data/townGrid.ts's own
    // top comment) — the first meaningful town-development milestone is now
    // just constructing any one building at all. Kept the same id/ordering
    // position (still the questline's first entry, still grants level 2) so
    // no migration is needed for townQuestIndex, which persists as a bare
    // number, not this id string.
    id: 'first_building',
    name: '最初の建物を建てる',
    description: '空いている場所に建物をひとつ建てよう。',
    rewardText: 'はじめての建物が建ちました!',
    grantsTownLevel: 2,
  },
  {
    id: 'build_feed_shop',
    name: '餌屋を建てる',
    description: '空いている土地に餌屋を建てよう。',
    rewardText: '餌屋が建ちました!鳥たちが美味しい餌を買えるようになります。',
    grantsTownLevel: 3,
  },
  {
    id: 'five_requests',
    name: '依頼を5件達成する',
    description: '依頼掲示板の依頼を、合計5件達成しよう。',
    rewardText: '村役場に発展しました!',
    grantsTownLevel: 4,
  },
  {
    id: 'build_weapon_or_armor_shop',
    name: '武器屋か防具屋を建てる',
    description: '空いている土地に武器屋か防具屋を建てよう。',
    rewardText: '町役場に発展しました!',
    grantsTownLevel: 5,
  },
];

// Live game state the condition checks below need — kept minimal and
// plain-data rather than importing useWorldStore/useTownStore directly, so
// this file (and its checks) stay easy to unit-test/reason about in
// isolation, same spirit as game/recruitment.ts's checkVivi/checkHaku etc.
export interface TownQuestContext {
  buildings: Record<string, TownBuildingInstance>;
  completedRequestCount: number;
}

function hasBuiltShopKind(buildings: Record<string, TownBuildingInstance>, kinds: string[]): boolean {
  return Object.values(buildings).some((b) => {
    const option = getBuildingOption(b.constructedBuildingId);
    return !!option?.shopKind && kinds.includes(option.shopKind);
  });
}

// Keyed by TownQuestDef.id — a switch would work equally well, but this
// keeps each quest's own condition right next to a clear id reference
// rather than buried in branch order.
const CONDITION_CHECKS: Record<string, (ctx: TownQuestContext) => boolean> = {
  first_building: (ctx) => Object.keys(ctx.buildings).length > 0,
  build_feed_shop: (ctx) => hasBuiltShopKind(ctx.buildings, ['feed']),
  five_requests: (ctx) => ctx.completedRequestCount >= 5,
  build_weapon_or_armor_shop: (ctx) => hasBuiltShopKind(ctx.buildings, ['weapon', 'armor']),
};

export function checkTownQuestCondition(quest: TownQuestDef, ctx: TownQuestContext): boolean {
  return CONDITION_CHECKS[quest.id]?.(ctx) ?? false;
}
