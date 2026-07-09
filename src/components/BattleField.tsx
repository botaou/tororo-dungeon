import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { EnemyInstance, StageSessionStatus, SummonedUnit } from '../types';
import { getCharacterDef } from '../data/characters';
import { CharacterAvatar } from './CharacterAvatar';
import { theme } from '../theme';

const SCREEN_PADDING = 32; // matches StageScreen's paddingHorizontal * 2
const FIELD_HEIGHT = 220;
const UNIT_ROW_GAP = 38;
const HOME_X_RATIO = 0.08;
const ENEMY_BASE_X_RATIO = 0.52;
const ENEMY_SLOT_GAP = 66;

interface GhostUnit {
  uid: string;
  name: string;
  emoji: string;
  color: string;
  x: number;
  y: number;
  anim: Animated.Value;
}

interface Props {
  enemies: EnemyInstance[];
  summonedUnits: SummonedUnit[];
  status: StageSessionStatus;
}

export function BattleField({ enemies, summonedUnits, status }: Props) {
  const { width: windowWidth } = useWindowDimensions();
  const fieldWidth = Math.max(240, windowWidth - SCREEN_PADDING);

  const frontEnemy = enemies.find((e) => !e.defeated && e.hp > 0);
  const battleActive = status === 'playing' && !!frontEnemy;

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
        const pos = lastPosRef.current.get(u.uid) ?? { x: fieldWidth * HOME_X_RATIO, y: 40 };
        return { uid: u.uid, name: u.name, emoji: def.emoji, color: def.color, x: pos.x, y: pos.y, anim: new Animated.Value(1) };
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
      <View style={styles.ground} />

      {enemies.map((e, i) => (
        <EnemySprite
          key={e.uid}
          enemy={e}
          x={Math.min(fieldWidth - 40, fieldWidth * ENEMY_BASE_X_RATIO + i * ENEMY_SLOT_GAP)}
        />
      ))}

      {summonedUnits.map((u, i) => {
        const def = getCharacterDef(u.defId);
        const targetX = frontEnemy
          ? Math.max(fieldWidth * HOME_X_RATIO, fieldWidth * ENEMY_BASE_X_RATIO - 74)
          : fieldWidth * HOME_X_RATIO;
        const targetY = 30 + i * UNIT_ROW_GAP;
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
            attacking={battleActive}
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
          top: 26,
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
  attacking,
}: {
  unit: SummonedUnit;
  role: 'attacker' | 'healer';
  color: string;
  emoji: string;
  targetX: number;
  targetY: number;
  attacking: boolean;
}) {
  const pos = useRef(new Animated.ValueXY({ x: targetX, y: targetY })).current;
  const bob = useRef(new Animated.Value(0)).current;
  const action = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(pos, { toValue: { x: targetX, y: targetY }, speed: 8, bounciness: 6, useNativeDriver: true }).start();
  }, [targetX, targetY, pos]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 420, useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 420, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [bob]);

  useEffect(() => {
    if (!attacking) return;
    const isAttacker = role === 'attacker';
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(action, { toValue: 1, duration: isAttacker ? 260 : 420, useNativeDriver: true }),
        Animated.timing(action, { toValue: 0, duration: isAttacker ? 260 : 420, useNativeDriver: true }),
        Animated.delay(isAttacker ? 220 : 120),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [attacking, role, action]);

  const bobY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -5] });
  const lungeX = role === 'attacker' ? action.interpolate({ inputRange: [0, 1], outputRange: [0, 10] }) : 0;
  const auraScale = role === 'healer' ? action.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] }) : 1;

  const ratio = unit.maxHp > 0 ? Math.max(0, Math.min(1, unit.hp / unit.maxHp)) : 0;

  return (
    <Animated.View
      style={[
        styles.sprite,
        { transform: [{ translateX: pos.x }, { translateY: Animated.add(pos.y, bobY) }] },
      ]}
    >
      <Animated.View style={{ transform: [{ translateX: lungeX }, { scale: auraScale }] }}>
        <CharacterAvatar characterId={unit.defId} emoji={emoji} color={color} size={34} />
      </Animated.View>
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
  ground: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '32%',
    backgroundColor: theme.bgBottom,
    opacity: 0.5,
  },
  sprite: { position: 'absolute', alignItems: 'center', width: 60 },
  emoji: { fontSize: 26 },
  emojiLarge: { fontSize: 32 },
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
