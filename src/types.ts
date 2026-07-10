// Core data model for the town-sim prototype.

// One material per zone the bird can gather in, so exploring different
// areas of the field feels distinct (森/鉱山/湖/遺跡).
export type MaterialId =
  | 'wood'
  | 'ore'
  | 'mushroom'
  | 'berry'
  | 'herb'
  | 'feather'
  | 'gem'
  | 'coal'
  | 'fish'
  | 'pearl'
  | 'waterweed'
  | 'relic'
  | 'magicStone'
  | 'oldCoin';

// Non-material loot/goods — weapons/armor/rare trinkets plus feed-shop food.
// A small, hand-picked catalog (see data/items.ts) rather than a generic
// item system, since only a handful exist so far.
export type ItemId =
  | 'rustySword'
  | 'leatherArmor'
  | 'leatherHat'
  | 'woodenShield'
  | 'luckyCharm'
  | 'ancientGem'
  // Feed-shop staples — plain commodity food restocked by an NPC supplier
  // (costs the town gold to restock; never crafted, never sits in the
  // player's crafted-goods warehouse).
  | 'seed'
  | 'milletSpray'
  | 'nuts'
  | 'vegetable'
  // Premium feed — crafted by the player like weapons/armor, then shelved
  // at the feed shop.
  | 'nutritionBiscuit'
  | 'deluxeBlend'
  | 'energyPellet'
  | 'luckyTreat';

// What genre of shop carries an item — also which shop building it can be
// crafted "at" (see data/shops.ts) and shelved into. weapon/armor/hat/shield
// double as the four equipment slots (see EquipSlot) — rare/food are goods,
// not gear, and can't be equipped.
export type ItemCategory = 'weapon' | 'armor' | 'hat' | 'shield' | 'rare' | 'food';

// The four equipment slots a bird has, one item each. Deliberately the same
// literal values as their matching ItemCategory so "which slot does this
// item go in" never needs a separate lookup table.
export type EquipSlot = 'weapon' | 'armor' | 'hat' | 'shield';

// Which physical shop building this is. Just two for now; adding a third
// kind later is only a new SHOP_DEFS entry plus a town plot to place it on.
export type ShopKind = 'general' | 'feed';

// Forward-looking, currently-unused bonus hooks a food item could carry —
// present purely as data so a later pass can wire actual effects (HP
// recovery on eating, a temporary exp boost, etc.) without a schema change.
export interface ItemEffects {
  hpRestorePercent?: number;
  expBonusPercent?: number;
}

// Stat bonuses an equippable item (weapon/armor/hat/shield) grants while
// equipped — added on top of the wearer's own base stats (see
// game/birdStats.ts's getEffectiveStats).
export interface ItemStatBonus {
  atk?: number;
  defense?: number;
  speed?: number;
  luck?: number;
}

export type CharacterRole = 'attacker' | 'healer';

// Each character's independent AI personality — governs both free-roam
// wandering biases and job-acceptance behavior.
export type Personality = 'vanguard' | 'clingy' | 'cautious' | 'freeSpirit';

export type MoodId = 'normal' | 'sleepy' | 'happy' | 'hungry' | 'wantsMoney';

export interface MoodDef {
  id: MoodId;
  label: string; // short status label shown under the bird's name
}

export interface CharacterDef {
  id: string;
  name: string;
  role: CharacterRole;
  personality: Personality;
  description: string;
  color: string; // accent color for UI
  emoji: string; // placeholder visual until real art is added
  baseAtk: number; // for healers, this is heal power instead of damage
  baseHp: number;
  baseDefense: number;
  baseSpeed: number; // reserved for future movement/turn-order use; display-only today
  baseLuck: number; // reserved for future drop/crit-rate use; display-only today
  materialBonusPercent?: number; // bonus % applied when this bird delivers materials
}

// One possible drop roll on a kill — independently checked against `chance`
// (0..1) per entry, so an enemy can drop several things (or nothing) from
// the same kill. Rolled fresh each kill, awarded to one random participant.
export type EnemyDropEntry =
  | { kind: 'material'; materialId: MaterialId; amount: number; chance: number }
  | { kind: 'item'; itemId: ItemId; chance: number };

// Defs carry a hand-placed design-time position (0..1) so the world reads
// as a deliberately laid-out diorama instead of randomly scattered items.
export interface EnemyDef {
  id: string;
  name: string;
  emoji: string;
  hp: number;
  atk: number;
  goldReward: number;
  expReward: number; // flat exp granted to every bird that damaged it
  dropTable?: EnemyDropEntry[];
  x: number;
  y: number;
}

