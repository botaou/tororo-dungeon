import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, TouchableWithoutFeedback, View } from 'react-native';

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
import { getEnemyStrengthTier, TOWN_DECOR, TOWN_X, TOWN_Y } from '../data/world';
import {
  BUILDING_ICON,
  getTownLevel,
  getTownLevelDef,
  getTownZoneRadius,
  MERCHANT_SPOT,
  PLOT_GRID_RING_INDICES,
  plotGridColOffsetX,
  plotGridRowOffsetY,
  shopKindForPlot,
  TOWN_PLOT_DEFS,
} from '../data/townGrid';
import { SHOP_DEFS } from '../data/shops';
import { HOUSE_POSITIONS } from '../data/houses';
import { MATERIAL_ICON } from '../data/materials';
import { TILE_IMAGES, TILE_REPEAT_IMAGES } from '../data/tileImages';
import { getBuildingOption } from '../data/buildingOptions';
import { CharacterAvatar } from './CharacterAvatar';
import { AnimatedPressable } from './AnimatedPressable';
import { TICK_MS } from '../game/config';
import { RETREAT_LINES } from '../game/thoughts';
import { MONE_ENCOUNTER_SPOT, TORORO_ENCOUNTER_SPOT } from '../game/recruitment';
import { cuteShadow, theme } from '../theme';

// The map's actual, fixed "real" size — deliberately bigger than any phone
// viewport so the field reads as a real place to pan/zoom around in rather
// than a shrink-to-fit diorama (see components/PannableMap.tsx, which wraps
// this in a zoomable/scrollable ScrollView). Every position in this file
// stays in the same 0..1 normalized coordinate space as before; only the
// canvas these get multiplied against changed from a window-derived size to
// this fixed one.
export const WORLD_CANVAS_WIDTH = 900;
export const WORLD_CANVAS_HEIGHT = 1400;

// Low-opacity, tiled ground-texture patches suggesting the field's loose
// zoning (forest / quarry / mushroom patch / lake / ruins) — matches the
// natural clusters data/world.ts's enemy/mining defs already sit in, now
// made visually legible with actual hand-painted ground art (see
// data/tileImages.ts's TILE_REPEAT_IMAGES) instead of a flat color fill.
// Each also carries a small label so the zone reads as "a place" rather
// than an unexplained patch of color.
const FIELD_ZONE_PATCHES: {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  texture: keyof typeof TILE_REPEAT_IMAGES;
  label: string;
}[] = [
  { cx: 0.22, cy: 0.22, rx: 0.16, ry: 0.13, texture: 'forest', label: '🌲 森' }, // upper-left
  { cx: 0.75, cy: 0.22, rx: 0.16, ry: 0.14, texture: 'quarry', label: '⛏️ 鉱山' }, // upper-right
  { cx: 0.23, cy: 0.76, rx: 0.13, ry: 0.11, texture: 'mushroom', label: '🍄 キノコ畑' }, // lower-left
  { cx: 0.63, cy: 0.86, rx: 0.2, ry: 0.11, texture: 'lake', label: '🌊 湖' }, // south
  { cx: 0.5, cy: 0.13, rx: 0.14, ry: 0.08, texture: 'ruins', label: '🏛️ 遺跡' }, // north
];

// Displayed size of one repeating ground tile in the background patches
// below. Deliberately NOT relying on Image's resizeMode="repeat" (which
// tiles at the source file's own native pixel size and has inconsistent
// platform support) — instead we lay out an explicit grid of ordinary
// resizeMode="cover" Image cells ourselves, so behavior is the same
// wherever plain <Image> works at all. 60px keeps the total tile count per
// patch modest (tens, not hundreds) since this grid is recomputed only when
// a patch's own size changes (see the useMemo calls below), not every game
// tick.
const GROUND_TILE_SIZE = 60;

