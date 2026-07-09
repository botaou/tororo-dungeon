import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import {
  ActivityKind,
  EnemyInstance,
  MiningNodeInstance,
  StageSessionStatus,
  SummonedUnit,
  TreasureNodeInstance,
} from '../types';
import { getCharacterDef } from '../data/characters';
import { CharacterAvatar } from './CharacterAvatar';
import { TICK_MS } from '../game/config';
import { theme } from '../theme';

const HORIZONTAL_PADDING = 24; // matches StageScreen's paddingHorizontal * 2

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
  status: StageSessionStatus;
}

export function BattleField({ enemies, miningNodes, treasure, summonedUnits, status }: Props) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const fieldWidth = Math.max(240, windowWidth - HORIZONTAL_PADDING);
  const fieldHeight = Math.max(360, windowHeight * 0.62);

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
        const pos = lastPosRef.current.get(u.uid) ?? { x: fieldWidth * 0.5, y: fieldHeight * 0.5 };
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
  }, [summonedUnits, fieldWidth, fieldHeight]);

  return (
    <View style={[styles.field, { height: fieldHeight }]}>
      <CrossPath fieldWidth={fieldWidth} fieldHeight={fieldHeight} />
      <View style={styles.camp}>
        <Text style={styles.campEmoji}>⛺</Text>
      </View>

      {miningNodes.map((m) => (
        <RockSprite key={m.uid} node={m} x={m.x * fieldWidth} y={m.y * fieldHeight} />
      ))}

      {enemies.map((e) => (
        <EnemySprite key={e.uid} enemy={e} x={e.x * fieldWidth} y={e.y * fieldHeight} />
      ))}

      {treasure && (
        <TreasureSprite treasure={treasure} x={treasure.x * fieldWidth} y={treasure.y * fieldHeight} />
      )}

      {summonedUnits.map((u) => {
        const def = getCharacterDef(u.defId);
        const targetX = u.x * fieldWidth;
        const targetY = u.y * fieldHeight;
        lastPosRef.current.set(u.uid, { x: targetX, y: targetY });
        const action: ActivityKind = status === 'playing' ? u.activity : 'idle';
        return (
          <CharacterSprite
            key={u.uid}
            unit={u}
            role={def.role}
            color={def.color}
            emoji={def.emoji}
            targetX={targetX}
            targetY={targetY}
            action={action}
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
        <Text style={styles.emptyHint}>下のボタンからキャラを呼び出そう</Text>
      )}
    </View>
  );
}

function CrossPath({ fieldWidth, fieldHeight }: { fieldWidth: number; fieldHeight: number }) {
  return (
    <>
      <View style={[styles.pathH, { top: fieldHeight * 0.5 - 22, width: fieldWidth }]} />
      <View style={[styles.pathV, { left: fieldWidth * 0.5 - 22, height: fieldHeight }]} />
    </>
  );
}

function RockSprite({ node, x, y }: { node: MiningNodeInstance; x: number; y: number }) {
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
          top: y,
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

function TreasureSprite({ treasure, x, y }: { treasure: TreasureNodeInstance; x: number; y: number }) {
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
          top: y,
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

function EnemySprite({ enemy, x, y }: { enemy: EnemyInstance; x: number; y: number }) {
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
          top: y,
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
  action: ActivityKind;
}) {
  const pos = useRef(new Animated.ValueXY({ x: targetX, y: targetY })).current;
  const walk = useRef(new Animated.Value(0)).current;
  const doing = useRef(new Animated.Value(0)).current;
  const prevTargetXRef = useRef(targetX);
  const [facingRight, setFacingRight] = useState(true);

  // Constant-speed walk: each update is one tick's worth of travel, animated
  // linearly over exactly one tick so consecutive steps chain into smooth,
  // non-teleporting motion instead of an easing snap.
  useEffect(() => {
    const dx = targetX - prevTargetXRef.current;
    if (dx > 1) setFacingRight(true);
    else if (dx < -1) setFacingRight(false);
    prevTargetXRef.current = targetX;

    Animated.timing(pos, {
      toValue: { x: targetX, y: targetY },
      duration: TICK_MS,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start();
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
    const isQuick = role === 'attacker' || isMiningOrTreasure;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(doing, { toValue: 1, duration: isQuick ? 220 : 420, useNativeDriver: true }),
        Animated.timing(doing, { toValue: 0, duration: isQuick ? 220 : 420, useNativeDriver: true }),
        Animated.delay(isQuick ? 180 : 100),
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

  const lungeScale = showLunge || showMineSwing ? doing.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] }) : 1;
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
      <Animated.View
        style={{
          transform: [
            { scaleX: facingRight ? 1 : -1 },
            { scale: Animated.multiply(lungeScale, auraScale) },
            { rotate: waddleRotate },
          ],
        }}
      >
        <CharacterAvatar characterId={unit.defId} emoji={emoji} color={color} size={32} />
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
  },
  pathH: {
    position: 'absolute',
    height: 44,
    backgroundColor: theme.bgTop,
    opacity: 0.45,
  },
  pathV: {
    position: 'absolute',
    top: 0,
    width: 44,
    backgroundColor: theme.bgTop,
    opacity: 0.45,
  },
  camp: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginLeft: -22,
    marginTop: -22,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.card,
    borderWidth: 2,
    borderColor: theme.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  campEmoji: { fontSize: 20 },
  sprite: { position: 'absolute', alignItems: 'center', width: 56 },
  emoji: { fontSize: 24 },
  emojiLarge: { fontSize: 28 },
  pickaxe: { position: 'absolute', top: -8, right: 0, fontSize: 14 },
  tag: { fontSize: 9, fontWeight: '700', color: theme.gold, marginTop: 1 },
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
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.bgBottom,
    marginTop: 3,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  miniBarFill: { height: '100%', borderRadius: 2 },
  emptyHint: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    textAlign: 'center',
    color: theme.textMuted,
    fontSize: 12,
  },
});
