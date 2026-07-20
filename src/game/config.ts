// Tunable pacing constants for the prototype.

import { Personality } from '../types';

export const TICK_MS = 1_000;

// Temporary visual debug aid (real-device report: costume/enemy art still
// looked clipped/overflowing after a fix that measurement showed should have
// resolved it) — draws a 1px red outline around the exact box each sprite is
// clipped to (CharacterAvatar's overflow:hidden box, EnemySprite's image),
// so a screenshot can show directly whether art crosses that boundary
// instead of relying on judging it by eye. Flip back to false once a report
// is confirmed resolved (or confirmed as a stale-bundle false alarm).
export const DEBUG_SHOW_SPRITE_BOUNDS = true;

// Phase-13 feasibility prototype ("大型変更: アイソメトリックへの移行", ステップ
// 1) — flip to true to view src/prototypes/isometric/IsometricPrototypeScreen
// in place of the real app (see App.tsx). Default false: this does not
// change any production behavior. Throwaway flag, safe to delete along with
// the whole src/prototypes/isometric/ folder once the feasibility question
// it exists to answer is settled.
export const SHOW_ISOMETRIC_PROTOTYPE = false;

// Same feasibility prototype as above, but surfaces it as a small in-app
// debug button (see TownScreen) that opens it in a Modal over the real
// running game, instead of replacing the whole app — added on request so
// the prototype's reachable on a device without editing any flags by hand.
// Default true while this feasibility question is still open; flip to
// false (or delete the button + this flag) once decided.
export const SHOW_ISOMETRIC_DEBUG_BUTTON = true;

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

// A bird whose HP falls to/below this fraction of its max (or bottoms out
// at 0) drops everything and heads home to recover — this takes priority
// over jobs, carrying, hunger, selling, everything (see ai.ts's stepBird).
// Once triggered it stays in recovery (see the 'recovering' activity) until
// fully healed, even if HP climbs back above this threshold en route —
// otherwise a bird would just leave home the moment it ticks back over the
// line, never actually finishing its recovery.
export const LOW_HP_RETREAT_THRESHOLD_PERCENT = 0.3;
// HP restored per tick once actually home and recovering.
export const HOME_HEAL_PER_TICK = 8;

// Enemies patrol near their spawn point instead of standing still, chase
// whichever bird wanders within aggro range, and give up (walking back to
// their patrol anchor) once the target's gone or too far away.
export const ENEMY_MOVE_SPEED = 0.05; // slower than a bird's MOVE_SPEED
export const ENEMY_PATROL_RADIUS = 0.06;
export const ENEMY_AGGRO_RANGE = 0.15;
export const ENEMY_CHASE_GIVEUP_RANGE = 0.22;
// How far from its original design-time spot an enemy can land when it
// respawns after being defeated — keeps it within its own zone (forest,
// quarry, etc.) rather than relocating anywhere on the map.
export const ENEMY_RESPAWN_POSITION_RADIUS = 0.06;

// How often (ms) a bird's mood is free to change on its own (moods that get
// actively resolved — hungry/sleepy — clear sooner via their own need loop).
export const MOOD_REFRESH_MS = 45_000;

// Each tick, a free/idle bird has this base chance of re-evaluating the
// request board (scaled by its personal acceptance score for each request).
export const REQUEST_CHECK_CHANCE = 0.35;

