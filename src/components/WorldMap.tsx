import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, TouchableWithoutFeedback, View, useWindowDimensions } from 'react-native';

import { BirdState, EnemyInstance, MiningNodeInstance, TreasureNodeInstance } from '../types';
import { getCharacterDef } from '../data/characters';
import { TOWN_X, TOWN_Y } from '../data/world';
import { CharacterAvatar } from './CharacterAvatar';
import { TICK_MS } from '../game/config';
import { theme } from '../theme';

const HORIZONTAL_PADDING = 24; // matches TownScreen's paddingHorizontal * 2

interface Props {
  enemies: EnemyInstance[];
  miningNodes: MiningNodeInstance[];
  treasures: TreasureNodeInstance[];
  birds: BirdState[];
  onBirdPress: (defId: string) => void;
}

export function WorldMap({ enemies, miningNodes, treasures, birds, onBirdPress }: Props) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const fieldWidth = Math.max(240, windowWidth - HORIZONTAL_PADDING);
  const fieldHeight = Math.max(420, windowHeight * 0.72);

  return (
    <View style={[styles.field, { height: fieldHeight }]}>
      <View
        style={[styles.town, { left: TOWN_X * fieldWidth - 34, top: TOWN_Y * fieldHeight - 34 }]}
      >
        <Text style={styles.townEmoji}>🏘️</Text>
      </View>

      {miningNodes.map((m) => (
        <RockSprite key={m.uid} node={m} x={m.x * fieldWidth} y={m.y * fieldHeight} />
      ))}

      {enemies.map((e) => (
        <EnemySprite key={e.uid} enemy={e} x={e.x * fieldWidth} y={e.y * fieldHeight} />
      ))}

      {treasures.map((t) => (
        <TreasureSprite key={t.uid} treasure={t} x={t.x * fieldWidth} y={t.y * fieldHeight} />
      ))}

      {birds.map((b) => (
        <BirdSprite
          key={b.defId}
          bird={b}
          targetX={b.x * fieldWidth}
          targetY={b.y * fieldHeight}
          onPress={() => onBirdPress(b.defId)}
        />
      ))}
    </View>
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

  if (node.collected) return null;

  const icon = node.resource === 'wood' ? '🌳' : node.resource === 'ore' ? '🪨' : '🍄';

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
      <Text style={styles.emojiLarge}>{icon}</Text>
      <Text style={styles.tag}>+{node.amount}</Text>
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

  if (treasure.collected) return null;

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
      <Text style={styles.emojiLarge}>🎁</Text>
      <Text style={styles.tag}>+{treasure.goldReward}G</Text>
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

  if (enemy.defeated) return null;

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
          ],
          opacity: knockout.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
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
      {enemy.hp > 0 && (
        <View style={styles.miniBarTrack}>
          <View style={[styles.miniBarFill, { width: `${ratio * 100}%`, backgroundColor: theme.red }]} />
        </View>
      )}
    </Animated.View>
  );
}

function BirdSprite({
  bird,
  targetX,
  targetY,
  onPress,
}: {
  bird: BirdState;
  targetX: number;
  targetY: number;
  onPress: () => void;
}) {
  const def = getCharacterDef(bird.defId);
  const pos = useRef(new Animated.ValueXY({ x: targetX, y: targetY })).current;
  const walk = useRef(new Animated.Value(0)).current;
  const doing = useRef(new Animated.Value(0)).current;
  const prevTargetXRef = useRef(targetX);
  const [facingRight, setFacingRight] = useState(true);

  const fainted = bird.hp <= 0;

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

  useEffect(() => {
    if (fainted) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(walk, { toValue: 1, duration: 260, useNativeDriver: true }),
        Animated.timing(walk, { toValue: 0, duration: 260, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [walk, fainted]);

  useEffect(() => {
    if (fainted || bird.activity === 'idle' || bird.activity === 'resting') return;
    const isQuick = def.role === 'attacker';
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(doing, { toValue: 1, duration: isQuick ? 220 : 420, useNativeDriver: true }),
        Animated.timing(doing, { toValue: 0, duration: isQuick ? 220 : 420, useNativeDriver: true }),
        Animated.delay(isQuick ? 180 : 100),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [bird.activity, def.role, doing, fainted]);

  const bobY = fainted ? 0 : walk.interpolate({ inputRange: [0, 1], outputRange: [0, -4] });
  const waddleRotate = fainted ? '0deg' : walk.interpolate({ inputRange: [0, 1], outputRange: ['-6deg', '6deg'] });

  const showLunge = bird.activity === 'enemy' && def.role === 'attacker';
  const showMineSwing = bird.activity === 'mining';
  const showTreasureHop = bird.activity === 'treasure';
  const showHealAura = bird.activity === 'enemy' && def.role === 'healer';

  const lungeScale = showLunge || showMineSwing ? doing.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] }) : 1;
  const hopY = showTreasureHop ? doing.interpolate({ inputRange: [0, 1], outputRange: [0, -10] }) : 0;
  const auraScale = showHealAura ? doing.interpolate({ inputRange: [0, 1], outputRange: [1, 1.16] }) : 1;

  const ratio = bird.maxHp > 0 ? Math.max(0, Math.min(1, bird.hp / bird.maxHp)) : 0;

  return (
    <Animated.View
      style={[
        styles.sprite,
        { transform: [{ translateX: pos.x }, { translateY: Animated.add(pos.y, Animated.add(bobY, hopY)) }] },
      ]}
    >
      <TouchableWithoutFeedback onPress={onPress}>
        <View style={styles.tapArea}>
          <Animated.View
            style={{
              transform: [
                { scaleX: facingRight ? 1 : -1 },
                { scale: Animated.multiply(lungeScale, auraScale) },
                { rotate: fainted ? '90deg' : waddleRotate },
              ],
              opacity: fainted ? 0.5 : 1,
            }}
          >
            <CharacterAvatar characterId={bird.defId} emoji={def.emoji} color={def.color} size={30} />
          </Animated.View>
          {showMineSwing && <Text style={styles.pickaxe}>⛏️</Text>}
          <Text style={styles.nameTag}>{bird.name}</Text>
          <View style={styles.miniBarTrack}>
            <View style={[styles.miniBarFill, { width: `${ratio * 100}%`, backgroundColor: def.color }]} />
          </View>
        </View>
      </TouchableWithoutFeedback>
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
  town: {
    position: 'absolute',
    width: 68,
    height: 68,
    borderRadius: 16,
    backgroundColor: theme.card,
    borderWidth: 2,
    borderColor: theme.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  townEmoji: { fontSize: 30 },
  sprite: { position: 'absolute', alignItems: 'center', width: 56 },
  tapArea: { alignItems: 'center' },
  emojiLarge: { fontSize: 26 },
  pickaxe: { position: 'absolute', top: -8, right: 0, fontSize: 14 },
  tag: { fontSize: 9, fontWeight: '700', color: theme.gold, marginTop: 1 },
  nameTag: { fontSize: 9, fontWeight: '700', color: theme.textPrimary, marginTop: 1 },
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
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.bgBottom,
    marginTop: 2,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  miniBarFill: { height: '100%', borderRadius: 2 },
});
