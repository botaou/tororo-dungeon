import { create } from 'zustand';

import { EnemyInstance, MaterialId, MiningNodeInstance, Personality, SkillId, StageSession, SummonedUnit, TreasureNodeInstance } from '../types';
import { getStageDef } from '../data/stages';
import { getCharacterDef } from '../data/characters';
import { AttackAssignment, applyHealing, resolveAttacks } from '../game/combat';
import { AiWorld, stepUnit } from '../game/ai';
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

// Scatter `count` points across the arena on a jittered grid so items don't
// overlap, leaving a clear ring around the center for the home camp.
function scatterPositions(count: number): { x: number; y: number }[] {
  if (count === 0) return [];
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  const cells: { x: number; y: number }[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells.push({ x: (c + 0.5) / cols, y: (r + 0.5) / rows });
    }
  }
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  return cells.slice(0, count).map((cell) => {
    const jitterX = (Math.random() - 0.5) * (0.7 / cols);
    const jitterY = (Math.random() - 0.5) * (0.7 / rows);
    let x = 0.1 + cell.x * 0.8 + jitterX;
    let y = 0.15 + cell.y * 0.7 + jitterY;
    // Keep clear of the central camp marker.
    const dx = x - 0.5;
    const dy = y - 0.5;
    if (Math.hypot(dx, dy) < 0.14) {
      const angle = Math.atan2(dy, dx) || Math.random() * Math.PI * 2;
      x = 0.5 + Math.cos(angle) * 0.16;
      y = 0.5 + Math.sin(angle) * 0.16;
    }
    return { x: Math.min(0.92, Math.max(0.08, x)), y: Math.min(0.88, Math.max(0.16, y)) };
  });
}

// Vanguard picks its target first so clingy/free-spirit units can assist
// whatever it's fighting this same tick.
const PERSONALITY_ORDER: Record<Personality, number> = {
  vanguard: 0,
  freeSpirit: 1,
  clingy: 2,
  cautious: 3,
};

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
    const positions = scatterPositions(stage.enemies.length + stage.miningNodes.length + (stage.treasure ? 1 : 0));
    let cursor = 0;

    const enemies: EnemyInstance[] = stage.enemies.map((e) => ({
      uid: uid('enemy'),
      defId: e.id,
      name: e.name,
      emoji: e.emoji,
      ...positions[cursor++],
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
      ...positions[cursor++],
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
            ...positions[cursor++],
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
      x: 0.5 + (Math.random() - 0.5) * 0.05,
      y: 0.5 + (Math.random() - 0.5) * 0.05,
      atk: Math.round(def.baseAtk * atkMultiplier(session.selectedSkill)),
      maxHp: Math.round(def.baseHp * hpMultiplier(session.selectedSkill)),
      hp: Math.round(def.baseHp * hpMultiplier(session.selectedSkill)),
      targetKind: null,
      targetRefUid: null,
      workProgress: 0,
      activity: 'idle',
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

    const aliveUnits = session.summonedUnits.filter((u) => u.hp > 0);
    if (aliveUnits.length === 0) {
      set({ session: { ...session, energy, energyLastUpdated } });
      return;
    }

    let enemies = session.enemies;
    let miningNodes = session.miningNodes;
    let treasure = session.treasure;

    // Each unit acts independently; sort so the vanguard decides its target
    // before the units that assist/follow it read that decision.
    const nextUnits = aliveUnits
      .map((u) => ({ ...u }))
      .sort(
        (a, b) =>
          PERSONALITY_ORDER[getCharacterDef(a.defId).personality] -
          PERSONALITY_ORDER[getCharacterDef(b.defId).personality]
      );

    const vanguardUnit = nextUnits.find((u) => getCharacterDef(u.defId).personality === 'vanguard') ?? null;
    const world: AiWorld = { enemies, miningNodes, treasure, vanguard: vanguardUnit, allUnits: nextUnits };

    const allAssignments: AttackAssignment[] = [];
    const materialsToAdd: Partial<Record<MaterialId, number>> = {};
    let treasureJustCollected = false;

    for (const unit of nextUnits) {
      const def = getCharacterDef(unit.defId);
      const outcome = stepUnit(unit, def, world);
      allAssignments.push(...outcome.assignments);
      for (const key of Object.keys(outcome.materialsCollected) as MaterialId[]) {
        materialsToAdd[key] = (materialsToAdd[key] ?? 0) + (outcome.materialsCollected[key] ?? 0);
      }
      if (outcome.miningCollectedUid) {
        miningNodes = miningNodes.map((m) => (m.uid === outcome.miningCollectedUid ? { ...m, collected: true } : m));
        world.miningNodes = miningNodes;
      }
      if (outcome.treasureCollectedUid && treasure) {
        treasure = { ...treasure, collected: true };
        world.treasure = treasure;
        treasureJustCollected = true;
      }
    }

    const combatResult = resolveAttacks(enemies, allAssignments);
    enemies = combatResult.enemies;
    for (const key of Object.keys(combatResult.rewards) as MaterialId[]) {
      materialsToAdd[key] = (materialsToAdd[key] ?? 0) + (combatResult.rewards[key] ?? 0);
    }

    // Retaliation: each engaged enemy that's still alive hits back once,
    // against a random unit that attacked it this tick.
    for (const { enemyUid, damage } of combatResult.retaliations) {
      const attackerUids = new Set(allAssignments.filter((a) => a.enemyUid === enemyUid).map((a) => a.unitUid));
      const candidates = nextUnits.filter((u) => attackerUids.has(u.uid) && u.hp > 0);
      if (candidates.length > 0) {
        const victim = candidates[Math.floor(Math.random() * candidates.length)];
        victim.hp = Math.max(0, victim.hp - damage);
      }
    }

    // Healing runs independent of positioning/targeting.
    const healer = nextUnits.find((u) => getCharacterDef(u.defId).role === 'healer' && u.hp > 0);
    const healedUnits = healer ? applyHealing(nextUnits, healer.uid, healer.atk) : nextUnits;
    const survivingUnits = healedUnits.filter((u) => u.hp > 0);

    if (Object.keys(materialsToAdd).length > 0) {
      usePlayerStore.getState().addMaterials(materialsToAdd);
    }
    if (treasureJustCollected && treasure) {
      usePlayerStore.getState().collectTreasure(session.stageId, treasure.rewardMaterial, treasure.rewardAmount);
    }

    const allEnemiesDown = enemies.every((e) => e.defeated || e.hp <= 0);
    const allMiningDone = miningNodes.every((m) => m.collected);
    const treasureDone = !treasure || treasure.collected;

    if (allEnemiesDown && allMiningDone && treasureDone) {
      usePlayerStore.getState().clearStage(session.stageId);
      set({
        session: {
          ...session,
          enemies,
          miningNodes,
          treasure,
          summonedUnits: survivingUnits,
          energy,
          energyLastUpdated,
          status: 'cleared',
        },
      });
      return;
    }

    set({
      session: {
        ...session,
        enemies,
        miningNodes,
        treasure,
        summonedUnits: survivingUnits,
        energy,
        energyLastUpdated,
      },
    });
  },

  exitStage: () => set({ session: null }),
}));
