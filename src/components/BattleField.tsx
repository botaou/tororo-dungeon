import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import {
  Encounter,
  EnemyInstance,
  MiningNodeInstance,
  StageSessionStatus,
  SummonedUnit,
  TreasureNodeInstance,
} from '../types';
import { getCharacterDef } from '../data/characters';
import { CharacterAvatar } from './CharacterAvatar';
import { theme } from '../theme';

const SCREEN_PADDING = 32; // matches StageScreen's paddingHorizontal * 2
const FIELD_HEIGHT = 230;
const GROUND_Y = FIELD_HEIGHT - 78;
const HOME_X_RATIO = 0.04;
const PARTY_STAND_OFFSET = 46; // how far left of the target the party stops

type ActionKind = 'enemy' | 'mining' | 'treasure' | 'idle';

interface GhostUnit {
  uid: string;
  emoji: string;
  color: string;
  x: number;
  y: number;
  anim: Animated.Value;
}

interface Props {
  enemies: EnemyInstance[];
  miningNodes: MiningNodeInstance[];
  treasure: TreasureNodeInstance | null;
  summonedUnits: SummonedUnit[];
  encounters: Encounter[];
  encounterIndex: number;
  status: StageSessionStatus;
}

export function BattleField({
  enemies,
  miningNodes,
  treasure,
  summonedUnits,
  encounters,
  encounterIndex,
  status,
}: Props) {
  const { width: windowWidth } = useWindowDimensions();
  const fieldWidth = Math.max(240, windowWidth - SCREEN_PADDING);

  const current = encounters[encounterIndex];
  const pathDone = !current;
  const partyBaseX = pathDone
    ? fieldWidth * 0.95
    : Math.max(fieldWidth * HOME_X_RATIO, current.xRatio * fieldWidth - PARTY_STAND_OFFSET);
  const actionKind: ActionKind = status === 'playing' && current ? current.kind : 'idle';

  const lastPosRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const prevUnitsRef = useRef<SummonedUnit[]>([]);
  const [ghosts, setGhosts] = useState<GhostUnit[]>([]);

  useEffect(() => {
    const prevUnits = prevUnitsRef.current;
    const stillPresent = new Set(summonedUnits.map((u) => u.uid));
    const removed = prevUnits.filter((u) => !stillPresent.has(u.uid));

    if (removed.length > 0) {
      const newGhosts: GhostUnit[] = removed.map((u) => {
        const def = getCharacterDef(u.defId);
        const pos = lastPosRef.current.get(u.uid) ?? { x: fieldWidth * HOME_X_RATIO, y: GROUND_Y };
        return { uid: u.uid, emoji: def.emoji, color: def.color, x: pos.x, y: pos.y, anim: new Animated.Value(1) };
      });
      setGhosts((prev) => [...prev, ...newGhosts]);
      newGhosts.forEach((g) => {
        Animated.timing(g.anim, { toValue: 0, duration: 550, useNativeDriver: true }).start(() => {
          setGhosts((prev) => prev.filter((p) => p.uid !== g.uid));
        });
      });
    }

    prevUnitsRef.current = summonedUnits;
  }, [summonedUnits, fieldWidth]);

  return (
    <View style={[styles.field, { height: FIELD_HEIGHT }]}>
      <Decor fieldWidth={fieldWidth} />
      <View style={styles.ground} />

      {miningNodes.map((m) => {
        const enc = encounters.find((x) => x.refUid === m.uid);
        if (!enc) return null;
        return <RockSprite key={m.uid} node={m} x={enc.xRatio * fieldWidth} />;
      })}

      {enemies.map((e) => {
        const enc = encounters.find((x) => x.refUid === e.uid);
        if (!enc) return null;
        return <EnemySprite key={e.uid} enemy={e} x={enc.xRatio * fieldWidth} />;
      })}

      {treasure && (
        <TreasureSprite
          treasure={treasure}
          x={(encounters.find((x) => x.refUid === treasure.uid)?.xRatio ?? 0.9) * fieldWidth}
        />
      )}

      {summonedUnits.map((u, i) => {
        const def = getCharacterDef(u.defId);
        const col = i % 2;
        const row = Math.floor(i / 2);
        const targetX = partyBaseX + col * 22;
        const targetY = GROUND_Y - row * 30;
        lastPosRef.current.set(u.uid, { x: targetX, y: targetY });
        return (
          <CharacterSprite
            key={u.uid}
            unit={u}
            role={def.role}
            color={def.color}
            emoji={def.emoji}
            targetX={targetX}
            targetY={targetY}
            action={actionKind}
          />
        );
      })}

      {ghosts.map((g) => (
        <Animated.View
          key={g.uid}
          style={[
            styles.sprite,
            {
              left: g.x,
              top: g.y,
              opacity: g.anim,
              transform: [
                { translateY: g.anim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
                { rotate: '90deg' },
              ],
            },
          ]}
        >
          <Text style={styles.emoji}>{g.emoji}</Text>
        </Animated.View>
      ))}

      {summonedUnits.length === 0 && (
        <Text style={styles.emptyHint}>下の「召喚」からキャラを呼び出そう</Text>
      )}
    </View>
  );
}

function Decor({ fieldWidth }: { fieldWidth: number }) {
  const bumps = [0.1, 0.3, 0.5, 0.7, 0.9];
  return (
    <>
      {bumps.map((r, i) => (
        <View
          key={i}
          style={[
            styles.hill,
            {
              left: r * fieldWidth - 30,
              width: 60 + (i % 2) * 20,
              height: 24 + (i % 2) * 10,
            },
          ]}
        />
      ))}
    </>
  );
}

function RockSprite({ node, x }: { node: MiningNodeInstance; x: number }) {
  const crumble = useRef(new Animated.Value(node.collected ? 1 : 0)).current;
  const hasAnimatedRef = useRef(node.collected);

  useEffect(() => {
    if (node.collected && !hasAnimatedRef.current) {
      hasAnimatedRef.current = true;
      Animated.timing(crumble, { toValue: 1, duration: 350, useNativeDriver: true }).start();
    }
  }, [node.collected, crumble]);

  return (
    <Animated.View
      style={[
        styles.sprite,
        {
          left: x,
          top: GROUND_Y - 6,
          opacity: crumble.interpolate({ inputRange: [0, 1], outputRange: [1, 0.25] }),
          transform: [{ scale: crumble.interpolate({ inputRange: [0, 1], outputRange: [1, 0.7] }) }],
        },
      ]}
    >
      <Text style={styles.emojiLarge}>🪨</Text>
      {!node.collected && <Text style={styles.tag}>+{node.amount}</Text>}
    </Animated.View>
  );
}

function TreasureSprite({ treasure, x }: { treasure: TreasureNodeInstance; x: number }) {
  const pop = useRef(new Animated.Value(treasure.collected ? 1 : 0)).current;
  const hasAnimatedRef = useRef(treasure.collected);

  useEffect(() => {
    if (treasure.collected && !hasAnimatedRef.current) {
      hasAnimatedRef.current = true;
      Animated.timing(pop, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    }
  }, [treasure.collected, pop]);

  return (
    <Animated.View
      style={[
        styles.sprite,
        {
          left: x,
          top: GROUND_Y - 10,
          transform: [{ scale: pop.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.4, 1] }) }],
        },
      ]}
    >
      <Text style={styles.emojiLarge}>{treasure.collected ? '✨' : '🎁'}</Text>
      {!treasure.collected && (
        <Text style={styles.tag}>
          +{treasure.rewardAmount} {treasure.rewardMaterial}
        </Text>
      )}
    </Animated.View>
  );
}

