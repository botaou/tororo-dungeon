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
  materialBonusPercent?: number; // bonus % applied when this bird delivers materials
}

// Defs carry a hand-placed design-time position (0..1) so the world reads
// as a deliberately laid-out diorama instead of randomly scattered items.
export interface EnemyDef {
  id: string;
  name: string;
  emoji: string;
  hp: number;
  atk: number;
  goldReward: number;
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
  gold: number;
  materials: Record<MaterialId, number>;
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
  defeated: boolean;
  respawnAt: number | null; // epoch ms; set when defeated, revives once passed
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
  | 'fishing';

// A pursuit goal a bird's AI is actively working toward. A job is just a
// mining/treasure pursuit restricted to a specific request's material and
// tagged with which request it fulfills (see BirdState.currentJobId).
export type TargetKind = 'enemy' | 'mining' | 'treasure' | 'river' | 'pond' | 'explore' | 'rest';

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
  mood: MoodId;
  moodChangedAt: number; // epoch ms, for periodic mood refresh
  targetKind: TargetKind | null;
  targetRefUid: string | null;
  workProgress: number;
  activity: ActivityKind;
  currentJobId: string | null;
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

export interface WorldState {
  enemies: EnemyInstance[];
  miningNodes: MiningNodeInstance[];
  treasures: TreasureNodeInstance[];
  leisureSpots: LeisureSpotInstance[];
  birds: BirdState[];
  requests: JobRequest[];
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
