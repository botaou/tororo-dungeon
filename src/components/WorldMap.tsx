import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, TouchableWithoutFeedback, View, useWindowDimensions } from 'react-native';

import {
  BirdState,
  EnemyInstance,
  LeisureSpotInstance,
  MerchantState,
  MiningNodeInstance,
  ShopKind,
  TownPlotState,
  TreasureNodeInstance,
} from '../types';
import { getCharacterDef } from '../data/characters';
import { TOWN_DECOR, TOWN_X, TOWN_Y } from '../data/world';
import {
  BUILDING_ICON,
  getTownLevel,
  getTownLevelDef,
  getTownZoneRadius,
  MERCHANT_SPOT,
  shopKindForPlot,
  TOWN_PLOT_DEFS,
} from '../data/townGrid';
import { SHOP_DEFS } from '../data/shops';
import { HOUSE_POSITIONS } from '../data/houses';
import { MATERIAL_ICON } from '../data/materials';
import { CharacterAvatar } from './CharacterAvatar';
import { AnimatedPressable } from './AnimatedPressable';
import { TICK_MS } from '../game/config';
import { RETREAT_LINES } from '../game/thoughts';
import { MONE_ENCOUNTER_SPOT, TORORO_ENCOUNTER_SPOT } from '../game/recruitment';
import { cuteShadow, theme } from '../theme';

const HORIZONTAL_PADDING = 24; // matches TownScreen's paddingHorizontal * 2

// Soft, low-opacity background patches suggesting the field's loose zoning
// (forest / quarry / mushroom patch / lake / ruins) without needing real
// tile art — matches the natural clusters data/world.ts's enemy/mining defs
// already sit in, just made visually legible instead of implicit.
const FIELD_ZONE_PATCHES: { cx: number; cy: number; rx: number; ry: number; color: string }[] = [
  { cx: 0.22, cy: 0.22, rx: 0.16, ry: 0.13, color: '#bfe0a8' }, // forest, upper-left
  { cx: 0.75, cy: 0.22, rx: 0.16, ry: 0.14, color: '#d9cdb4' }, // quarry, upper-right
  { cx: 0.23, cy: 0.76, rx: 0.13, ry: 0.11, color: '#cbb8d9' }, // mushroom patch, lower-left
  { cx: 0.63, cy: 0.86, rx: 0.2, ry: 0.11, color: '#a8cfe0' }, // lake, south
  { cx: 0.5, cy: 0.13, rx: 0.14, ry: 0.08, color: '#e0d3a8' }, // ruins, north
];

interface Props {
  enemies: EnemyInstance[];
  miningNodes: MiningNodeInstance[];
  treasures: TreasureNodeInstance[];
  leisureSpots: LeisureSpotInstance[];
  birds: BirdState[];
  // Not-yet-recruited defIds — only used to decide whether to show a
  // discoverable marker at tororo's/mone's encounter spot (see
  // game/recruitment.ts); dormant birds otherwise have no map presence.
  dormantDefIds: string[];
  plotStates: Record<string, TownPlotState>;
  developmentPoints: number;
  merchant: MerchantState | null;
  onBirdPress: (defId: string) => void;
  onPlotPress: (plotId: string) => void;
  onShopPress: (shopKind: ShopKind) => void;
  onMerchantPress: () => void;
}

