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
  // Equipment expansion (see data/items.ts's Correction note): 4 tiers per
  // weapon type/armor slot, normal→rare (epic+ and set-exclusive pieces are
  // deliberately out of scope for this pass — see the request's own "変わり
  // 種武器・伝説の武器は別途" carve-out). The original 4 starter items
  // (rustySword/leatherArmor/leatherHat/woodenShield) are kept as-is and
  // simply slot into this tier chain as each line's tier-2 entry, so
  // existing recipes/job presets/drop tables referencing them by id never
  // needed to change.
  | 'swordTraining'
  | 'rustySword'
  | 'swordSilver'
  | 'swordFlame'
  | 'staffWood'
  | 'staffFlower'
  | 'staffClover'
  | 'staffStar'
  | 'bowWood'
  | 'bowHunter'
  | 'bowHeart'
  | 'bowWind'
  | 'hammerWood'
  | 'hammerIron'
  | 'hammerAcorn'
  | 'hammerFlower'
  | 'knuckleCloth'
  | 'knuckleLeather'
  | 'knuckleSpike'
  | 'knuckleCat'
  | 'headLeaf'
  | 'leatherHat'
  | 'headFlower'
  | 'headForest'
  | 'bodyCloth'
  | 'leatherArmor'
  | 'bodyTunic'
  | 'bodyDress'
  | 'handCloth'
  | 'woodenShield'
  | 'handMitten'
  | 'handFlowerGlove'
  | 'footCloth'
  | 'footLeather'
  | 'footFlower'
  | 'footForest'
  | 'luckyCharm'
  | 'ancientGem'
  // Convertible-only treasure — never equippable/consumable, never shelved
  // at a shop; exists purely to be sold to the visiting merchant (see
  // ItemType).
  | 'goldBar'
  | 'royalJewelry'
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
  | 'luckyTreat'
  // Phase 15③: 食堂(restaurant) — a couple of sample dishes, distinct from
  // the feed shop's plain everyday food/premium-feed lines above.
  | 'gourmetSoup'
  | 'sweetPudding'
  // Phase 15③: おもちゃ屋(toy shop) — a new 'toy' ItemCategory (see below),
  // craftable/shelvable through the exact same pipeline as any other
  // ItemDef, per the request's own "既存の拡張パターンに従ってよい".
  | 'toyBall'
  | 'toyFeather';

// What genre of shop carries an item — also which shop building it can be
// crafted "at" (see data/shops.ts) and shelved into. weapon/head/body/hand/
// foot double as the five equipment slots (see EquipSlot) — rare/food are
// goods, not gear, and can't be equipped.
// Phase 15③: 'toy' is おもちゃ屋's own category — a plain, non-equippable
// goods category (like 'food'/'rare'), added rather than reusing 'rare'
// since toys are ordinary shelvable/craftable goods, not treasure sold to
// the visiting merchant.
export type ItemCategory = 'weapon' | 'head' | 'body' | 'hand' | 'foot' | 'rare' | 'food' | 'toy';

// 'craft' items are usable (equippable gear or consumable food) and flow
// through the normal player warehouse → shop shelf pipeline. 'convertible'
// items have no gameplay use at all — they exist purely to be sold to the
// visiting merchant for cash (see MerchantState) and never enter the
// player's warehouse; a bird sells one straight out of its own inventory.
export type ItemType = 'craft' | 'convertible';

// The five equipment slots a bird has, one item each. Deliberately the same
// literal values as their matching ItemCategory so "which slot does this
// item go in" never needs a separate lookup table. Replaces the original
// weapon/armor/hat/shield 4-slot layout (see data/items.ts's Correction
// note) — the reference sheet driving this expansion has no shield-
// equivalent slot at all, so `woodenShield` was folded into `hand` instead
// of keeping a 5th slot with only one item ever in it.
export type EquipSlot = 'weapon' | 'head' | 'body' | 'hand' | 'foot';

// Which of the 5 weapon lines a `weapon`-category item belongs to — display/
// flavor only today (there's no per-line combat mechanic, e.g. staff MP
// effects aren't actually implemented; see ItemStatBonus's mp/cri/eva
// comment), but keeps "5 types, one weapon slot" honest: a bird can only
// ever have one weapon equipped regardless of type, exactly matching the
// request's own "5系統のうち1つを選んで装備".
export type WeaponType = 'sword' | 'staff' | 'bow' | 'hammer' | 'knuckle';

