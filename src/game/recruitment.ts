// Recruitment triggers for the three dormant starters (vivi/haku/tororo/
// mone all exist in world.birds from session start — see useWorldStore's
// buildInitialWorld — but only the player's chosen starter begins
// isRecruited: true). Each of the other three has its own trigger type,
// per the "街レベル / クエスト / マップでの出会い" design policy: one
// town-development gate, one one-off quest, and two map encounters (one
// combined with an alternate combat milestone). Thresholds are
// deliberately light — getting all four birds together early matters more
// than precise balance, which can be tuned later.

// ---- ビビ: town-level gate ----
// Reachable the moment the player unlocks TOWN_LEVEL_PLOT_STEP extra plots
// (see data/townGrid.ts's getTownLevel) — the town's very first bit of
// growth past its starting plot.
export const VIVI_TOWN_LEVEL_REQUIRED = 2;

export function checkVivi(townLevel: number): boolean {
  return townLevel >= VIVI_TOWN_LEVEL_REQUIRED;
}

// ---- ハク: one-off quest ----
// "初めての採取に成功する" — completed the moment any recruited bird's
// gather (free-roam or job) actually delivers something, tracked as a
// milestone in useQuestStore so it only ever fires once.
export const HAKU_QUEST_ID = 'first_gather';

export function checkHaku(isQuestComplete: boolean): boolean {
  return isQuestComplete;
}

// ---- トロロ: chance map encounter ----
// A fixed spot out in the field — once any active bird wanders within
// range (via its own normal explore/rest wandering, no special AI needed),
// there's a per-tick chance of "running into" him.
export const TORORO_ENCOUNTER_SPOT = { x: 0.5, y: 0.6 };

// ---- モネ: map encounter OR a combat milestone ----
// Her own encounter spot (nearer the quarry, matching her ore/treasure
// flavor), plus an alternate path: the town's first wolf-tier kill —
// "自由人" personality, so she turns up for whichever happens first.
export const MONE_ENCOUNTER_SPOT = { x: 0.88, y: 0.6 };
export const MONE_WOLF_KILL_MILESTONE_ID = 'first_wolf_kill';
// Matches ENEMY_DEFS's wolf_a/wolf_b display name (data/world.ts) — kept as
// a simple name check rather than threading defId through combat.ts's
// public EnemyKillSummary shape just for this.
export const WOLF_ENEMY_NAME = 'オオカミ';

// Shared by both map-encounter birds: how close counts as "in range", and
// the per-tick odds of the encounter actually triggering while in range
// (so it reads as a chance meeting, not an instant pickup the moment a
// bird crosses into the area).
export const ENCOUNTER_RADIUS = 0.07;
export const ENCOUNTER_CHANCE_PER_TICK = 0.04;

function isAnyoneNear(positions: { x: number; y: number }[], spot: { x: number; y: number }): boolean {
  return positions.some((p) => Math.hypot(p.x - spot.x, p.y - spot.y) <= ENCOUNTER_RADIUS);
}

export function checkTororoEncounter(activeBirdPositions: { x: number; y: number }[]): boolean {
  return isAnyoneNear(activeBirdPositions, TORORO_ENCOUNTER_SPOT) && Math.random() < ENCOUNTER_CHANCE_PER_TICK;
}

export function checkMoneEncounter(activeBirdPositions: { x: number; y: number }[], wolfKillMilestoneDone: boolean): boolean {
  if (wolfKillMilestoneDone) return true;
  return isAnyoneNear(activeBirdPositions, MONE_ENCOUNTER_SPOT) && Math.random() < ENCOUNTER_CHANCE_PER_TICK;
}