export function WorldMap({
  enemies,
  miningNodes,
  treasures,
  leisureSpots,
  birds,
  dormantDefIds,
  plotStates,
  developmentPoints,
  merchant,
  onBirdPress,
  onPlotPress,
  onShopPress,
  onMerchantPress,
}: Props) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const fieldWidth = Math.max(240, windowWidth - HORIZONTAL_PADDING);
  const fieldHeight = Math.max(420, windowHeight * 0.72);
  const townLevel = getTownLevel(developmentPoints);
  const townLevelDef = getTownLevelDef(townLevel);
  const zoneRadius = getTownZoneRadius(townLevel);
  const zoneWidth = zoneRadius.rx * 2 * fieldWidth;
  const zoneHeight = zoneRadius.ry * 2 * fieldHeight;

  return (
    <View style={[styles.field, { height: fieldHeight }]}>
      {FIELD_ZONE_PATCHES.map((p, i) => (
        <View
          key={i}
          pointerEvents="none"
          style={[
            styles.fieldZonePatch,
            {
              left: p.cx * fieldWidth - p.rx * fieldWidth,
              top: p.cy * fieldHeight - p.ry * fieldHeight,
              width: p.rx * 2 * fieldWidth,
              height: p.ry * 2 * fieldHeight,
              borderRadius: Math.max(p.rx * fieldWidth, p.ry * fieldHeight),
              backgroundColor: p.color,
            },
          ]}
        />
      ))}

      {/* The town zone's own backdrop — a warm-toned ellipse (vs. the
          field's meadow green) that grows with town level, plus a dashed
          ring marking the boundary between "town" and "adventure field". */}
      <View
        pointerEvents="none"
        style={[
          styles.townZoneBackdrop,
          {
            left: TOWN_X * fieldWidth - zoneWidth / 2,
            top: TOWN_Y * fieldHeight - zoneHeight / 2,
            width: zoneWidth,
            height: zoneHeight,
            borderRadius: Math.max(zoneWidth, zoneHeight),
          },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.townZoneBoundary,
          {
            left: TOWN_X * fieldWidth - zoneWidth / 2,
            top: TOWN_Y * fieldHeight - zoneHeight / 2,
            width: zoneWidth,
            height: zoneHeight,
            borderRadius: Math.max(zoneWidth, zoneHeight),
          },
        ]}
      />

      {/* A simple cross-road motif suggesting the town's plots all connect
          back to the town hall — not literal pathing, just a quick visual
          anchor since real road art is a separate, later pass. */}
      <View pointerEvents="none" style={[styles.roadHorizontal, { top: TOWN_Y * fieldHeight - 3, width: zoneWidth * 0.9, left: TOWN_X * fieldWidth - (zoneWidth * 0.9) / 2 }]} />
      <View pointerEvents="none" style={[styles.roadVertical, { left: TOWN_X * fieldWidth - 3, height: zoneHeight * 0.9, top: TOWN_Y * fieldHeight - (zoneHeight * 0.9) / 2 }]} />

      {TOWN_DECOR.map((d, i) => (
        <Text
          key={i}
          pointerEvents="none"
          style={[styles.decor, { left: d.x * fieldWidth - 12, top: d.y * fieldHeight - 12 }]}
        >
          {d.emoji}
        </Text>
      ))}

      {TOWN_PLOT_DEFS.map((def) => {
        const shopKind = shopKindForPlot(def.id);
        const state = plotStates[def.id] ?? { id: def.id, unlocked: def.unlockedByDefault, building: null };
        const levelLocked = !!def.minTownLevel && townLevel < def.minTownLevel;
        return (
          <PlotSprite
            key={def.id}
            def={def}
            state={shopKind ? { ...state, unlocked: true, building: 'shop' } : state}
            shopEmoji={shopKind ? SHOP_DEFS[shopKind].emoji : undefined}
            levelLocked={levelLocked}
            x={def.x * fieldWidth}
            y={def.y * fieldHeight}
            onPress={() => (shopKind ? onShopPress(shopKind) : onPlotPress(def.id))}
          />
        );
      })}

      <View
        pointerEvents="none"
        style={[styles.town, { left: TOWN_X * fieldWidth - 34, top: TOWN_Y * fieldHeight - 34 }]}
      >
        <Text style={styles.townEmoji}>{townLevelDef.emoji}</Text>
        <Text style={styles.townLabel}>{townLevelDef.name}</Text>
      </View>

      <ShopkeeperSprite x={TOWN_X * fieldWidth} y={TOWN_Y * fieldHeight + 44} />

      {merchant && (
        <MerchantSprite
          merchant={merchant}
          x={MERCHANT_SPOT.x * fieldWidth}
          y={MERCHANT_SPOT.y * fieldHeight}
          onPress={onMerchantPress}
        />
      )}

      {dormantDefIds.includes('tororo') && (
        <EncounterMarker x={TORORO_ENCOUNTER_SPOT.x * fieldWidth} y={TORORO_ENCOUNTER_SPOT.y * fieldHeight} />
      )}
      {dormantDefIds.includes('mone') && (
        <EncounterMarker x={MONE_ENCOUNTER_SPOT.x * fieldWidth} y={MONE_ENCOUNTER_SPOT.y * fieldHeight} />
      )}

      {birds.map((b) => {
        const pos = HOUSE_POSITIONS[b.defId];
        if (!pos) return null;
        const def = getCharacterDef(b.defId);
        return (
          <View
            key={b.defId}
            pointerEvents="none"
            style={[styles.house, { left: pos.x * fieldWidth - 18, top: pos.y * fieldHeight - 18, borderColor: def.color }]}
          >
            <Text style={styles.houseEmoji}>🏠</Text>
            <Text style={styles.houseTag}>{def.emoji}</Text>
          </View>
        );
      })}

      {miningNodes.map((m) => (
        <RockSprite key={m.uid} node={m} x={m.x * fieldWidth} y={m.y * fieldHeight} />
      ))}

      {enemies.map((e) => (
        <EnemySprite key={e.uid} enemy={e} x={e.x * fieldWidth} y={e.y * fieldHeight} />
      ))}

      {treasures.map((t) => (
        <TreasureSprite key={t.uid} treasure={t} x={t.x * fieldWidth} y={t.y * fieldHeight} />
      ))}

      {leisureSpots.map((s) => (
        <LeisureSprite key={s.uid} spot={s} x={s.x * fieldWidth} y={s.y * fieldHeight} />
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

// The player's stand-in — the town's manager/shopkeeper. Not controllable,
// just a friendly presence standing near the town hall with a gentle idle
// bob, so the diorama reads as "someone lives here" rather than an empty lot.
function ShopkeeperSprite({ x, y }: { x: number; y: number }) {
  const bob = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 900, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
        Animated.timing(bob, { toValue: 0, duration: 900, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [bob]);

  const bobY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -3] });

  return (
    <Animated.View pointerEvents="none" style={[styles.sprite, { left: x, top: y, transform: [{ translateY: bobY }] }]}>
      <Text style={styles.emojiLarge}>🧑‍🌾</Text>
      <Text style={styles.nameTag}>店主</Text>
    </Animated.View>
  );
}

// A subtle, discoverable hint that someone's out here — shown at a
// not-yet-recruited bird's encounter spot (see game/recruitment.ts). Just a
// gently pulsing "?"; the actual encounter itself is a quiet chance roll
// once an active bird wanders close, not a tap target.
function EncounterMarker({ x, y }: { x: number; y: number }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1000, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
        Animated.timing(pulse, { toValue: 0, duration: 1000, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.1] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0.9] });

  return (
    <Animated.View pointerEvents="none" style={[styles.sprite, { left: x, top: y, transform: [{ scale }], opacity }]}>
      <Text style={styles.emojiLarge}>❓</Text>
    </Animated.View>
  );
}

