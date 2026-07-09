// Core data model for the town-sim prototype.

export type MaterialId = 'wood' | 'ore' | 'mushroom';

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

export interface EnemyDef {
  id: string;
  name: string;
  emoji: string;
  hp: number;
  atk: number;
  goldReward: number;
}

export interface MiningNodeDef {
  id: string;
  name: string;
  resource: MaterialId;
  amount: number;
}

export interface TreasureNodeDef {
  id: string;
  name: string;
  goldReward: number;
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
}

export interface TreasureNodeInstance {
  uid: string;
  defId: string;
  name: string;
  x: number;
  y: number;
  goldReward: number;
  collected: boolean;
}

// What a bird is visibly doing this tick, for animation purposes.
export type ActivityKind = 'enemy' | 'mining' | 'treasure' | 'idle' | 'resting';

// A pursuit goal a bird's AI is actively working toward. A job is just a
// mining/treasure pursuit restricted to a specific request's material and
// tagged with which request it fulfills (see BirdState.currentJobId).
export type TargetKind = 'enemy' | 'mining' | 'treasure' | 'wander';

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
  birds: BirdState[];
  requests: JobRequest[];
}