// 6-tier rarity ladder (see data/items.ts's RARITY_LABELS/RARITY_COLORS for
// display). Only 'normal'/'uncommon'/'rare' are populated with real items in
// this pass — 'epic'/'legendary'/'mythic' exist in the type now so the next
// pass (higher-tier gear, per the request's own staged rollout) is a data-
// only addition, no schema change.
export type Rarity = 'normal' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';

// Cosmetic-only "costume" catalog (see data/cosmetics.ts) — a completely
// separate slot from EquipSlot above: a bird has at most *one* cosmetic
// equipped at a time (BirdState.cosmeticId/BirdWallet.cosmeticId), it
// carries no ItemStatBonus, and it isn't tracked as owned inventory the
// way weapon/head/body/hand/foot items are — every cosmetic is always
// available to any bird to wear or remove freely (how a player *acquires*
// one, e.g. a shop/gacha/event, is intentionally out of scope for now; see
// data/cosmetics.ts's own comment). One shared image per cosmetic is reused
// across all 4 birds rather than a per-bird recolor.
export type CosmeticCategory = 'costume' | 'outfit' | 'cute' | 'event' | 'theme' | 'seasonal';

// Which physical shop building this is. 'general' (head/hand/foot gear) and
// 'feed' always exist on a fixed town plot from the start; 'weapon'/'armor'
// (armor meaning 'body' specifically) don't have a fixed plot at all — they
// only come into being once the player constructs one (see data/
// buildingOptions.ts), so they start the game completely unavailable rather
// than merely locked-and-visible.
// Phase 15③ shop expansion — same "construct it first" rule as weapon/armor:
// 'clothing' (服屋/仕立て屋) opens the existing costume craft/gift screen
// (see CostumeCollectionModal) rather than the plain ItemDef shelf every
// other kind uses; 'restaurant' (食堂) and 'toy' (おもちゃ屋) are ordinary
// ItemDef shops like general/feed, just with their own category/shelf;
// 'furniture' (家具屋) opens a dedicated craft screen producing mayor's-room
// furniture (see useMayorRoomStore) instead of a warehouse item; 'mystery'
// (怪しいアイテム屋) opens a gacha-style draw instead of a shelf at all.
export type ShopKind = 'general' | 'feed' | 'weapon' | 'armor' | 'clothing' | 'restaurant' | 'furniture' | 'toy' | 'mystery';

// Forward-looking, currently-unused bonus hooks a food item could carry —
// present purely as data so a later pass can wire actual effects (HP
// recovery on eating, a temporary exp boost, etc.) without a schema change.
export interface ItemEffects {
  hpRestorePercent?: number;
  expBonusPercent?: number;
}

// Stat bonuses an equippable item (weapon/head/body/hand/foot) grants while
// equipped — added on top of the wearer's own base stats (see
// game/birdStats.ts's getEffectiveStats). mp/cri/eva are new alongside this
// equipment expansion (the request's own "ATK/DEF/HP/MP/SPD/LUK/CRI/EVA"
// stat list) — like speed/luck already were, they're computed and shown on
// the roster card but have no consuming mechanic yet (no MP resource, no
// crit/evasion roll in combat): adding the actual systems those would need
// is a much bigger, separate change than "expand the equipment catalog",
// so for now they follow the exact same "real data, display-only" precedent
// speed/luck already established rather than half-building a combat rework
// under an equipment-data request. hp is similar but merges into effective
// maxHp (see getEffectiveStats) since maxHp already existed as a real stat.
export interface ItemStatBonus {
  atk?: number;
  defense?: number;
  speed?: number;
  luck?: number;
  hp?: number;
  mp?: number;
  cri?: number; // percentage points, e.g. 5 means +5%
  eva?: number; // percentage points
}

// A themed run of gear (see data/equipmentSets.ts) — equipping several
// pieces tagged with the same setId grants an extra bonus on top of each
// piece's own statBonus once enough are worn at once. Data-structure-only
// for this pass per the request's own "今回は仕組みだけ" — only a couple of
// EQUIPMENT_SETS entries carry a real bonus; most gear has no setId at all.
export interface EquipmentSetBonusTier {
  // How many pieces from this set must be equipped at once to grant this
  // tier's bonus. Tiers are independent, not cumulative — see
  // game/birdStats.ts's getSetBonus, which applies only the highest tier
  // the wearer currently qualifies for.
  piecesRequired: number;
  statBonus: ItemStatBonus;
  // Short human-readable description of the tier (shown on the roster card
  // once a set bonus is active) — separate from ItemStatBonus since a set
  // bonus could describe a non-stat effect in a future pass.
  label: string;
}

