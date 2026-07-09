import { create } from 'zustand';
import { LayoutAnimation } from 'react-native';

import {
  Encounter,
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
import { ENCOUNTER_HOLD_TICKS, ENERGY_MAX, ENERGY_REGEN_MS } from '../game/config';
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

// The party walks the path left to right: rocks first, then enemies, then
// the treasure at the end. Spread evenly across the middle of the field so
// there's room to walk in from the left and off to the right on clear.
function buildEncounters(
  miningNodes: MiningNodeInstance[],
  enemies: EnemyInstance[],
  treasure: TreasureNodeInstance | null
): Encounter[] {
  const items: Omit<Encounter, 'xRatio'>[] = [
    ...miningNodes.map((m) => ({ kind: 'mining' as const, refUid: m.uid })),
    ...enemies.map((e) => ({ kind: 'enemy' as const, refUid: e.uid })),
    ...(treasure ? [{ kind: 'treasure' as const, refUid: treasure.uid }] : []),
  ];
  const span = 0.76;
  const start = 0.14;
  return items.map((item, i) => ({
    ...item,
    xRatio: items.length > 1 ? start + (i / (items.length - 1)) * span : start + span / 2,
  }));
}

const MAX_LOG_LINES = 30;

interface StageActions {
  enterStage: (stageId: string) => void;
  chooseSkill: (skillId: SkillId) => void;
  summon: (characterDefId: string) => void;
  tick: () => void;
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
      emoji: e.emoji,
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
        encounters: buildEncounters(miningNodes, enemies, treasure),
        encounterIndex: 0,
        encounterProgress: 0,
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

    const hasAliveUnit = session.summonedUnits.some((u) => u.hp > 0);
    if (!hasAliveUnit) {
      set({ session: { ...session, energy, energyLastUpdated } });
      return;
    }

    let { enemies, summonedUnits, miningNodes, treasure, log, encounterIndex, encounterProgress } =
      session;
    const current = session.encounters[encounterIndex];

    if (!current) {
      // Walked the whole path — stage clear.
      usePlayerStore.getState().clearStage(session.stageId);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      set({
        session: {
          ...session,
          energy,
          energyLastUpdated,
          status: 'cleared',
          log: [...log, 'ステージクリア！'].slice(-MAX_LOG_LINES),
        },
      });
      return;
    }

    if (current.kind === 'enemy') {
      const result = resolveCombatRound(enemies, summonedUnits);
      enemies = result.enemies;
      summonedUnits = result.summonedUnits;
      if (Object.keys(result.rewards).length > 0) {
        usePlayerStore.getState().addMaterials(result.rewards);
      }
      if (result.logs.length > 0) {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        log = [...log, ...result.logs].slice(-MAX_LOG_LINES);
      }
      const targetEnemy = enemies.find((e) => e.uid === current.refUid);
      if (targetEnemy && (targetEnemy.defeated || targetEnemy.hp <= 0)) {
        encounterIndex += 1;
        encounterProgress = 0;
      }
    } else if (current.kind === 'mining') {
      encounterProgress += 1;
      if (encounterProgress >= ENCOUNTER_HOLD_TICKS) {
        const node = miningNodes.find((m) => m.uid === current.refUid);
        if (node && !node.collected) {
          usePlayerStore.getState().addMaterials({ [node.resource]: node.amount });
          miningNodes = miningNodes.map((m) => (m.uid === node.uid ? { ...m, collected: true } : m));
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          log = [...log, `${node.name}から${node.resource}を${node.amount}獲得`].slice(-MAX_LOG_LINES);
        }
        encounterIndex += 1;
        encounterProgress = 0;
      }
    } else if (current.kind === 'treasure') {
      encounterProgress += 1;
      if (encounterProgress >= ENCOUNTER_HOLD_TICKS) {
        if (treasure && !treasure.collected) {
          usePlayerStore
            .getState()
            .collectTreasure(session.stageId, treasure.rewardMaterial, treasure.rewardAmount);
          treasure = { ...treasure, collected: true };
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          log = [
            ...log,
            `${treasure.name}を開けた！ +${treasure.rewardAmount}${treasure.rewardMaterial}`,
          ].slice(-MAX_LOG_LINES);
        }
        encounterIndex += 1;
        encounterProgress = 0;
      }
    }

    set({
      session: {
        ...session,
        enemies,
        summonedUnits,
        miningNodes,
        treasure,
        energy,
        energyLastUpdated,
        log,
        encounterIndex,
        encounterProgress,
      },
    });
  },

  exitStage: () => set({ session: null }),
}));