export interface MiningNodeDef {
  id: string;
  name: string;
  resource: MaterialId;
  amount: number;
  x: number;
  y: number;
}

export interface TreasureNodeDef {
  id: string;
  name: string;
  goldReward: number;
  x: number;
  y: number;
}

// ---- Persisted player state ----

export interface PlayerState {
  gold: number; // the town treasury — spendable balance
  materials: Record<MaterialId, number>;
  // The town's crafted-goods warehouse (the "back room") — what the player
  // has made out of bought materials. Separate from a bird's personal
  // `items` (monster loot), and separate from `shopStock` below: crafting
  // an item doesn't put it up for sale by itself, it has to be shelved.
  items: Partial<Record<ItemId, number>>;
  // What's actually on display and purchasable at each shop, keyed by
  // shop kind. Fed two ways: the player manually shelves warehouse items
  // (`stockItem`), or — for feed-shop commodity staples only — an NPC
  // supplier restocks it directly, at a cost to `gold` (see expenseFeedRestock).
  shopStock: Record<ShopKind, Partial<Record<ItemId, number>>>;
  // Lifetime cumulative income counters by source, kept separate from the
  // spendable `gold` balance above so a future ledger/stats screen can show
  // where the town's money has come from. These only ever go up.
  tollFromHunt: number;
  tollFromFood: number;
  tollFromTraveler: number;
  // Revenue from birds actually buying shop goods (feed-shop food, or
  // weapons/armor/rare from the general shop) — distinct from tollFromFood,
  // which is only ever the optional payment for the always-free basic ration.
  tollFromShop: number;
  // Lifetime cumulative expense (not income) — gold spent restocking the
  // feed shop's commodity staples from the NPC supplier. Only goes up,
  // tracked separately so a future ledger can show costs, not just income.
  expenseFeedRestock: number;
}

// ---- World entities (persistent, ephemeral session state) ----

export interface EnemyInstance {
  uid: string;
  defId: string;
  name: string;
  emoji: string;
  x: number; // 0..1 position in the world
  y: number;
  hp: number;
  maxHp: number;
  atk: number;
  goldReward: number;
  expReward: number;
  dropTable: EnemyDropEntry[];
  defeated: boolean;
  respawnAt: number | null; // epoch ms; set when defeated, revives once passed
  // Cumulative damage dealt by each attacking bird (keyed by defId) while
  // this incarnation of the enemy is alive — used to split the kill reward
  // proportionally. Reset to {} whenever the enemy respawns.
  damageLog: Record<string, number>;
}

export interface MiningNodeInstance {
  uid: string;
  defId: string;
  name: string;
  x: number;
  y: number;
  resource: MaterialId;
  amount: number;
  collected: boolean;
  respawnAt: number | null;
}

export interface TreasureNodeInstance {
  uid: string;
  defId: string;
  name: string;
  x: number;
  y: number;
  goldReward: number;
  collected: boolean;
  respawnAt: number | null;
}

// Leisure spots are always available (not consumable) — just somewhere an
// otherwise-idle bird can go bathe or fish instead of aimlessly wandering.
export type LeisureKind = 'river' | 'pond';

export interface LeisureSpotDef {
  id: string;
  name: string;
  emoji: string;
  kind: LeisureKind;
  x: number;
  y: number;
}

export interface LeisureSpotInstance {
  uid: string;
  defId: string;
  name: string;
  emoji: string;
  kind: LeisureKind;
  x: number;
  y: number;
}

// What a bird is visibly doing this tick, for animation purposes.
export type ActivityKind =
  | 'enemy'
  | 'mining'
  | 'treasure'
  | 'idle'
  | 'resting'
  | 'eating'
  | 'bathing'
  | 'fishing'
  | 'carrying'
  | 'selling'
  | 'buyingGear';

// A pursuit goal a bird's AI is actively working toward. A job is just a
// mining/treasure pursuit restricted to a specific request's material and
// tagged with which request it fulfills (see BirdState.currentJobId).
export type TargetKind = 'enemy' | 'mining' | 'treasure' | 'river' | 'pond' | 'explore' | 'rest' | 'shop';

// The four things every bird can choose to do — personality only weights
// how likely each one is to be picked, it never rules one out entirely.
export type ActivityCategory = 'combat' | 'mining' | 'explore' | 'rest';