export interface EquipmentSetDef {
  id: string;
  name: string;
  itemIds: ItemId[];
  bonusTiers: EquipmentSetBonusTier[];
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
  // Short tag shown on the starter-selection screen (e.g. "回復・サポート役")
  // — a human-readable gloss of role+personality, not a mechanical field.
  roleLabel: string;
  color: string; // accent color for UI
  emoji: string; // placeholder visual until real art is added
  baseAtk: number; // for healers, this is heal power instead of damage
  baseHp: number;
  baseDefense: number;
  baseSpeed: number; // reserved for future movement/turn-order use; display-only today
  baseLuck: number; // reserved for future drop/crit-rate use; display-only today
  materialBonusPercent?: number; // bonus % applied when this bird delivers materials
  // Phase 15②: whether this character is offered on CharacterSelectScreen's
  // starter picker. Absent (or true) for the original 4 — a later recruit
  // like アルシェル (who joins via the shrine's own restoration condition,
  // see game/recruitment.ts's checkAlshel) sets this false so she doesn't
  // show up as a pickable starting bird before she's even met.
  isStarter?: boolean;
}

// One possible drop roll on a kill or a gather — independently checked
// against `chance` (0..1) per entry, so a source can drop several things (or
// nothing) from the same event. Rolled fresh each time, awarded to one
// random participant (for enemies, whoever's in damageLog; for mining nodes,
// the gathering bird). Shared by EnemyDef.dropTable and
// MiningNodeDef.bonusDropTable.
export type DropEntry =
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
  dropTable?: DropEntry[];
  x: number;
  y: number;
  // Field-zone content past this town level is excluded from AI targeting
  // and map rendering entirely (see useWorldStore's tick/WorldMap) — how the
  // adventure field grows alongside the town's own development. Absent (or
  // 1) means always available.
  minTownLevel?: number;
}

export interface MiningNodeDef {
  id: string;
  name: string;
  resource: MaterialId;
  amount: number;
  // Optional low-chance extra rolls on a successful gather, on top of the
  // guaranteed `resource` — used for the handful of precious nodes that can
  // also yield convertible treasure (gems, ancient coins) alongside their
  // normal material.
  bonusDropTable?: DropEntry[];
  x: number;
  y: number;
  // See EnemyDef.minTownLevel — same field-zone level gating.
  minTownLevel?: number;
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
  // The town's 50% cut ("market usage fee") whenever a bird sells a
  // convertible item to the visiting merchant. Separate from tollFromShop,
  // which is the town's revenue when birds spend gold *at* a shop, not when
  // they sell something to one.
  tollFromMerchant: number;
  // Lifetime cumulative expense (not income) — gold spent restocking the
  // feed shop's commodity staples from the NPC supplier. Only goes up,
  // tracked separately so a future ledger can show costs, not just income.
  expenseFeedRestock: number;
}

// ---- World entities (persistent, ephemeral session state) ----

// An enemy's current movement behavior (see game/enemyAi.ts's stepEnemy):
// 'patrol' wanders near its anchor point, 'chase' pursues a spotted bird,
// 'return' walks back to its anchor once the chase is given up.
export type EnemyRoamState = 'patrol' | 'chase' | 'return';

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
  dropTable: DropEntry[];
  defeated: boolean;
  respawnAt: number | null; // epoch ms; set when defeated, revives once passed
  // Cumulative damage dealt by each attacking bird (keyed by defId) while
  // this incarnation of the enemy is alive — used to split the kill reward
  // proportionally. Reset to {} whenever the enemy respawns.
  damageLog: Record<string, number>;
  // The center of this enemy's patrol territory — set from its EnemyDef
  // position at spawn, and re-randomized nearby (not reset to the exact
  // same spot) each time it respawns after being defeated.
  anchorX: number;
  anchorY: number;
  roamState: EnemyRoamState;
  // Current patrol waypoint, while roamState is 'patrol' — null between legs.
  wanderX: number | null;
  wanderY: number | null;
  // Which bird's currently being chased, while roamState is 'chase'.
  chaseTargetId: string | null;
  // Copied from EnemyDef.minTownLevel at spawn — see that field's comment.
  minTownLevel: number;
}