// The visiting merchant's temporary stall — only rendered while
// world.merchant is non-null (see WorldMap's caller). Tapping it opens a
// view-only info modal; birds decide for themselves whether to trade here,
// same as the two permanent shops.
function MerchantSprite({
  merchant,
  x,
  y,
  onPress,
}: {
  merchant: MerchantState;
  x: number;
  y: number;
  onPress: () => void;
}) {
  const bob = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 700, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
        Animated.timing(bob, { toValue: 0, duration: 700, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [bob]);

  const bobY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -3] });
  const minutesLeft = Math.max(0, Math.ceil((merchant.departsAt - Date.now()) / 60_000));

  return (
    <AnimatedPressable onPress={onPress} style={[styles.sprite, { left: x, top: y }]}>
      <Animated.View style={{ transform: [{ translateY: bobY }] }}>
        <Text style={styles.emojiLarge}>🏕️</Text>
      </Animated.View>
      <Text style={styles.nameTag}>商人</Text>
      <Text style={styles.tag}>残り{minutesLeft}分</Text>
    </AnimatedPressable>
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
      pointerEvents="none"
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
      pointerEvents="none"
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

function PlotSprite({
  def,
  state,
  shopEmoji,
  levelLocked,
  x,
  y,
  onPress,
}: {
  def: (typeof TOWN_PLOT_DEFS)[number];
  state: TownPlotState;
  shopEmoji?: string;
  levelLocked: boolean;
  x: number;
  y: number;
  onPress: () => void;
}) {
  if (!state.unlocked) {
    // Plots gated behind a town level the player hasn't reached yet read as
    // untamed, quietly-waiting ground (a soft grass-toned layer, no cost
    // shown since attempting is pointless right now) rather than the same
    // "locked, here's the price" look as an affordable-but-unclaimed plot.
    return (
      <AnimatedPressable
        style={[styles.plot, levelLocked ? styles.plotUntamed : styles.plotLocked, { left: x - 12, top: y - 12 }]}
        onPress={onPress}
      >
        {levelLocked ? (
          <>
            <View style={styles.plotUntamedInner} />
            <Text style={styles.plotLevelReq}>Lv.{def.minTownLevel}</Text>
          </>
        ) : (
          <>
            <Text style={styles.plotLockIcon}>🔒</Text>
            {def.unlockCost && (
              <Text style={styles.plotCostText}>
                {def.unlockCost.gold}G
                {def.unlockCost.materialId ? ` ${MATERIAL_ICON[def.unlockCost.materialId]}${def.unlockCost.materialAmount}` : ''}
              </Text>
            )}
          </>
        )}
      </AnimatedPressable>
    );
  }

  return (
    <AnimatedPressable style={[styles.plot, styles.plotOpen, { left: x - 12, top: y - 12 }]} onPress={onPress}>
      <Text style={styles.plotBuildingIcon}>{shopEmoji ?? (state.building ? BUILDING_ICON[state.building] : '·')}</Text>
    </AnimatedPressable>
  );
}

function LeisureSprite({ spot, x, y }: { spot: LeisureSpotInstance; x: number; y: number }) {
  return (
    <View pointerEvents="none" style={[styles.sprite, styles.leisureSprite, { left: x, top: y }]}>
      <Text style={styles.emojiLarge}>{spot.emoji}</Text>
    </View>
  );
}

function EnemySprite({ enemy, x, y }: { enemy: EnemyInstance; x: number; y: number }) {
  // Enemies now patrol/chase/return on their own (see game/enemyAi.ts)
  // instead of sitting still, so — same as BirdSprite — position glides
  // smoothly over one tick's duration instead of snapping to the new spot.
  const pos = useRef(new Animated.ValueXY({ x, y })).current;
  const shake = useRef(new Animated.Value(0)).current;
  const flash = useRef(new Animated.Value(0)).current;
  const knockout = useRef(new Animated.Value(enemy.defeated || enemy.hp <= 0 ? 1 : 0)).current;
  const prevHpRef = useRef(enemy.hp);
  const hasKnockedOutRef = useRef(enemy.defeated || enemy.hp <= 0);

  useEffect(() => {
    Animated.timing(pos, {
      toValue: { x, y },
      duration: TICK_MS,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start();
  }, [x, y, pos]);

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
      pointerEvents="none"
      style={[
        styles.sprite,
        {
          transform: [
            { translateX: Animated.add(pos.x, shake.interpolate({ inputRange: [-1, 1], outputRange: [-6, 6] })) },
            { translateY: pos.y },
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

  // A bird whose HP has bottomed out is tired, not incapacitated — it's
  // already on its way home to recover (see ai.ts's stepRecover), so it
  // still visibly walks, just dimmed a touch and without any of the
  // activity-specific animations below (it's not fighting/mining/etc.).
  const isSulking = bird.hp <= 0;

  // The instant HP bottoms out, pop up a quick, light speech-bubble line
  // before the bird heads home — never anything heavier than "tired and a
  // little bratty about it".
  const [retreatLine, setRetreatLine] = useState<string | null>(null);
  const bubbleOpacity = useRef(new Animated.Value(0)).current;
  const prevHpRef = useRef(bird.hp);
  useEffect(() => {
    if (prevHpRef.current > 0 && bird.hp <= 0) {
      setRetreatLine(RETREAT_LINES[Math.floor(Math.random() * RETREAT_LINES.length)]);
      bubbleOpacity.setValue(1);
      Animated.sequence([
        Animated.delay(2200),
        Animated.timing(bubbleOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) setRetreatLine(null);
      });
    }
    prevHpRef.current = bird.hp;
  }, [bird.hp, bubbleOpacity]);

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
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(walk, { toValue: 1, duration: 260, useNativeDriver: true }),
        Animated.timing(walk, { toValue: 0, duration: 260, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [walk]);

  const isPassiveActivity =
    bird.activity === 'idle' ||
    bird.activity === 'resting' ||
    bird.activity === 'eating' ||
    bird.activity === 'bathing' ||
    bird.activity === 'fishing' ||
    bird.activity === 'carrying' ||
    bird.activity === 'selling' ||
    bird.activity === 'merchantSelling' ||
    bird.activity === 'recovering';

  useEffect(() => {
    if (isSulking || isPassiveActivity) return;
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
  }, [bird.activity, def.role, doing, isSulking]);

  const bobY = walk.interpolate({ inputRange: [0, 1], outputRange: [0, -4] });
  const waddleRotate = walk.interpolate({ inputRange: [0, 1], outputRange: ['-6deg', '6deg'] });

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
      {retreatLine && (
        <Animated.View style={[styles.speechBubble, { opacity: bubbleOpacity }]}>
          <Text style={styles.speechBubbleText}>{retreatLine}</Text>
        </Animated.View>
      )}
      <TouchableWithoutFeedback onPress={onPress}>
        <View style={styles.tapArea}>
          <Animated.View
            style={{
              transform: [
                { scaleX: facingRight ? 1 : -1 },
                { scale: Animated.multiply(lungeScale, auraScale) },
                { rotate: waddleRotate },
              ],
              opacity: isSulking ? 0.6 : 1,
            }}
          >
            <CharacterAvatar characterId={bird.defId} emoji={def.emoji} color={def.color} size={44} />
          </Animated.View>
          {isSulking && <Text style={styles.sulkBadge}>😤</Text>}
          {showMineSwing && <Text style={styles.pickaxe}>⛏️</Text>}
          {bird.carrying && <Text style={styles.carryBadge}>{MATERIAL_ICON[bird.carrying.materialId]}</Text>}
          {(bird.activity === 'selling' || bird.activity === 'merchantSelling') && (
            <Text style={styles.carryBadge}>💰</Text>
          )}
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
    backgroundColor: theme.ground,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: theme.cardBorder,
    overflow: 'hidden',
  },
  fieldZonePatch: { position: 'absolute', opacity: 0.35 },
  townZoneBackdrop: { position: 'absolute', backgroundColor: theme.bgBottom, opacity: 0.9 },
  townZoneBoundary: {
    position: 'absolute',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: theme.gold,
    opacity: 0.55,
  },
  roadHorizontal: { position: 'absolute', height: 6, borderRadius: 3, backgroundColor: theme.cardBorder, opacity: 0.6 },
  roadVertical: { position: 'absolute', width: 6, borderRadius: 3, backgroundColor: theme.cardBorder, opacity: 0.6 },
  town: {
    position: 'absolute',
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: theme.card,
    borderWidth: 2.5,
    borderColor: theme.gold,
    alignItems: 'center',
    justifyContent: 'center',
    ...cuteShadow,
  },
  townEmoji: { fontSize: 30 },
  townLabel: { fontSize: 8, fontWeight: '700', color: theme.textMuted, position: 'absolute', bottom: 4 },
  decor: { position: 'absolute', fontSize: 20, opacity: 0.9 },
  house: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: theme.card,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    ...cuteShadow,
  },
  houseEmoji: { fontSize: 16 },
  houseTag: { position: 'absolute', bottom: -6, right: -6, fontSize: 12 },
  plot: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plotLocked: {
    backgroundColor: theme.disabled,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    opacity: 0.85,
  },
  plotOpen: {
    backgroundColor: theme.cardAlt,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: theme.pink,
  },
  plotLockIcon: { fontSize: 12 },
  plotCostText: { fontSize: 7, fontWeight: '700', color: theme.textMuted, marginTop: 1 },
  plotBuildingIcon: { fontSize: 16, color: theme.textMuted },
  plotUntamed: {
    backgroundColor: 'rgba(107, 189, 110, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(107, 189, 110, 0.3)',
  },
  plotUntamedInner: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 5,
    backgroundColor: 'rgba(107, 189, 110, 0.35)',
  },
  plotLevelReq: { fontSize: 7, fontWeight: '800', color: theme.textMuted },
  sprite: { position: 'absolute', alignItems: 'center', width: 56 },
  leisureSprite: { opacity: 0.85 },
  tapArea: { alignItems: 'center' },
  emojiLarge: { fontSize: 26 },
  pickaxe: { position: 'absolute', top: -8, right: 0, fontSize: 14 },
  carryBadge: { position: 'absolute', top: -10, right: -4, fontSize: 15 },
  sulkBadge: { position: 'absolute', top: -10, left: -4, fontSize: 14 },
  speechBubble: {
    position: 'absolute',
    top: -34,
    alignSelf: 'center',
    backgroundColor: theme.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    paddingHorizontal: 8,
    paddingVertical: 4,
    ...cuteShadow,
  },
  speechBubbleText: { fontSize: 10, fontWeight: '700', color: theme.textPrimary },
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
