import { create } from 'zustand';

import {
  EnemyInstance,
  MiningNodeInstance,
  SkillId,
  StageSession,
  SummonedUnit,
  TargetKind,
  TreasureNodeInstance,
} from '../types';
import { getStageDef } from '../data/stages';
import { getCharacterDef } from '../data/characters';
import { resolveCombatRound } from '../game/combat';
import {
  ARRIVAL_THRESHOLD,
  ENCOUNTER_HOLD_TICKS,
  ENERGY_MAX,
  ENERGY_REGEN_MS,
  PARTY_MOVE_SPEED,
} from '../game/config';
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

function getTargetPosition(
  kind: TargetKind,
  refUid: string,
  enemies: EnemyInstance[],
  miningNodes: MiningNodeInstance[],
  treasure: TreasureNodeInstance | null
): { x: number; y: number } | null {
  if (kind === 'enemy') return enemies.find((e) => e.uid === refUid) ?? null;
  if (kind === 'mining') return miningNodes.find((m) => m.uid === refUid) ?? null;
  if (kind === 'treasure') return treasure && treasure.uid === refUid ? treasure : null;
  return null;
}

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
        partyX: 0.5,
        partyY: 0.5,
        targetKind: null,
        targetRefUid: null,
        workProgress: 0,
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

    let {
      enemies,
      summonedUnits,
      miningNodes,
      treasure,
      partyX,
      partyY,
      targetKind,
      targetRefUid,
      workProgress,
    } = session;

    // Pick a new nearest target if we don't have one.
    if (!targetKind || !targetRefUid) {
      type Candidate = { kind: TargetKind; refUid: string; x: number; y: number };
      const candidates: Candidate[] = [
        ...enemies.filter((e) => !e.defeated && e.hp > 0).map((e) => ({ kind: 'enemy' as const, refUid: e.uid, x: e.x, y: e.y })),
        ...miningNodes.filter((m) => !m.collected).map((m) => ({ kind: 'mining' as const, refUid: m.uid, x: m.x, y: m.y })),
        ...(treasure && !treasure.collected
          ? [{ kind: 'treasure' as const, refUid: treasure.uid, x: treasure.x, y: treasure.y }]
          : []),
      ];

      if (candidates.length === 0) {
        // Nothing left — stage clear.
        usePlayerStore.getState().clearStage(session.stageId);
        set({ session: { ...session, energy, energyLastUpdated, status: 'cleared' } });
        return;
      }

      let nearest = candidates[0];
      let nearestDist = Infinity;
      for (const c of candidates) {
        const d = Math.hypot(c.x - partyX, c.y - partyY);
        if (d < nearestDist) {
          nearestDist = d;
          nearest = c;
        }
      }
      targetKind = nearest.kind;
      targetRefUid = nearest.refUid;
      workProgress = 0;
      set({
        session: {
          ...session,
          energy,
          energyLastUpdated,
          targetKind,
          targetRefUid,
          workProgress,
        },
      });
      return;
    }

    // Walk toward the target at a constant speed before engaging it — no
    // teleporting straight to it.
    const targetPos = getTargetPosition(targetKind, targetRefUid, enemies, miningNodes, treasure);
    if (!targetPos) {
      // Target vanished from under us (shouldn't normally happen); pick a new one next tick.
      set({
        session: { ...session, energy, energyLastUpdated, targetKind: null, targetRefUid: null, workProgress: 0 },
      });
      return;
    }

    const dx = targetPos.x - partyX;
    const dy = targetPos.y - partyY;
    const distance = Math.hypot(dx, dy);
    if (distance > ARRIVAL_THRESHOLD) {
      const step = Math.min(distance, PARTY_MOVE_SPEED);
      partyX += (dx / distance) * step;
      partyY += (dy / distance) * step;
      set({ session: { ...session, energy, energyLastUpdated, partyX, partyY } });
      return;
    }

    if (targetKind === 'enemy') {
      const result = resolveCombatRound(enemies, summonedUnits, targetRefUid);
      enemies = result.enemies;
      summonedUnits = result.summonedUnits;
      if (Object.keys(result.rewards).length > 0) {
        usePlayerStore.getState().addMaterials(result.rewards);
      }
      const targetEnemy = enemies.find((e) => e.uid === targetRefUid);
      if (targetEnemy && (targetEnemy.defeated || targetEnemy.hp <= 0)) {
        partyX = targetEnemy.x;
        partyY = targetEnemy.y;
        targetKind = null;
        targetRefUid = null;
        workProgress = 0;
      }
    } else if (targetKind === 'mining') {
      workProgress += 1;
      if (workProgress >= ENCOUNTER_HOLD_TICKS) {
        const node = miningNodes.find((m) => m.uid === targetRefUid);
        if (node && !node.collected) {
          usePlayerStore.getState().addMaterials({ [node.resource]: node.amount });
          miningNodes = miningNodes.map((m) => (m.uid === node.uid ? { ...m, collected: true } : m));
          partyX = node.x;
          partyY = node.y;
        }
        targetKind = null;
        targetRefUid = null;
        workProgress = 0;
      }
    } else if (targetKind === 'treasure') {
      workProgress += 1;
      if (workProgress >= ENCOUNTER_HOLD_TICKS) {
        if (treasure && !treasure.collected) {
          usePlayerStore
            .getState()
            .collectTreasure(session.stageId, treasure.rewardMaterial, treasure.rewardAmount);
          treasure = { ...treasure, collected: true };
          partyX = treasure.x;
          partyY = treasure.y;
        }
        targetKind = null;
        targetRefUid = null;
        workProgress = 0;
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
        partyX,
        partyY,
        targetKind,
        targetRefUid,
        workProgress,
      },
    });
  },

  exitStage: () => set({ session: null }),
}));