export interface MiningNodeInstance {
  uid: string;
  defId: string;
  name: string;
  x: number;
  y: number;
  resource: MaterialId;
  amount: number;
  bonusDropTable: DropEntry[];
  collected: boolean;
  respawnAt: number | null;
  // Copied from MiningNodeDef.minTownLevel at spawn — see that field's comment.
  minTownLevel: number;
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
  | 'buyingGear'
  | 'merchantSelling'
  | 'merchantBuying'
  | 'recovering'
  // Phase 11: a short aimless stroll near town (see ai.ts's executeDetour),
  // and playing at a constructed park/bathhouse (see executePlay).
  | 'strolling'
  | 'playing'
  // Phase 11 follow-up: an ambient two-bird chat pause (see BirdState.
  // chatPauseTicks) and a longer, discretionary at-home nap (see
  // ai.ts's executeNap) — both added so the new flavor behaviors read as a
  // visible "stop and do this" beat instead of birds staying in constant
  // motion.
  | 'chatting'
  | 'napping'
  // Phase 15①: visiting the mayor's room (see ai.ts's executeVisitMayorRoom)
  // — warp-like (the room has its own dedicated coordinate space, see
  // useMayorRoomStore), same "stop and do this" shape as playing/napping.
  | 'visiting';

// A pursuit goal a bird's AI is actively working toward. A job is just a
// mining/treasure pursuit restricted to a specific request's material and
// tagged with which request it fulfills (see BirdState.currentJobId).
// 'detour' and 'play' are Phase 11 additions — see ai.ts's executeDetour/
// executePlay. 'nap' is the Phase 11 follow-up's at-home rest option (see
// executeNap) — grouped under the same 'rest' ActivityCategory as
// 'river'/'pond'/'rest' itself (see categoryOf).
export type TargetKind =
  | 'enemy'
  | 'mining'
  | 'treasure'
  | 'river'
  | 'pond'
  | 'explore'
  | 'rest'
  | 'shop'
  | 'townHall'
  | 'detour'
  | 'play'
  | 'nap'
  // Phase 15①: heading to (warping into) the mayor's room — see
  // ai.ts's executeVisitMayorRoom.
  | 'mayorRoom';

// The five things every bird can choose to do — personality only weights
// how likely each one is to be picked, it never rules one out entirely.
// 'play' (Phase 11) only ever gets picked if at least one park/bathhouse has
// been constructed (see ai.ts's pickCategory). 'visit' (Phase 15①) is always
// available — the mayor's room is part of the always-present town hall, not
// a constructible building.
export type ActivityCategory = 'combat' | 'mining' | 'explore' | 'rest' | 'play' | 'visit';

export interface BirdState {
  defId: string; // birds are fixed individuals, defId doubles as identity
  name: string;
  // Whether this bird has joined the town yet. The game starts with only
  // the player's chosen starter recruited; the other three sit dormant
  // (all their phase-0 stats/economy still tracked, just not rendered or
  // AI-stepped) until a future phase adds a real recruitment trigger.
  isRecruited: boolean;
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
  // A job's own 3-leg errand, separate from targetKind (which just tracks
  // *where* the bird is currently walking): visit the town hall to take
  // the job on, do the actual gathering/hunting, then visit the town hall
  // again to hand it in and collect the reward — real-device request so
  // accepting/completing a job reads as an actual errand rather than an
  // instantaneous status flip. null whenever currentJobId is null.
  jobStage: 'toAccept' | 'working' | 'toDeliver' | null;
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
  // Purely cosmetic "costume" (see data/cosmetics.ts) — entirely separate
  // from `equipment` above: never affects getEffectiveStats, freely
  // changeable at any time via useWorldStore's setCosmetic (a direct
  // player action, unlike `equipment`'s auto-equip-only flow).
  cosmeticId: string | null;
  // A bird's own house storage — player-managed, tapped into via the
  // HouseInventoryModal, distinct from the automatic inventory/items above.
  // Food stashed here is eaten (see ai.ts's stepShopFood) before a hungry
  // bird walks to the feed shop at all. Capped at HOUSE_FOOD_CAP total
  // units (see game/config.ts).
  houseFood: Partial<Record<ItemId, number>>;
  // Convertible items the player has manually set aside as a bird's
  // "favorites" — moved out of `items` entirely (not just flagged), so
  // they're automatically excluded from the autonomous sell-to-merchant
  // logic (see ai.ts's hasConvertibleItems/pickMerchantSellOffer, which
  // only ever look at `items`). Capped at HOUSE_TREASURE_CAP entries.
  houseTreasureIds: ItemId[];
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
  // Phase 11's ひらめき (inspiration) system: permanent skill ids acquired
  // while playing at a park/bathhouse (see data/skills.ts, ai.ts's
  // executePlay) — persisted (see BirdWallet), unlike the two fields below.
  skills: string[];
  // Ephemeral flavor-text speech bubble — reused for both the ambient
  // "two nearby birds chat" event (set from useWorldStore's tick, since only
  // it sees every bird at once) and the lightweight "💡ひらめいた" cue for a
  // stat-up inspiration (set from ai.ts's executePlay). Never persisted
  // (not part of BirdWallet), same as wanderX/wanderY/moodChangedAt above —
  // it's just this session's transient presentation, not real progress.
  // chatLineSetAt lets BirdSprite detect a *new* line even when the text
  // happens to repeat (see WorldMap.tsx's BirdSprite, which watches this
  // timestamp the same way it already watches bird.hp for the retreat line).
  chatLine: string | null;
  chatLineSetAt: number;
  // Ticks remaining in an ambient chat pause (see useWorldStore's tick) —
  // while > 0, stepBird holds the bird in place (no movement, no other
  // decisions) so the chat bubble above actually reads as "stopped to talk"
  // instead of drifting away mid-conversation. Ephemeral, same as
  // chatLine/chatLineSetAt — never persisted.
  chatPauseTicks: number;
  // Phase 14 (real-time revision): epoch ms this *recruited* bird has been
  // continuously without an assigned house (see HouseState.residentDefId)
  // since, or null while it has one. A plain wall-clock timestamp rather
  // than a tick counter — comparing Date.now() against this is automatically
  // correct whether the app was open or closed in between, with no special
  // offline-catchup handling needed (unlike most of this game's other
  // online/offline-sensitive systems) — see game/config.ts's HOUSELESS_*_MS
  // for why the first, tick-based version of this undercounted real time
  // whenever the app was closed. Persisted (see BirdWallet's matching
  // field), reset to null the moment the bird gets a house or receives a
  // cheer-up gift (see useWorldStore's tick/giveGiftToBird).
  houselessSinceMs: number | null;
  // One-shot flags so the "拗ね始めた" log line / the warning modal each
  // fire exactly once per houseless episode, not every tick for as long as
  // elapsed time stays past the threshold (see useWorldStore's tick — with
  // wall-clock elapsed time recomputed fresh each tick instead of a
  // per-tick delta, there's no other cheap way to tell "did this already
  // fire"). Both reset to false whenever houselessSinceMs resets.
  houselessSulkLogged: boolean;
  houselessWarningShown: boolean;
}

export type JobStatus = 'open' | 'inProgress' | 'done';

// What kind of work a request asks for — each kind targets a different
// existing system and tracks progress differently (see stepJob in ai.ts and
// useWorldStore's tick/reportCraftCompleted/deliverToMerchant):
// - 'gather': deliver N of a material (the original job type; a bird
//   physically gathers and carries it, same as free-roam mining).
// - 'hunt': defeat N of a specific enemy species (by name — enemies share a
//   name across their several map instances, e.g. all オオカミ spawns count).
//   The accepting bird actively seeks that enemy out (see stepJob).
// - 'craft': craft N of a specific item at any shop's crafting panel — a
//   player action, not something the accepting bird does itself.
// - 'merchantDeliver': deliver N of a specific item to the visiting
//   merchant while present — also a player action (see deliverToMerchant),
//   and impossible to progress while no merchant has arrived yet.
export type JobKind = 'gather' | 'hunt' | 'craft' | 'merchantDeliver';

// A request posted on the board — birds decide for themselves whether to
// take it (see game/requests.ts's scoring, which is kind-agnostic). Exactly
// one of materialId/enemyName/itemId is set, matching `kind`.
export interface JobRequest {
  id: string;
  kind: JobKind;
  materialId: MaterialId | null; // set only when kind === 'gather'
  enemyName: string | null; // set only when kind === 'hunt'
  itemId: ItemId | null; // set only when kind === 'craft' | 'merchantDeliver'
  amount: number;
  reward: number; // gold, paid to the completing bird
  // Granted to the completing bird alongside the gold reward (see grantExp
  // in useWorldStore) — jobs previously gave no exp at all, unlike combat.
  expReward: number;
  // Added to the town's developmentPoints on completion (see useTownStore) —
  // a separate currency from reward/expReward that drives townLevel up
  // through its named tiers (data/townGrid.ts's TOWN_LEVEL_DEFS).
  developmentPoints: number;
  // Added to the town's reputation on completion (see useTownStore) —
  // tracked independently from developmentPoints on purpose; nothing reads
  // it yet (future museum/merchant-frequency hooks), it just accumulates.
  reputationPoints: number;
  status: JobStatus;
  acceptedBy: string | null; // bird defId
  createdAt: number;
  // Cumulative progress so far, in whatever unit `kind` counts (materials
  // delivered, enemies defeated, items crafted/delivered) — accumulates
  // until it reaches `amount`. Starts at 0 when posted.
  delivered: number;
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

// One slot on the visiting merchant's shelf this visit — a fixed random
// quantity decided when the merchant arrives, decremented as birds buy it.
export interface MerchantLineupEntry {
  itemId: ItemId;
  amount: number;
}

// A temporary shop-on-legs distinct from the traveler NPC: sets up for a
// stretch of days, offers a randomized (mostly-normal, rarely-rare) lineup
// for purchase, and buys convertible items off birds for a 50/50 gold split
// with the town. Absent (null) between visits.
export interface MerchantState {
  arrivedAt: number; // epoch ms
  departsAt: number; // epoch ms; tick() clears the merchant once passed
  lineup: MerchantLineupEntry[];
  // A recipe the merchant is willing to teach for gold this visit — one of
  // the 4 recipe-unlock routes (see game/recipeUnlocks.ts), player-
  // initiated rather than bird-autonomous (see useWorldStore's
  // buyMerchantRecipe). Null if no offer was rolled, or after it's bought.
  recipeOffer: { recipeId: string; price: number } | null;
}

export interface WorldState {
  enemies: EnemyInstance[];
  miningNodes: MiningNodeInstance[];
  treasures: TreasureNodeInstance[];
  leisureSpots: LeisureSpotInstance[];
  birds: BirdState[];
  requests: JobRequest[];
  activityLog: ActivityLogEntry[];
  merchant: MerchantState | null;
  // Ever-growing log of dormant-bird recruitments this session (defId per
  // event) — the UI queues off this to show a join announcement for each
  // one exactly once (see TownScreen), without needing to guess whether a
  // given event has already been shown.
  recruitmentEvents: string[];
  // Same queued-event pattern as recruitmentEvents, for newly-unlocked
  // recipes (see game/recipeUnlocks.ts) — deliberately NOT persisted (world
  // itself is rebuilt fresh each launch via initWorld), so there's never a
  // backlog of already-seen unlocks to replay on a later session.
  recipeUnlockEvents: { recipeId: string; source: RecipeSource }[];
  // Same queued-event pattern, for Phase 11's rare "skill acquired" event
  // (see data/skills.ts, ai.ts's executePlay) — a stat-up inspiration is
  // common enough to just be a log line + speech bubble (see
  // BirdState.chatLine), but a new skill gets its own notification modal,
  // same weight as a recipe unlock. Not persisted, same reasoning as
  // recipeUnlockEvents above.
  skillUnlockEvents: { birdName: string; skillId: string }[];
  // Same queued-event pattern, for a newly-*obtained* costume ticket (see
  // game/cosmeticUnlocks.ts, useCosmeticStore) — fires on find/drop/craft,
  // i.e. when a ticket lands in the player's warehouse, not when it's later
  // gifted to actually unlock the costume for wearing (that's a deliberate
  // player action with its own immediate UI feedback, so it doesn't need a
  // separate announcement). Not persisted, same reasoning as
  // recipeUnlockEvents above.
  cosmeticTicketEvents: { cosmeticId: string; source: CosmeticSource }[];
  // Same queued-event pattern, for Phase 14's houseless-sulk system (see
  // game/config.ts's HOUSELESS_WARNING_MS/HOUSELESS_LEAVE_MS,
  // useWorldStore's tick) — a warning fires once when a recruited bird's
  // gone without an assigned house long enough that it risks leaving; a
  // departure fires once if nothing (a house, or a cheer-up gift) resolved
  // that in time. Not persisted, same reasoning as recipeUnlockEvents above
  // — the underlying houselessSinceMs timestamp that drives *when* these fire
  // is what's actually persisted (see BirdWallet), so a fresh session still
  // re-derives the correct event at the correct tick rather than losing it.
  houseWarningEvents: BirdHouseEvent[];
  houseDepartureEvents: BirdHouseEvent[];
}

// Shared payload shape for both houseWarningEvents/houseDepartureEvents —
// just enough for a notification modal to name the bird (see TownScreen).
export interface BirdHouseEvent {
  defId: string;
  name: string;
}

// A house on the map, independent of any particular bird (Phase 14) — the
// old model (data/houses.ts's HOUSE_POSITIONS) baked identity/position/art
// into the bird's own defId, one fixed house per one of exactly 4
// characters. That stopped working the moment the roster was meant to grow
// past 4 (future recruits — シジュウカラ, フクロウ, etc. — per the original
// design docs): a house now exists on its own, at a freely-chosen position,
// and only *optionally* has a resident. `residentDefId: null` is the normal,
// expected state for a freshly-built house, not an error case.
export interface HouseState {
  id: string;
  x: number;
  y: number;
  residentDefId: string | null;
}

// Phase 15①: one placed furniture/mannequin piece inside the mayor's room
// (see useMayorRoomStore, data/furniture.ts's FURNITURE_DEFS). x/y are 0..1
// coordinates in the room's OWN dedicated canvas — a separate space from
// every other x/y in this file (world position, house position, plot
// position), per the request's own "街エリア内かの判定は不要" — this room has
// no relationship to the outdoor town zone at all.
export interface FurnitureInstance {
  id: string;
  defId: string;
  x: number;
  y: number;
}

// A gift a visiting bird left behind in the mayor's room (see ai.ts's
// executeVisitMayorRoom, useMayorRoomStore) — flavor-only, just a small log
// the player can look back through in MayorRoomModal.
export interface MayorRoomGiftEntry {
  id: string;
  itemId: ItemId;
  birdName: string;
  at: number; // epoch ms
}

// Which of the 4 routes (see game/recipeUnlocks.ts) taught the player a
// given recipe — recorded purely for potential future display (e.g. "found
// via combat"), not read by any gameplay logic yet.
export type RecipeSource = 'merchant' | 'gift' | 'quest' | 'combat';

// Which of the 3 ambient/craft routes (see game/cosmeticUnlocks.ts) put a
// costume *ticket* (CosmeticTicketState) in the player's warehouse — the
// 4th route, a player gifting an owned ticket to unlock the costume, is a
// deliberate action rather than a discovery, so it has no source label.
export type CosmeticSource = 'find' | 'drop' | 'craft';

// ---- Town expansion (land grid) ----

// What a constructed building looks like on the map. 'workshop' and
// 'warehouse' remain purely cosmetic leftovers with no construction option
// pointing at them yet; 'shop', 'garden', 'park' and 'bathhouse' are real,
// buildable outcomes (see data/buildingOptions.ts). 'park'/'bathhouse' are
// Phase 11's play destinations — decorative like 'garden' (no shopKind), but
// distinguished from it since AI targeting needs to find them specifically
// (see data/townGrid.ts's getAllAmenityPositions).
export type BuildingKind = 'workshop' | 'shop' | 'warehouse' | 'garden' | 'park' | 'bathhouse';

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
  // The outer ring can't even be attempted below this town level — the town
  // zone's own buildable land grows alongside its development stage, same
  // idea as EnemyDef/MiningNodeDef.minTownLevel for the field. Absent (or 1)
  // means always attemptable (subject to the usual gold/material cost).
  minTownLevel?: number;
}

// Persisted per-plot progress: whether the player has claimed the land yet,
// and what (if anything) they've put on it.
export interface TownPlotState {
  id: string;
  unlocked: boolean;
  building: BuildingKind | null;
  // Which data/buildingOptions.ts entry was actually constructed here, if
  // any — needed because `building` alone (a BuildingKind) can't tell two
  // same-kind options apart (e.g. the general-goods shop branch vs the feed
  // shop branch are both just 'shop'). Null for the always-present shop
  // plots (SHOP_PLOT_IDS) and for anything left over from the old
  // cosmetic-only cycleBuilding tap (pre-construction-system saves).
  constructedBuildingId: string | null;
}
