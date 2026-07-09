// Tunable pacing constants for the prototype. Kept short so the loop is
// playable/testable in a few minutes rather than requiring real idle-game waits.

export const STAMINA_MAX = 20;
export const STAMINA_REGEN_MS = 20_000; // +1 stamina per 20s

export const ENERGY_MAX = 100;
export const ENERGY_REGEN_MS = 3_000; // +1 energy per 3s

export const TICK_MS = 1_000;

// How many ticks the party spends animating a mining/treasure encounter
// before it auto-resolves and they walk on.
export const ENCOUNTER_HOLD_TICKS = 2;

export const STARTING_MATERIALS = { gold: 0, ore: 0, gem: 0 };