export interface BirdState {
  defId: string; // birds are fixed individuals, defId doubles as identity
  name: string;
  x: number; // 0..1 position in the world
  y: number;
  hp: number;
  maxHp: number;
  atk: number;
  defense: number;
  speed: number;
  luck: number;
  // Numeric meters behind the mood label. satiety decays over time and
  // drives the 'hungry' mood (see SATIETY_HUNGRY_THRESHOLD); happiness
  // drifts up/down alongside the current mood — both shown on the roster
  // card alongside the existing text mood, not replacing it.
  satiety: number; // 0..100
  happiness: number; // 0..100
  mood: MoodId;
  moodChangedAt: number; // epoch ms, for periodic mood refresh
  targetKind: TargetKind | null;
  targetRefUid: string | null;
  workProgress: number;
  activity: ActivityKind;
  currentJobId: string | null;
  // Set the moment a free-roaming (non-job) bird finishes gathering a
  // mining node; cleared once it carries the haul back to its own house
  // and the material is credited to its personal inventory.
  carrying: { materialId: MaterialId; amount: number } | null;
  // Each bird's own economy — materials it has personally gathered/earned,
  // and gold from combat, treasure, job rewards, and sales at the shop.
  // Only what the player actually buys from a bird moves into the town's
  // shared stash (PlayerState.materials).
  gold: number;
  inventory: Record<MaterialId, number>;
  // Loot dropped by monsters (weapons/armor/rare trinkets) — personal, like
  // the rest of a bird's belongings; not something the player buys.
  items: Partial<Record<ItemId, number>>;
  // One item per slot, auto-filled the moment a bird acquires an
  // equippable item (bought or dropped) for a slot that's still empty —
  // see game/birdStats.ts's maybeAutoEquip. Never auto-replaces something
  // already equipped; extra copies just sit unequipped in `items`.
  equipment: Record<EquipSlot, ItemId | null>;
  // Provisional growth system: exp comes only from combat contribution.
  // `exp` resets toward 0 each time it crosses the current level's
  // threshold (see expToNextLevel in game/config.ts) rather than
  // accumulating as a lifetime total.
  level: number;
  exp: number;
  // Ambient wander destination, used when a bird has nothing more pressing
  // to do — persisted so it commits to a direction instead of jittering.
  wanderX: number | null;
  wanderY: number | null;
}

export type JobStatus = 'open' | 'inProgress' | 'done';

// A request posted on the board: "I want N of material X, here's the
// reward" — birds decide for themselves whether to take it.
export interface JobRequest {
  id: string;
  materialId: MaterialId;
  amount: number;
  reward: number; // gold
  status: JobStatus;
  acceptedBy: string | null; // bird defId
  createdAt: number;
}

// A short, human-readable line for the on-screen activity log — "who did
// what, and what happened" — capped to the most recent N entries (see
// ACTIVITY_LOG_MAX in game/config.ts). Ephemeral like the rest of WorldState.
export interface ActivityLogEntry {
  id: string;
  timestamp: number;
  birdName: string | null; // null for town-level events with no specific bird (e.g. a traveler visit)
  action: string; // short category tag: 'gather' | 'kill' | 'sell' | 'buyFood' | 'job' | 'traveler' | 'levelUp'
  detail: string; // the actual displayed sentence
}

export interface WorldState {
  enemies: EnemyInstance[];
  miningNodes: MiningNodeInstance[];
  treasures: TreasureNodeInstance[];
  leisureSpots: LeisureSpotInstance[];
  birds: BirdState[];
  requests: JobRequest[];
  activityLog: ActivityLogEntry[];
}

// ---- Town expansion (land grid) ----

// Purely cosmetic placeholders until a crafting/shop economy exists —
// placing one just makes the town look more developed.
export type BuildingKind = 'workshop' | 'shop' | 'warehouse';

export interface PlotUnlockCost {
  gold: number;
  materialId?: MaterialId;
  materialAmount?: number;
}

// Design-time definition of one buildable cell in the town grid.
export interface TownPlotDef {
  id: string;
  x: number;
  y: number;
  unlockedByDefault: boolean;
  unlockCost: PlotUnlockCost | null; // null when unlockedByDefault
}

// Persisted per-plot progress: whether the player has claimed the land yet,
// and what (if anything) they've put on it.
export interface TownPlotState {
  id: string;
  unlocked: boolean;
  building: BuildingKind | null;
}