// The board never holds more than this many not-yet-done requests at once
// (postRequest rejects beyond it) — completing one immediately rolls a
// fresh random replacement (see useWorldStore's tick) so the board stays a
// steady, bounded pool instead of growing forever.
export const MAX_ACTIVE_REQUESTS = 3;

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
// Total materials (summed across every kind) a bird can personally carry
// before it's "full" — a real-device report showed birds sitting on
// hundreds of units of a single material with no pressure to ever sell it,
// affecting job/delivery efficiency. Past this total, the normal
// probabilistic sell-trip roll above is skipped in favor of triggering one
// for certain (see ai.ts's stepBird), so a full bird makes offloading its
// next priority instead of just occasionally considering it.
export const BIRD_INVENTORY_CAP = 150;
// Real-device bug: once a bird hit BIRD_INVENTORY_CAP, every tick's forced
// sell trip still only offloaded a couple of units — a normal trip's offer
// is capped at SELL_MAX_PER_TRIP units *and* SELL_MAX_GOLD_PER_TRIP gold,
// which for a common material (wood @ 4G) meant floor(15/4) = 3 units per
// trip. That's far too slow to ever bring a bird back under a 150-unit cap,
// so it stayed "full" forever, re-triggering a guaranteed sell trip (see
// ai.ts's stepBird) every single tick and completely crowding out gathering/
// combat/jobs — exactly the casual per-trip caps' job (keep a *voluntary*
// trickle-sale trade from draining the player too fast) applied to what's
// actually an emergency "get this bird unstuck" situation instead. An
// overflow trip (see ai.ts's executeSellTrip) uses these larger caps
// instead, so it clears the cap in one or a couple of trips rather than
// dozens: still bounded (so one enormous sale of a rare/pricey material
// can't be unlimited), just paced for "fix the overflow now" rather than
// "trickle a little gold in every so often."
export const OVERFLOW_SELL_MAX_PER_TRIP = 60;
export const OVERFLOW_SELL_MAX_GOLD_PER_TRIP = 300;
// How far *under* the cap an overflow trip aims to land, on top of just
// the raw excess — without this, selling exactly down to the cap would
// leave the bird right back at "isFull" the moment it gathers one more
// unit, immediately forcing another trip.
export const OVERFLOW_SELL_MARGIN = 20;
// A bird sells only its single most-plentiful material per trip (capped at
// this amount), not its whole stash at once — otherwise a well-stocked bird's
// asking price quickly outgrows what the player can ever afford, and trade
// freezes up entirely instead of trickling along a little at a time.
export const SELL_MAX_PER_TRIP = 8;

// Max copies of a single equip-category item (weapon/armor/hat/shield) a
// bird will hold at once — real-device report: a bird accumulated 193
// spare copies of the same weapon from repeated combat drops, since drop
// crediting had no cap at all (materials got one in Phase 9/10, but
// equipment items never did). Purchases were already safe (pickGearOffer
// skips a category entirely once anything's equipped in it), so this only
// ever bites on drops. 2 means "one equipped + one genuine spare" — past
// that, addEquipmentItemCapped (game/inventoryCap.ts) auto-sells the extra
// for gold on the spot instead of silently discarding it.
export const EQUIPMENT_SPARE_CAP = 2;
// What fraction of an item's normal shop buyPrice a salvaged-overflow copy
// is worth — well below the merchant's 50/50 convertible-item split, since
// this is a bird quietly recycling a duplicate rather than a real sale.
export const EQUIPMENT_SALVAGE_FRACTION = 0.4;
// When a bird's full offer would cost more than the player currently has,
// the player still buys a partial amount (see useWorldStore) rather than
// letting the trip fail outright — but a single sale can never cost the
// player more than this flat amount of gold, no matter how large the
// treasury has grown. A fraction-of-balance cap would let spend scale up
// right along with income and never let the treasury actually get ahead;
// a flat ceiling keeps each sale's drain bounded so toll income (which
// keeps accumulating) can outpace it over time.
//
// This is deliberately a *casual-trade* pace, not an inventory-management
// one — it only applies to an ordinary probabilistic sell trip (see
// SELL_CHECK_CHANCE_BASE/WANTS_MONEY below). A bird whose inventory has hit
// BIRD_INVENTORY_CAP uses the separate, much larger OVERFLOW_SELL_* caps
// instead (see the real-device bug note there for why this split exists).
export const SELL_MAX_GOLD_PER_TRIP = 15;

// A basic ration is always free to produce (never touches the player's
// funds or stock) — but if the bird can afford it, it pays this much for
// the meal, and that becomes town income. Broke birds still eat for free;
// hunger always resolves regardless of wealth.
export const FOOD_PRICE = 3;