// A quick, seedable pseudo-random 0..1 generator (mulberry32) — used so each
// cell's tile-variant pick is deterministic (stable across re-renders once
// memoized) without needing to store the choice anywhere.
function pseudoRandom(seed: number): number {
  let t = (seed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// A memoized grid of repeating ground-tile cells filling a width x height
// box. Wrapped in React.memo + useMemo so re-renders of the (frequently
// ticking) WorldMap component don't re-layout or re-create this potentially
// large list of Image elements unless the box's own size actually changes.
// Cells mix between the given source variants (deterministically, keyed on
// each cell's own grid position) rather than all repeating the same image,
// so the tiling reads as loose texture instead of an obviously stamped grid.
const TiledBackground = React.memo(function TiledBackground({
  width,
  height,
  sources,
}: {
  width: number;
  height: number;
  sources: readonly number[];
}) {
  const cells = useMemo(() => {
    const cols = Math.ceil(width / GROUND_TILE_SIZE) + 1;
    const rows = Math.ceil(height / GROUND_TILE_SIZE) + 1;
    const list: { left: number; top: number; variant: number }[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const variant = Math.floor(pseudoRandom(r * 1000 + c) * sources.length);
        list.push({ left: c * GROUND_TILE_SIZE, top: r * GROUND_TILE_SIZE, variant });
      }
    }
    return list;
  }, [width, height, sources.length]);

  return (
    <>
      {cells.map((cell, i) => (
        <Image
          key={i}
          source={sources[cell.variant]}
          resizeMode="cover"
          style={[styles.tileCell, { left: cell.left, top: cell.top }]}
        />
      ))}
    </>
  );
});

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
  onTownHallPress: () => void;
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
  onTownHallPress,
}: Props) {
  const fieldWidth = WORLD_CANVAS_WIDTH;
  const fieldHeight = WORLD_CANVAS_HEIGHT;
  const townLevel = getTownLevel(developmentPoints);
  const townLevelDef = getTownLevelDef(townLevel);
  const zoneRadius = getTownZoneRadius();
  const zoneWidth = zoneRadius.rx * 2 * fieldWidth;
  const zoneHeight = zoneRadius.ry * 2 * fieldHeight;

  // WorldMap re-renders every game tick (birds/enemies/etc. are fresh arrays
  // each tick), but these background layers only ever depend on constants
  // (the field patches) or on the town's zone size (which only changes on a
  // town level-up). Recomputing — and re-laying-out every one of the tiled
  // Image cells inside them — on every single tick was cheap to write but
  // expensive to run, and was the real cause of a reported freeze (tap and
  // scroll both stop responding once the JS thread is stuck redoing this
  // every tick). Memoizing means this subtree is built once and left alone.
  const fieldZonePatchNodes = useMemo(
    () =>
      FIELD_ZONE_PATCHES.map((p, i) => {
        const w = p.rx * 2 * fieldWidth;
        const h = p.ry * 2 * fieldHeight;
        return (
          <View
            key={i}
            pointerEvents="none"
            style={[
              styles.fieldZonePatch,
              {
                left: p.cx * fieldWidth - p.rx * fieldWidth,
                top: p.cy * fieldHeight - p.ry * fieldHeight,
                width: w,
                height: h,
                borderRadius: Math.max(w, h),
              },
            ]}
          >
            <TiledBackground width={w} height={h} sources={TILE_REPEAT_IMAGES[p.texture]} />
            <View style={styles.fieldZoneLabelWrap}>
              <Text style={styles.fieldZoneLabel}>{p.label}</Text>
            </View>
          </View>
        );
      }),
    [fieldWidth, fieldHeight]
  );

  // The town zone's own backdrop — a warm-toned, fixed-size ellipse (vs.
  // the field's meadow green), plus a dashed ring marking the boundary
  // between "town" and "adventure field" (the fence-post ring below is the
  // primary boundary marker now; this dashed line is a fainter secondary
  // cue). A faint tiled grass texture sits underneath the tint so it reads
  // as "cozy garden ground" rather than a flat color, without overpowering
  // the town's flat, clean-lined look.
  const townZoneNodes = useMemo(
    () => (
      <>
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
        >
          <View style={styles.townZoneTextureLayer}>
            <TiledBackground width={zoneWidth} height={zoneHeight} sources={TILE_REPEAT_IMAGES.town} />
          </View>
          <View style={styles.townZoneTint} />
        </View>
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
      </>
    ),
    [fieldWidth, fieldHeight, zoneWidth, zoneHeight]
  );

  // A ring of fence posts traced around the town zone ellipse — a
  // real-device request for a clearer, more structural-looking boundary
  // than the plain dashed line above gives on its own ("参考画像は柵で
  // 区切られている"). POST_COUNT (20) and PHASE_DEG (10°) were picked by a
  // numeric search over the fixed zone radius above: they're the
  // combination that keeps every post at least ~30px clear of the always-
  // present town fixtures a post could otherwise land right on top of
  // (the two orthogonal ring-1 plots, the two shops, the merchant spot,
  // all 4 houses) — a naive evenly-spaced ring landed a post almost exactly
  // on the ring-1 E/W plots at some counts. Ring-1's own *diagonal* plots
  // intentionally sit just outside this ring (see TOWN_ZONE_RADIUS's
  // comment) so posts pass moderately close to those by design, not by
  // oversight.
  const fenceNodes = useMemo(() => {
    const cx = TOWN_X * fieldWidth;
    const cy = TOWN_Y * fieldHeight;
    const rx = zoneWidth / 2;
    const ry = zoneHeight / 2;
    const POST_COUNT = 20;
    const PHASE_DEG = 10;
    const posts: React.ReactNode[] = [];
    for (let i = 0; i < POST_COUNT; i++) {
      const theta = ((i / POST_COUNT) * 360 + PHASE_DEG) * (Math.PI / 180);
      const x = cx + rx * Math.cos(theta);
      const y = cy + ry * Math.sin(theta);
      posts.push(
        <Text key={i} pointerEvents="none" style={[styles.fencePost, { left: x - 9, top: y - 9 }]}>
          🪵
        </Text>
      );
    }
    return posts;
  }, [fieldWidth, fieldHeight, zoneWidth, zoneHeight]);

  // A full grid of roads along every row/column line the plot grid actually
  // places plots on (not just the town-hall's own cross) — a real-device
  // request for the town to read as road-divided city blocks rather than
  // buildings scattered loosely across open grass. Spans the plot grid's
  // full extent (ring-3 included) regardless of the current town level, so
  // the road layout doesn't visibly shift/grow as more rings unlock —
  // locked plots already show their own dimmed/level-badge state on top.
  const roadGridNodes = useMemo(() => {
    const maxDx = plotGridColOffsetX(3) * fieldWidth;
    const maxDy = plotGridRowOffsetY(3) * fieldHeight;
    const nodes: React.ReactNode[] = [];
    for (const row of PLOT_GRID_RING_INDICES) {
      const y = TOWN_Y * fieldHeight + plotGridRowOffsetY(row) * fieldHeight;
      nodes.push(
        <View
          key={`h${row}`}
          pointerEvents="none"
          style={[styles.roadHorizontal, { top: y - 4, left: TOWN_X * fieldWidth - maxDx, width: maxDx * 2 }]}
        />
      );
    }
    for (const col of PLOT_GRID_RING_INDICES) {
      const x = TOWN_X * fieldWidth + plotGridColOffsetX(col) * fieldWidth;
      nodes.push(
        <View
          key={`v${col}`}
          pointerEvents="none"
          style={[styles.roadVertical, { left: x - 4, top: TOWN_Y * fieldHeight - maxDy, height: maxDy * 2 }]}
        />
      );
    }
    return nodes;
  }, [fieldWidth, fieldHeight]);

  return (
    <View style={[styles.field, { width: fieldWidth, height: fieldHeight }]}>
      {fieldZonePatchNodes}

      {townZoneNodes}

      {roadGridNodes}

      {fenceNodes}

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
        const state = plotStates[def.id] ?? { id: def.id, unlocked: def.unlockedByDefault, building: null, constructedBuildingId: null };
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

      <AnimatedPressable
        onPress={onTownHallPress}
        style={[styles.town, { left: TOWN_X * fieldWidth - 34, top: TOWN_Y * fieldHeight - 34 }]}
      >
        <Text style={styles.townEmoji}>{townLevelDef.emoji}</Text>
        <Text style={styles.townLabel}>{townLevelDef.name}</Text>
      </AnimatedPressable>

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
      <Image source={TILE_IMAGES.dirtPatchRound} resizeMode="contain" style={styles.rockAccent} />
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
    // untamed, quietly-waiting ground (real grass art, dimmer, no cost
    // shown since attempting is pointless right now) rather than the same
    // "locked, here's the price" look as an affordable-but-unclaimed plot —
    // both now share the same grass-tile backdrop (see data/tileImages.ts)
    // instead of a flat gray/green box, just dimmed differently.
    return (
      <AnimatedPressable
        style={[styles.plot, levelLocked ? styles.plotUntamed : styles.plotLocked, { left: x - 18, top: y - 18 }]}
        onPress={onPress}
      >
        <Image source={TILE_IMAGES.grassPlain} resizeMode="cover" style={[styles.plotGrassBg, levelLocked && styles.plotGrassBgDim]} />
        {levelLocked ? (
          <Text style={styles.plotLevelReq}>Lv.{def.minTownLevel}</Text>
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

  // A constructed plot's own BuildingOption (see data/buildingOptions.ts)
  // has a more specific emoji than the generic per-BuildingKind fallback —
  // e.g. the general-goods branch and the feed branch are both kind 'shop'
  // but render as 🛠️/🌾 respectively once matched back to their option.
  const constructedOption = getBuildingOption(state.constructedBuildingId);
  const buildingIcon = constructedOption?.emoji ?? (state.building ? BUILDING_ICON[state.building] : '·');

  return (
    <AnimatedPressable style={[styles.plot, styles.plotOpen, { left: x - 18, top: y - 18 }]} onPress={onPress}>
      <Text style={styles.plotBuildingIcon}>{shopEmoji ?? buildingIcon}</Text>
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
  // Real-device request — a rough, at-a-glance strength gauge (not exact
  // numbers) using the enemy's full/undamaged maxHp, not its current
  // (possibly-depleted) hp, so the rating doesn't shrink mid-fight.
  const strengthTier = getEnemyStrengthTier({ hp: enemy.maxHp, atk: enemy.atk });
  const strengthStars = strengthTier === 'weak' ? '⭐' : strengthTier === 'normal' ? '⭐⭐' : '⭐⭐⭐';

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
      {enemy.hp > 0 && <Text style={styles.enemyStrengthBadge}>{strengthStars}</Text>}
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
  // The rounded "card frame" look now lives on the viewport wrapper (see
  // components/PannableMap.tsx) — this is the real, fixed-size scrollable
  // canvas itself, so it just needs the background fill.
  field: {
    backgroundColor: theme.ground,
  },
  // Softer than before (was 0.45) so the patch blends into the surrounding
  // field green instead of reading as a hard-edged circle of color.
  fieldZonePatch: { position: 'absolute', opacity: 0.32, overflow: 'hidden' },
  // Each ground-tile cell in a TiledBackground grid — absolute-positioned by
  // the grid's own computed left/top, sized by GROUND_TILE_SIZE.
  tileCell: { position: 'absolute', width: GROUND_TILE_SIZE, height: GROUND_TILE_SIZE },
  // A small "what is this zone" label centered on each field patch — a
  // semi-transparent pill so it stays legible over any of the tile mixes.
  fieldZoneLabelWrap: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -40 }, { translateY: -11 }],
    width: 80,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderRadius: 999,
    paddingVertical: 3,
  },
  fieldZoneLabel: { fontSize: 10, fontWeight: '800', color: theme.textPrimary },
  townZoneBackdrop: { position: 'absolute', overflow: 'hidden' },
  townZoneTextureLayer: { position: 'absolute', width: '100%', height: '100%', opacity: 0.4 },
  townZoneTint: { position: 'absolute', width: '100%', height: '100%', backgroundColor: theme.bgBottom, opacity: 0.6 },
  townZoneBoundary: {
    position: 'absolute',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: theme.fence,
    opacity: 0.4,
  },
  roadHorizontal: { position: 'absolute', height: 8, borderRadius: 2, backgroundColor: theme.road, opacity: 0.75 },
  roadVertical: { position: 'absolute', width: 8, borderRadius: 2, backgroundColor: theme.road, opacity: 0.75 },
  fencePost: { position: 'absolute', fontSize: 18 },
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
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  plotLocked: {
    backgroundColor: theme.disabled,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  plotOpen: {
    backgroundColor: theme.cardAlt,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: theme.pink,
  },
  plotLockIcon: { fontSize: 16 },
  plotCostText: { fontSize: 8, fontWeight: '700', color: theme.textMuted, marginTop: 1 },
  plotBuildingIcon: { fontSize: 22, color: theme.textMuted },
  plotUntamed: {
    borderWidth: 1,
    borderColor: 'rgba(107, 189, 110, 0.3)',
  },
  // Real grass art behind both locked states (see data/tileImages.ts) —
  // level-gated plots dim it further so they still read as "further off"
  // than a merely gold-locked one.
  plotGrassBg: { position: 'absolute', width: '100%', height: '100%', opacity: 0.75 },
  plotGrassBgDim: { opacity: 0.4 },
  plotLevelReq: { fontSize: 9, fontWeight: '800', color: theme.textPrimary },
  sprite: { position: 'absolute', alignItems: 'center', width: 56 },
  // A faint dug-out patch behind a mining node's icon (see data/tileImages.ts)
  // — purely decorative, sits underneath the emoji/amount text.
  rockAccent: { position: 'absolute', width: 40, height: 40, top: -6, left: 8, opacity: 0.55 },
  leisureSprite: { opacity: 0.85 },
  tapArea: { alignItems: 'center' },
  // A soft shadow helps flat-shaded icons (mining nodes, treasure, etc.)
  // sit on top of the tiled ground art instead of looking pasted flat onto
  // it — subtle enough not to change the look anywhere the icon is over
  // plain color (e.g. locked plots, most of the field's own base green).
  emojiLarge: {
    fontSize: 26,
    textShadowColor: 'rgba(0,0,0,0.18)',
    textShadowOffset: { width: 0, height: 1.5 },
    textShadowRadius: 2,
  },
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
  enemyStrengthBadge: {
    position: 'absolute',
    top: -12,
    alignSelf: 'center',
    fontSize: 9,
    textShadowColor: 'rgba(255,255,255,0.9)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 2,
  },
});
