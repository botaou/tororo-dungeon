// Tunable pacing constants for the prototype.

export const TICK_MS = 1_000;

// How many ticks a bird spends animating a mining/treasure/job encounter
// before it auto-resolves and it moves on.
export const ENCOUNTER_HOLD_TICKS = 2;

// Constant walking speed: ratio-units of the world crossed per second, and
// how close counts as "arrived" so a bird stops and engages instead of
// endlessly approaching.
export const MOVE_SPEED = 0.1;
export const ARRIVAL_THRESHOLD = 0.035;

// Minimum distance kept between two birds — closer than this and they get
// gently pushed apart so they never visually stack on top of each other.
export const MIN_BIRD_DISTANCE = 0.05;

// How often (ms) a bird's mood is free to change on its own (moods that get
// actively resolved — hungry/sleepy — clear sooner via their own need loop).
export const MOOD_REFRESH_MS = 45_000;

// Each tick, a free/idle bird has this base chance of re-evaluating the
// request board (scaled by its personal acceptance score for each request).
export const REQUEST_CHECK_CHANCE = 0.35;

// How long a bird spends at home satisfying hunger/sleepiness before the
// need is resolved and its mood returns to normal.
export const HOME_NEED_TICKS = 4;

// How long a bird lingers at a river/pond before moving on.
export const LEISURE_DWELL_TICKS = 3;
// Chance an otherwise-idle bird heads to a leisure spot instead of just
// wandering, when one exists.
export const LEISURE_CHANCE = 0.5;

// Depleted enemies/resources come back after this long so the world never
// runs permanently dry.
export const ENEMY_RESPAWN_MS = 25_000;
export const MINING_RESPAWN_MS = 30_000;
export const TREASURE_RESPAWN_MS = 90_000;

export const STARTING_GOLD = 300;
export const STARTING_MATERIALS = {
  wood: 0,
  ore: 0,
  mushroom: 0,
  berry: 0,
  herb: 0,
  feather: 0,
  gem: 0,
  coal: 0,
  fish: 0,
  pearl: 0,
  waterweed: 0,
  relic: 0,
  magicStone: 0,
  oldCoin: 0,
};