// A simple stand-in for a real traveler NPC: each tick there's a small
// chance a traveler passes through and buys some of whatever the town has
// in stock, straight out of the shared warehouse (no bird involved). This
// was 0.02 (~once every 50 seconds) — nearly 7x more frequent than the
// merchant's own arrival roll (MERCHANT_ARRIVAL_CHECK_CHANCE, ~once every
// 5-6 minutes) despite the "occasional visitor" flavor text, and well above
// the rate birds sell material *into* the warehouse (SELL_CHECK_CHANCE_BASE
// = 0.006). Over a long real-time stretch (an 11-hour offline gap, in a
// real-device report) that outflow-beats-inflow imbalance was enough to
// completely empty the town's material warehouse. Brought down in line with
// the merchant's rarity so travelers stay a rare, flavorful event instead of
// the dominant material sink.
export const TRAVELER_CHECK_CHANCE = 0.003;
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
// Chance a merchant visit also comes with an offer to teach the player a
// still-locked recipe for gold (see game/recipeUnlocks.ts) — separate from,
// and rolled independently of, the regular item lineup above.
export const MERCHANT_RECIPE_OFFER_CHANCE = 0.35;
// Recipe-unlock routes 2/3/4 (see game/recipeUnlocks.ts): a small per-event
// chance to unlock a random still-locked recipe. Job-board completions
// (rarer, more deliberate than an ordinary gather/kill) get a noticeably
// higher chance than the two ambient rolls.
export const RECIPE_GIFT_CHANCE = 0.04; // per gather completion
export const RECIPE_COMBAT_CHANCE = 0.04; // per enemy kill

// Costume-ticket ambient routes (see game/cosmeticUnlocks.ts) — same shape
// as the recipe routes above (a small per-event chance), kept slightly
// rarer since a costume is a bigger, more novel reward than a recipe.
export const COSMETIC_FIND_CHANCE = 0.025; // per gather completion
export const COSMETIC_DROP_CHANCE = 0.025; // per enemy kill
export const RECIPE_QUEST_CHANCE = 0.2; // per job-board request completed
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

// ---- Game-time (calendar) system ----
// A purely cosmetic "game calendar" layered on top of the tick loop: while
// the app is open, the calendar advances faster than real time (see
// useGameTimeStore's advanceOnline), and the gap while the app was closed
// is caught up in one lump sum on next launch (see game/offlineProgress.ts
// and useGameTimeStore's catchUpOffline). Nothing in the actual simulation
// depends on this value today — existing tick-based timers (respawns,
// merchant visit length, etc.) still run on their own real-tick clocks;
// this just gives future systems (town level curves, quest deadlines) a
// shared clock to reference later, per the design request.
export const ONLINE_TIME_SCALE = 60; // 1 real second online = 60 game-seconds (~1 real minute = 1 game hour)

// How long a closed-app gap can count toward offline progress — caps how
// much a single catch-up calculation can grant, no matter how long the app
// was actually closed, so a long absence can't break the economy.
export const OFFLINE_PROGRESS_CAP_MS = 8 * 60 * 60 * 1000;
// Gaps shorter than this aren't worth a welcome-back report (covers a quick
// screen lock or app-switcher glance, not just genuinely leaving).
export const OFFLINE_MIN_REPORT_MS = 60_000;

// Offline catch-up is a statistical approximation, not a tick-by-tick
// replay (a capped 8-hour gap is ~28,800 ticks — cheap to approximate,
// expensive to replay faithfully). These say how many ticks an average
// combat kill / gathering trip takes for each personality, including
// travel and however much of its time that personality actually spends
// pursuing combat/mining versus everything else (hunger, sleep, selling,
// gear-shopping, resting) — measured empirically by running the real
// stepBird AI solo for 5000 ticks per personality (see the calibration
// notes in game/offlineProgress.ts). These numbers vary a lot by
// personality (a vanguard fights almost every tick it's free; a cautious
// healer mostly doesn't), which is exactly why they're per-personality
// instead of one flat constant.
export const OFFLINE_TICKS_PER_KILL: Record<Personality, number> = {
  vanguard: 15,
  freeSpirit: 33,
  clingy: 60,
  cautious: 54,
};
export const OFFLINE_TICKS_PER_GATHER: Record<Personality, number> = {
  vanguard: 62,
  freeSpirit: 21,
  clingy: 40,
  cautious: 51,
};

