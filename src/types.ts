// Core data model for the idle-dungeon prototype.

export type MaterialId = 'gold' | 'ore' | 'gem';

export type SkillId = 'atk_up' | 'hp_up' | 'energy_regen_up';

export interface SkillDef {
  id: SkillId;
  name: string;
  description: string;
}

export type CharacterRole = 'attacker' | 'healer';

export interface CharacterDef {
  id: string;
  name: string;
  role: CharacterRole;
  description: string;
  color: string; // accent color for cards/UI
  emoji: string; // placeholder visual until real art is added
  baseAtk: number; // for healers, this is heal power instead of damage
  baseHp: number;
  summonCost: number; // energy cost to summon
  materialBonusPercent?: number; // bonus % applied to material rewards while alive
}

export interface EnemyDef {
  id: string;
  name: string;
  emoji: string;
  hp: number;
  atk: number;
  rewardMaterial: MaterialId;
  rewardAmount: number;
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
  rewardMaterial: MaterialId;
  rewardAmount: number;
}

export interface StageDef {
  id: string;
  name: string;
  staminaCost: number;
  clearRewardMaterial: MaterialId;
  clearRewardAmount: number;
  enemies: EnemyDef[];
  miningNodes: MiningNodeDef[];
  treasure?: TreasureNodeDef;
}

// ---- Persisted player state ----

export interface OwnedCharacter {
  defId: string;
  level: number;
}

export interface StageProgress {
  cleared: boolean;
  treasureCollected: boolean;
}

export interface PlayerState {
  stamina: number;
  staminaMax: number;
  staminaLastUpdated: number; // epoch ms
  materials: Record<MaterialId, number>;
  characters: OwnedCharacter[];
  stageProgress: Record<string, StageProgress>;
  unlockedStageIds: string[];
}

// ---- Ephemeral stage session state ----

export interface EnemyInstance {
  uid: string;
  defId: string;
  name: string;
  emoji: string;
  x: number; // 0..1 position in the arena
  y: number;
  hp: number;
  maxHp: number;
  atk: number;
  rewardMaterial: MaterialId;
  rewardAmount: number;
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
  rewardMaterial: MaterialId;
  rewardAmount: number;
  collected: boolean;
}

export interface SummonedUnit {
  uid: string;
  defId: string;
  name: string;
  hp: number;
  maxHp: number;
  atk: number;
}

export type StageSessionStatus = 'selecting_skill' | 'playing' | 'cleared';

// The party roams the arena freely: each time they're free, they head to
// whichever unresolved thing (enemy/rock/treasure) is nearest, and auto
// resolve it (fight/mine/open) on arrival before picking the next one.
export type TargetKind = 'enemy' | 'mining' | 'treasure';

export interface StageSession {
  stageId: string;
  status: StageSessionStatus;
  energy: number;
  energyMax: number;
  energyLastUpdated: number;
  energyRegenMs: number;
  selectedSkill: SkillId | null;
  enemies: EnemyInstance[];
  miningNodes: MiningNodeInstance[];
  treasure: TreasureNodeInstance | null;
  summonedUnits: SummonedUnit[];
  partyX: number; // 0..1, the party's current anchor position in the arena
  partyY: number;
  targetKind: TargetKind | null;
  targetRefUid: string | null;
  workProgress: number; // ticks spent working the current mining/treasure target
}
