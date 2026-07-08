import { create } from 'zustand';

import {
  EnemyInstance,
  MiningNodeInstance,
  SkillId,
  StageSession,
  SummonedUnit,
  TreasureNodeInstance,
} from '../types';
import { getStageDef } from '../data/stages';
import { getCharacterDef } from '../data/characters';
import { resolveCombatRound } from '../game/combat';
import { ENERGY_MAX, ENERGY_REGEN_MS } from '../game/config';
import { usePlayerStore } from './usePlayerStore';

let uidCounter = 0;
function uid(prefix: string): string {
  uidCounter += 1;
  return `${prefix}_${uidCounter}_${Date.now()}`;
}

function atkMultiplier(skill: SkillId | null): number {
  return skill === 'atk_up' ? 1.3 : 1;
}
function hpMultiplier(skill: SkillId | null): number {
  return skill === 'hp_up' ? 1.3 : 1;
}
function energyRegenMs(skill: SkillId | null): number {
  return skill === 'energy_regen_up' ? Math.round(ENERGY_REGEN_MS / 1.5) : ENERGY_REGEN_MS;
}

const MAX_LOG_LINES = 30;

interface StageActions {
  enterStage: (stageId: string) => void;
  chooseSkill: (skillId: SkillId) => void;
  summon: (characterDefId: string) => void;
  tick: () => void;
  collectMiningNode: (nodeUid: string) => void;
  collectTreasureNode: () => void;
  exitStage: () => void;
}

interface StageStore {
  session: StageSession | null;
}

export const useStageStore = create<StageStore & StageActions>()((set, get) => ({
  session: null,

  enterStage: (stageId) => {
    const stage = getStageDef(stageId);
    const enemies: EnemyInstance[] = stage.enemies.map((e) => ({
      uid: uid('enemy'),
      defId: e.id,
      name: e.name,
      hp: e.hp,
      maxHp: e.hp,
      atk: e.atk,
      rewardMaterial: e.rewardMaterial,
      rewardAmount: e.rewardAmount,
      defeated: false,
    }));
    const miningNodes: MiningNodeInstance[] = stage.miningNodes.map((m) => ({
      uid: uid('mine'),
      defId: m.id,
      name: m.name,
      resource: m.resource,
      amount: m.amount,
      collected: false,
    }));
    const alreadyCollectedTreasure =
      usePlayerStore.getState().stageProgress[stageId]?.treasureCollected ?? false;
    const treasure: TreasureNodeInstance | null =
      stage.treasure && !alreadyCollectedTreasure
        ? {
            uid: uid('treasure'),
            defId: stage.treasure.id,
            name: stage.treasure.name,
            rewardMaterial: stage.treasure.rewardMaterial,
            rewardAmount: stage.treasure.rewardAmount,
            collected: false,
          }
        : null;

    set({
      session: {
        stageId,
        status: 'selecting_skill',
        energy: ENERGY_MAX,
        energyMax: ENERGY_MAX,
        energyLastUpdated: Date.now(),
        energyRegenMs: ENERGY_REGEN_MS,
        selectedSkill: null,
        enemies,
        miningNodes,
        treasure,
        summonedUnits: [],
        log: [`${stage.name}に突入！`],
      },
    });
  },

  chooseSkill: (skillId) => {
    const { session } = get();
    if (!session || session.status !== 'selecting_skill') return;
    set({
      session: {
        ...session,
        status: 'playing',
        selectedSkill: skillId,
        energyRegenMs: energyRegenMs(skillId),
        energyLastUpdated: Date.now(),
      },
    });
  },

  summon: (characterDefId) => {
    const { session } = get();
    if (!session || session.status !== 'playing') return;
    const def = getCharacterDef(characterDefId);
    if (session.energy < def.summonCost) return;

    const unit: SummonedUnit = {
      uid: uid('unit'),
      defId: def.id,
      name: def.name,
      atk: Math.round(def.baseAtk * atkMultiplier(session.selectedSkill)),
      maxHp: Math.round(def.baseHp * hpMultiplier(session.selectedSkill)),
      hp: Math.round(def.baseHp * hpMultiplier(session.selectedSkill)),
    };

    set({
      session: {
        ...session,
        energy: session.energy - def.summonCost,
        summonedUnits: [...session.summonedUnits, unit],
      },
    });
  },

  tick: () => {
    const { session } = get();
    if (!session) return;

    // Timestamp-based energy regen, robust to backgrounding.
    let energy = session.energy;
    let energyLastUpdated = session.energyLastUpdated;
    if (energy < session.energyMax) {
      const elapsed = Date.now() - energyLastUpdated;
      const gained = Math.floor(elapsed / session.energyRegenMs);
      if (gained > 0) {
        energy = Math.min(session.energyMax, energy + gained);
        energyLastUpdated = Date.now() - (elapsed - gained * session.energyRegenMs);
      }
    } else {
      energyLastUpdated = Date.now();
    }

    if (session.status !== 'playing') {
      set({ session: { ...session, energy, energyLastUpdated } });
      return;
    }

    const hasAliveEnemy = session.enemies.some((e) => !e.defeated && e.hp > 0);
    const hasAliveUnit = session.summonedUnits.some((u) => u.hp > 0);

    let { enemies, summonedUnits, log } = session;
    if (hasAliveEnemy && hasAliveUnit) {
      const result = resolveCombatRound(session.enemies, session.summonedUnits);
      enemies = result.enemies;
      summonedUnits = result.summonedUnits;
      if (Object.keys(result.rewards).length > 0) {
        usePlayerStore.getState().addMaterials(result.rewards);
      }
      if (result.logs.length > 0) {
        log = [...log, ...result.logs].slice(-MAX_LOG_LINES);
      }
    }

    const allDefeated = enemies.every((e) => e.defeated || e.hp <= 0);
    if (allDefeated) {
      usePlayerStore.getState().clearStage(session.stageId);
      set({
        session: {
          ...session,
          enemies,
          summonedUnits,
          energy,
          energyLastUpdated,
          status: 'cleared',
          log: [...log, 'ステージクリア！'].slice(-MAX_LOG_LINES),
        },
      });
      return;
    }

    set({ session: { ...session, enemies, summonedUnits, energy, energyLastUpdated, log } });
  },

  collectMiningNode: (nodeUid) => {
    const { session } = get();
    if (!session) return;
    const node = session.miningNodes.find((m) => m.uid === nodeUid);
    if (!node || node.collected) return;

    usePlayerStore.getState().addMaterials({ [node.resource]: node.amount });
    set({
      session: {
        ...session,
        miningNodes: session.miningNodes.map((m) =>
          m.uid === nodeUid ? { ...m, collected: true } : m
        ),
        log: [...session.log, `${node.name}から${node.resource}を${node.amount}獲得`].slice(
          -MAX_LOG_LINES
        ),
      },
    });
  },

  collectTreasureNode: () => {
    const { session } = get();
    if (!session || !session.treasure || session.treasure.collected) return;
    const treasure = session.treasure;

    usePlayerStore
      .getState()
      .collectTreasure(session.stageId, treasure.rewardMaterial, treasure.rewardAmount);

    set({
      session: {
        ...session,
        treasure: { ...treasure, collected: true },
        log: [
          ...session.log,
          `${treasure.name}を開けた！ +${treasure.rewardAmount}${treasure.rewardMaterial}`,
        ].slice(-MAX_LOG_LINES),
      },
    });
  },

  exitStage: () => set({ session: null }),
}));