// A bird's house storage (see HouseInventoryModal) — player-managed, not
// automatic. Food stashed here is eaten before a hungry bird walks to the
// feed shop (see ai.ts's stepShopFood); treasure stashed here is excluded
// from autonomous merchant sales entirely (it's moved out of `items`, not
// just flagged). Both capped at small, easy-to-reason-about counts —
// generous enough to feel like a real stash, not a second warehouse.
export const HOUSE_FOOD_CAP = 5;
export const HOUSE_TREASURE_CAP = 5;

// ---- Phase 11: park/bathhouse "play", detour/chat flavor, inspiration ----
// Below this happiness, a bird is more drawn to detouring/playing/chatting —
// the request ties all three to how content the bird currently is, not just
// personality.
export const HAPPINESS_LOW_THRESHOLD = 40;
// How long a bird lingers at a park/bathhouse before moving on — same shape
// as LEISURE_DWELL_TICKS.
export const PLAY_DWELL_TICKS = 3;
// Each tick a bird is about to freshly pick its next thing to do, this is
// the chance it takes a little detour instead (see ai.ts's executeDetour) —
// deliberately only rolled at that same decision point, never interrupting
// a pursuit already underway (job/combat/mining stay untouched).
export const DETOUR_CHANCE_BASE = 0.02;
export const DETOUR_CHANCE_LOW_MOOD = 0.06;
// A real-device request: a detour used to walk the bird to a nearby random
// point and barely dwell there, over almost before it started — too fast to
// actually notice among 4 independently-moving birds. executeDetour no
// longer moves the bird at all now (see its own comment); this is just how
// many seconds (1 tick ≈ 1s, see TICK_MS) it stands still with the
// strolling badge up.
export const DETOUR_DWELL_TICKS = 3;
// Two nearby recruited birds occasionally pause to "chat" — a cosmetic
// speech-bubble overlay (see BirdState.chatLine) plus a brief in-place pause
// (see BirdState.chatPauseTicks) — checked once per tick per eligible pair
// within this distance of each other.
//
// A real-device request: chat almost never fired because the old formula
// multiplied a very small base chance by a mood boost, so a bird whose
// happiness stayed comfortably high (the common case) got the *lowest*
// version of an already-tiny number. Split into a real base rate (fires
// regardless of mood) plus a modest additive bonus when either bird's
// happiness is low, and widened the proximity check — the old 0.06 sat
// right at the edge of MIN_BIRD_DISTANCE's own push-apart radius (0.05), so
// two birds were almost never actually inside it. These are a first-pass
// balance (aimed at "at least once every ~5 minutes of normal play"); retune
// after playing if it's still too rare/frequent.
export const CHAT_PROXIMITY_DIST = 0.12;
export const CHAT_CHANCE_BASE = 0.05;
export const CHAT_CHANCE_LOW_MOOD_BONUS = 0.05;
// How many ticks a chatting pair stands still (see BirdState.chatPauseTicks)
// — long enough that the speech bubble reads as "the reason they stopped,"
// not a coincidence during a stop they were already going to make.
export const CHAT_PAUSE_TICKS = 3;