function EnemySprite({ enemy, x }: { enemy: EnemyInstance; x: number }) {
  const shake = useRef(new Animated.Value(0)).current;
  const flash = useRef(new Animated.Value(0)).current;
  const knockout = useRef(new Animated.Value(enemy.defeated || enemy.hp <= 0 ? 1 : 0)).current;
  const prevHpRef = useRef(enemy.hp);
  const hasKnockedOutRef = useRef(enemy.defeated || enemy.hp <= 0);

  useEffect(() => {
    if (enemy.hp < prevHpRef.current && enemy.hp > 0) {
      Animated.sequence([
        Animated.timing(flash, { toValue: 1, duration: 60, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 1, duration: 60, useNativeDriver: true }),
        Animated.timing(shake, { toValue: -1, duration: 60, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 0, duration: 60, useNativeDriver: true }),
        Animated.timing(flash, { toValue: 0, duration: 120, useNativeDriver: true }),
      ]).start();
    }
    prevHpRef.current = enemy.hp;
  }, [enemy.hp, flash, shake]);

  useEffect(() => {
    const isDefeated = enemy.defeated || enemy.hp <= 0;
    if (isDefeated && !hasKnockedOutRef.current) {
      hasKnockedOutRef.current = true;
      Animated.timing(knockout, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    }
  }, [enemy.defeated, enemy.hp, knockout]);

  const ratio = enemy.maxHp > 0 ? Math.max(0, Math.min(1, enemy.hp / enemy.maxHp)) : 0;

  return (
    <Animated.View
      style={[
        styles.sprite,
        {
          left: x,
          top: GROUND_Y - 20,
          transform: [
            { translateX: shake.interpolate({ inputRange: [-1, 1], outputRange: [-6, 6] }) },
            { scale: knockout.interpolate({ inputRange: [0, 1], outputRange: [1, 0.85] }) },
            { rotate: knockout.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '70deg'] }) },
          ],
          opacity: knockout.interpolate({ inputRange: [0, 1], outputRange: [1, 0.35] }),
        },
      ]}
    >
      <Animated.View
        style={[
          styles.enemyFlash,
          { opacity: flash.interpolate({ inputRange: [0, 1], outputRange: [0, 0.55] }) },
        ]}
      />
      <Text style={styles.emojiLarge}>{enemy.emoji}</Text>
      {enemy.hp > 0 && !enemy.defeated && (
        <View style={styles.miniBarTrack}>
          <View style={[styles.miniBarFill, { width: `${ratio * 100}%`, backgroundColor: theme.red }]} />
        </View>
      )}
    </Animated.View>
  );
}

