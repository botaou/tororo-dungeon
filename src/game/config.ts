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

// Cut of every combat kill reward that goes to the player as "town security
// cooperation money" instead of the attacking bird(s) — one of the player's
// few guaranteed income sources alongside food and traveler tolls.
export const SECURITY_FEE_RATE = 0.4;

// How long a bird lingers at the shop while selling off its inventory.
export const SELL_DWELL_TICKS = 2;
// Each tick, a free bird with something to sell has this base chance of
// deciding to make a trip to the shop; much more likely while "wantsMoney".
export const SELL_CHECK_CHANCE_BASE = 0.006;
export const SELL_CHECK_CHANCE_WANTS_MONEY = 0.07;
// A bird sells only its single most-plentiful material per trip (capped at
// this amount), not its whole stash at once — otherwise a well-stocked bird's
// asking price quickly outgrows what the player can ever afford, and trade
// freezes up entirely instead of trickling along a little at a time.
export const SELL_MAX_PER_TRIP = 8;
// When a bird's full offer would cost more than the player currently has,
// the player still buys a partial amount (see useWorldStore) rather than
// letting the trip fail outright — but a single sale can never cost the
// player more than this flat amount of gold, no matter how large the
// treasury has grown. A fraction-of-balance cap would let spend scale up
// right along with income and never let the treasury actually get ahead;
// a flat ceiling keeps each sale's drain bounded so toll income (which
// keeps accumulating) can outpace it over time.
export const SELL_MAX_GOLD_PER_TRIP = 15;

// A basic ration is always free to produce (never touches the player's
// funds or stock) — but if the bird can afford it, it pays this much for
// the meal, and that becomes town income. Broke birds still eat for free;
// hunger always resolves regardless of wealth.
export const FOOD_PRICE = 3;

// A simple stand-in for a real traveler NPC: each tick there's a small
// chance a traveler passes through and buys some of whatever the town has
// in stock, straight out of the shared warehouse (no bird involved).
export const TRAVELER_CHECK_CHANCE = 0.02;
export const TRAVELER_MAX_PURCHASE = 6;

// Each tick, a free bird missing a weapon or armor of its own has this
// chance of checking the general shop's shelf for something it can afford.
export const GEAR_SHOP_CHECK_CHANCE = 0.01;

// The feed shop's NPC supplier: each tick, per commodity item below its
// target shelf quantity, this chance of topping it back up to the target
// (at the item's restockCost per unit, straight out of the treasury).
export const FEED_RESTOCK_CHECK_CHANCE = 0.15;
export const FEED_RESTOCK_TARGET = 10;

// Provisional exp/level curve: a bird needs (level * EXP_PER_LEVEL_BASE) exp
// to advance from its current level, then exp resets toward the remainder.
export const EXP_PER_LEVEL_BASE = 20;
export const LEVEL_UP_ATK_GAIN = 1;
export const LEVEL_UP_HP_GAIN = 5;
export const LEVEL_UP_DEFENSE_GAIN = 1;
export const LEVEL_UP_SPEED_GAIN = 1;

// Numeric meters behind the mood label (see BirdState.satiety/happiness).
export const STARTING_SATIETY = 100;
export const STARTING_HAPPINESS = 70;
// Ticks down every tick regardless of mood; ~65 ticks/point means a bird
// starting full takes roughly the same number of ticks to go hungry as the
// old pure-random hungry roll used to average out to, so the existing food
// economy tuning (toll rates, shop visit cadence) doesn't need re-tuning.
export const SATIETY_DECAY_PER_TICK = 0.15;
// Once satiety drops to/below this, mood is forced to 'hungry' (overriding
// whatever the ambient mood-refresh timer would otherwise roll) until the
// bird actually eats, at which point satiety resets to STARTING_SATIETY.
export const SATIETY_HUNGRY_THRESHOLD = 30;

export function expToNextLevel(level: number): number {
  return level * EXP_PER_LEVEL_BASE;
}

// How many recent events the on-screen activity log keeps.
export const ACTIVITY_LOG_MAX = 10;

// Depleted enemies/resources come back after this long so the world never
// runs permanently dry.
export const ENEMY_RESPAWN_MS = 12_000;
export const MINING_RESPAWN_MS = 90_000;
export const TREASURE_RESPAWN_MS = 90_000;

// The visiting merchant — distinct from the traveler above: instead of a
// single brief in-and-out purchase, the merchant sets up a temporary shop
// for a stretch of "days" (there's no real day/night cycle yet, so this is
// expressed directly in ms, on the same order of magnitude as a Home-screen
// play session) and offers two-way trade. Absent far more often than
// present, so its arrival reads as a notable event.
// Average wait between visits while none is present: ~1/chance ticks.
export const MERCHANT_ARRIVAL_CHECK_CHANCE = 0.003;
// How long a single visit lasts once the merchant arrives — randomized
// per-visit within this range to represent "a few days to about a week".
export const MERCHANT_VISIT_DURATION_MIN_MS = 180_000;
export const MERCHANT_VISIT_DURATION_MAX_MS = 420_000;
// How many distinct item slots the merchant's shelf has this visit, and how
// many units of each — freshly randomized every arrival.
export const MERCHANT_LINEUP_SIZE = 4;
export const MERCHANT_ITEM_STOCK_MIN = 2;
export const MERCHANT_ITEM_STOCK_MAX = 5;
// Chance any given shelf slot is drawn from the rare pool instead of the
// common one (see data/items.ts's MERCHANT_RARE_ITEM_IDS).
export const MERCHANT_RARE_CHANCE = 0.15;
// The "market usage fee" split when a bird sells a convertible item to the
// merchant — half the sale price goes to the bird, half to the town.
export const MERCHANT_BUYBACK_SPLIT = 0.5;
// Each tick, a free bird holding at least one convertible item has this
// chance of deciding to make a trip to sell to the merchant (only rolled
// while a merchant is actually present) — higher than the regular
// SELL_CHECK_CHANCE_BASE since the merchant won't be there for long.
export const MERCHANT_SELL_CHECK_CHANCE = 0.05;
// Each tick, a free bird has this chance of checking the merchant's shelf
// for something affordable (only rolled while a merchant is present).
export const MERCHANT_BUY_CHECK_CHANCE = 0.02;

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