// A real-device request: birds looked restless/fidgety with nothing but
// short activities. Adds a longer, discretionary "go home and nap" option
// within the 'rest' category (see ai.ts's executeNap) — picked more often
// when a bird is already comfortable (happiness and satiety both at/above
// this threshold) rather than only when actually sleepy.
export const NAP_GOOD_MOOD_THRESHOLD = 60;
export const NAP_CHANCE_BASE = 0.15;
export const NAP_CHANCE_GOOD_MOOD = 0.4;
// Deliberately much longer than any other rest sub-behavior's dwell (see
// LEISURE_DWELL_TICKS/DETOUR_DWELL_TICKS) — the whole point is a visibly
// calmer, slower beat.
export const NAP_DWELL_TICKS = 8;
// Each tick spent actually playing (see ai.ts's executePlay), independent
// rolls for a small stat bump ("中程度") and, far rarer, a whole new
// permanent skill ("かなり低い") — see data/skills.ts.
export const INSPIRATION_STAT_CHANCE = 0.05;
export const INSPIRATION_SKILL_CHANCE = 0.006;
export const INSPIRATION_STAT_GAIN = 1;
export const INSPIRATION_HP_GAIN = 3;

// ---- Phase 14: independent houses, houseless "拗ね" (sulking) → warning →
// departure ----
// How many ticks (1 tick ≈ 1s, see TICK_MS) a *recruited* bird can go
// without an assigned house before it starts moping. Deliberately only
// counted while the app is actually open and ticking live (see
// BirdState.houselessTicks's own comment) — a short, forgiving number in
// wall-clock terms is still a long one in terms of actual play sessions.
// First-pass numbers, not yet played against real usage — retune if this
// reads as too eager/too lenient once it's actually live.
export const HOUSELESS_SULK_TICKS = 60 * 20; // ~20 live minutes
// Further ticks past HOUSELESS_SULK_TICKS before a one-time "may leave
// soon" warning fires (see useWorldStore's tick, TownScreen's
// HouseWarningModal).
export const HOUSELESS_WARNING_TICKS = 60 * 60; // ~1 further live hour
// Further ticks past HOUSELESS_WARNING_TICKS, with no house assigned and no
// cheer-up gift given in the meantime, before the bird actually leaves town
// (isRecruited flips back to false, same field a not-yet-recruited bird
// starts with). Deliberately generous — losing a teammate is a real,
// non-trivial loss, so the total grace period (sulk start → warning →
// departure) needs to comfortably outlast a player just being busy for a
// while, not punish a short absence.
export const HOUSELESS_LEAVE_TICKS = 60 * 60 * 2; // ~2 further live hours
// Extra happiness drain per tick once sulking has started, layered on top
// of whatever the ambient mood system already does — deliberately pushes
// happiness down past HAPPINESS_LOW_THRESHOLD so a houseless bird leans on
// the *existing* "detour/park visit when unhappy" behaviors as a
// thematically-fitting coping mechanism, with no new AI branch needed.
export const HOUSELESS_HAPPINESS_DECAY_PER_TICK = 0.05;
// Sulking alone never drains happiness below this floor — it should read
// as "grumpy," never as compounding into some other bad-mood spiral.
export const HOUSELESS_HAPPINESS_FLOOR = 15;
// Each tick while sulking, the chance of showing the "はやく家がほしいよ〜"
// speech bubble (reuses BirdState.chatLine, same mechanism as the ambient
// bird-to-bird chat bubble — see game/thoughts.ts's HOUSELESS_LINES) — small,
// so it reads as an occasional gripe rather than constant nagging.
export const HOUSELESS_BUBBLE_CHANCE = 0.03;
// How much happiness a single cheer-up gift restores (see useWorldStore's
// giveGiftToBird) — the gift's real effect is resetting houselessTicks to 0
// (buying more time before the next warning), this is just the immediate
// visible mood bump.
export const GIFT_HAPPINESS_RESTORE = 25;

// A house is the first building type to use free (non-grid) placement —
// see useTownStore's buildHouse. Cost is in the same shape/range as the
// cheapest existing BUILDING_OPTIONS entries (data/buildingOptions.ts).
export const HOUSE_BUILD_COST = { gold: 200, materialId: 'wood' as const, materialAmount: 8 };
// Minimum distance (in the same normalized 0..1 canvas space as everything
// else) a new house must keep from every existing house, the town hall, and
// every constructed plot building — a simple radius check rather than real
// rectangle math, same precedent as ai.ts's randomPointNearTown/
// BUILDING_CLEARANCE.
export const HOUSE_CLEARANCE = 0.05;

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