function CharacterSprite({
  unit,
  role,
  color,
  emoji,
  targetX,
  targetY,
  action,
}: {
  unit: SummonedUnit;
  role: 'attacker' | 'healer';
  color: string;
  emoji: string;
  targetX: number;
  targetY: number;
  action: ActionKind;
}) {
  const pos = useRef(new Animated.ValueXY({ x: targetX, y: targetY })).current;
  const walk = useRef(new Animated.Value(0)).current;
  const doing = useRef(new Animated.Value(0)).current;
  const isMoving = useRef(false);

  useEffect(() => {
    isMoving.current = true;
    Animated.spring(pos, { toValue: { x: targetX, y: targetY }, speed: 6, bounciness: 5, useNativeDriver: true }).start(
      () => {
        isMoving.current = false;
      }
    );
  }, [targetX, targetY, pos]);

  // Continuous walk bob/waddle — always running so the party never looks static.
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(walk, { toValue: 1, duration: 260, useNativeDriver: true }),
        Animated.timing(walk, { toValue: 0, duration: 260, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [walk]);

  // Action animation: attack lunge, mining swing, treasure cheer, or nothing.
  useEffect(() => {
    if (action === 'idle') return;
    const isMiningOrTreasure = action === 'mining' || action === 'treasure';
    const isAttacker = role === 'attacker' || isMiningOrTreasure;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(doing, { toValue: 1, duration: isAttacker ? 220 : 420, useNativeDriver: true }),
        Animated.timing(doing, { toValue: 0, duration: isAttacker ? 220 : 420, useNativeDriver: true }),
        Animated.delay(isAttacker ? 180 : 100),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [action, role, doing]);

  const bobY = walk.interpolate({ inputRange: [0, 1], outputRange: [0, -4] });
  const waddleRotate = walk.interpolate({ inputRange: [0, 1], outputRange: ['-6deg', '6deg'] });

  const showLunge = action === 'enemy' && role === 'attacker';
  const showMineSwing = action === 'mining';
  const showTreasureHop = action === 'treasure';
  const showHealAura = action === 'enemy' && role === 'healer';

  const lungeX = showLunge || showMineSwing ? doing.interpolate({ inputRange: [0, 1], outputRange: [0, 9] }) : 0;
  const hopY = showTreasureHop ? doing.interpolate({ inputRange: [0, 1], outputRange: [0, -10] }) : 0;
  const auraScale = showHealAura ? doing.interpolate({ inputRange: [0, 1], outputRange: [1, 1.16] }) : 1;

  const ratio = unit.maxHp > 0 ? Math.max(0, Math.min(1, unit.hp / unit.maxHp)) : 0;

  return (
    <Animated.View
      style={[
        styles.sprite,
        { transform: [{ translateX: pos.x }, { translateY: Animated.add(pos.y, Animated.add(bobY, hopY)) }] },
      ]}
    >
      <Animated.View style={{ transform: [{ translateX: lungeX }, { scale: auraScale }, { rotate: waddleRotate }] }}>
        <CharacterAvatar characterId={unit.defId} emoji={emoji} color={color} size={34} />
      </Animated.View>
      {showMineSwing && <Text style={styles.pickaxe}>⛏️</Text>}
      <View style={styles.miniBarTrack}>
        <View style={[styles.miniBarFill, { width: `${ratio * 100}%`, backgroundColor: color }]} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  field: {
    backgroundColor: theme.cardAlt,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    overflow: 'hidden',
    marginBottom: 12,
  },
  hill: {
    position: 'absolute',
    bottom: '30%',
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    backgroundColor: theme.bgTop,
    opacity: 0.5,
  },
  ground: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '30%',
    backgroundColor: theme.bgBottom,
    opacity: 0.6,
    borderTopWidth: 2,
    borderTopColor: theme.cardBorder,
  },
  sprite: { position: 'absolute', alignItems: 'center', width: 60 },
  emoji: { fontSize: 26 },
  emojiLarge: { fontSize: 30 },
  pickaxe: { position: 'absolute', top: -6, right: 2, fontSize: 16 },
  tag: {
    fontSize: 9,
    fontWeight: '700',
    color: theme.gold,
    marginTop: 1,
  },
  enemyFlash: {
    position: 'absolute',
    top: -6,
    left: -6,
    right: -6,
    bottom: 10,
    borderRadius: 20,
    backgroundColor: '#ffffff',
  },
  miniBarTrack: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: theme.bgBottom,
    marginTop: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  miniBarFill: { height: '100%', borderRadius: 3 },
  emptyHint: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    textAlign: 'center',
    color: theme.textMuted,
    fontSize: 12,
  },
});
