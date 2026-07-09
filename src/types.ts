// Core data model for the idle-dungeon prototype.

export type MaterialId = 'gold' | 'ore' | 'gem';

export type SkillId = 'atk_up' | 'hp_up' | 'energy_regen_up';

export interface SkillDef {
  id: SkillId;
  name: string;
  description: string;
}

export type CharacterRole = 'attacker' | 'healer';

// Each character's independent AI personality:
// - vanguard: beelines for the nearest enemy, melee.
// - clingy: stays glued to the vanguard's side, assists whatever it fights.
// - cautious: hangs back behind the group; only lunges if an enemy gets
//   within her panic radius, otherwise just heals from a distance.
// - freeSpirit: prioritizes the nearest unclaimed rock/treasure, and only
//   joins the fight (assisting the vanguard) once nothing is left to gather.
export type Personality = 'vanguard' | 'clingy' | 'cautious' | 'freeSpirit';

export interface CharacterDef {
  id: string;
  name: string;
  role: CharacterRole;
  personality: Personality;
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

// What a unit is visibly doing this tick, for animation purposes — distinct
// from targetKind (its AI's pursuit goal), since e.g. the clingy/cautious
// personalities can be "fighting" without ever setting a pursuit target.
export type ActivityKind = 'enemy' | 'mining' | 'treasure' | 'idle';

export interface SummonedUnit {
  uid: string;
  defId: string;
  name: string;
  x: number; // 0..1 position in the arena, moved independently per unit
  y: number;
  hp: number;
  maxHp: number;
  atk: number;
  targetKind: TargetKind | null; // pursuit goal (vanguard/freeSpirit only)
  targetRefUid: string | null;
  workProgress: number; // ticks spent working the current mining/treasure target
  activity: ActivityKind;
}

export type StageSessionStatus = 'selecting_skill' | 'playing' | 'cleared';

// The party roams the arena freely: the vanguard beelines for the nearest
// enemy, the free spirit beelines for the nearest rock/treasure, and the
// other two follow/react rather than pursue independently.
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
}
