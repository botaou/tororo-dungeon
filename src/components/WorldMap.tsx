import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, TouchableWithoutFeedback, View } from 'react-native';

import {
  BirdState,
  EnemyInstance,
  HouseState,
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
  getTownLevelDef,
  MERCHANT_SPOT,
  PLOT_GRID_RING_INDICES,
  plotGridColOffsetX,
  plotGridRowOffsetY,
  TOWN_PLOT_DEFS,
} from '../data/townGrid';
import { SHOP_DEFS } from '../data/shops';
import { MATERIAL_ICON } from '../data/materials';
import { TILE_IMAGES, TILE_REPEAT_IMAGES } from '../data/tileImages';
import { getBuildingOption } from '../data/buildingOptions';
import {
  AMENITY_IMAGES,
  HOUSE_IMAGES,
  HOUSE_VACANT_IMAGE,
  MERCHANT_TENT_IMAGE,
  SHOP_IMAGES,
  TOWNHALL_IMAGES,
} from '../data/buildingImages';
import { ENEMY_IMAGES, FIELD_OBJECT_AFTER_IMAGES, FIELD_OBJECT_IMAGES } from '../data/fieldImages';
import { getShrineStageDef, SHRINE_SPOT } from '../data/shrine';
import { CharacterAvatar } from './CharacterAvatar';
import { AnimatedPressable } from './AnimatedPressable';
import { DEBUG_SHOW_SPRITE_BOUNDS, TICK_MS } from '../game/config';
import { RETREAT_LINES } from '../game/thoughts';
import { MONE_ENCOUNTER_SPOT, TORORO_ENCOUNTER_SPOT } from '../game/recruitment';
import { cuteShadow, theme } from '../theme';

// The map's actual, fixed "real" size — deliberately bigger than any phone
// viewport so the field reads as a real place to pan/zoom around in rather
// than a shrink-to-fit diorama (see components/PannableMap.tsx, which wraps
// this in a zoomable/scrollable ScrollView). Every position in this file
// stays in the same 0..1 normalized coordinate space as before; only the
// canvas these get multiplied against changed from a window-derived size to
// this fixed one. Map-split step 2: both TownMap and DungeonMap below share
// this exact canvas size/coordinate space — bird.x/y (and every other
// position) never changed meaning, only which subset of sprites each screen
// actually draws did.
export const WORLD_CANVAS_WIDTH = 900;
export const WORLD_CANVAS_HEIGHT = 1400;

// Low-opacity, tiled ground-texture patches suggesting the field's loose
// zoning (forest / quarry / mushroom patch / lake / ruins) — matches the
// natural clusters data/world.ts's enemy/mining defs already sit in, now
// made visually legible with actual hand-painted ground art (see
// data/tileImages.ts's TILE_REPEAT_IMAGES) instead of a flat color fill.
// Each also carries a small label so the zone reads as "a place" rather
// than an unexplained patch of color. Dungeon-screen only — unrelated to the
// old town-zone ellipse (removed in map-split step 2), these are just
// flavor patches within the dungeon's own field content.
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

// Display footprint for a constructed plot's real building art (shops,
// park/bathhouse) — bigger than the plain 36px plot chip since actual
// building illustrations read as cramped/illegible at that size. Shrunk
// from 64 alongside the town-density rework (see data/townGrid.ts's
// CELL_W/CELL_H notes) so the tighter 65px grid spacing has room for a
// visible gap between neighboring buildings instead of them touching.
const PLOT_BUILT_SIZE = 44;

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
// ticking) map screens don't re-layout or re-create this potentially large
// list of Image elements unless the box's own size actually changes. Cells
// mix between the given source variants (deterministically, keyed on each
// cell's own grid position) rather than all repeating the same image, so the
// tiling reads as loose texture instead of an obviously stamped grid.
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

interface TownMapProps {
  // Map-split step 2: only birds whose location is 'town' — filtered by the
  // caller (see TownScreen), same responsibility split as the existing
  // isRecruited-based activeBirds filter already there.
  birds: BirdState[];
  plotStates: Record<string, TownPlotState>;
  // Phase 14: houses, independent of any particular bird (see HouseState) —
  // replaces the old fixed per-defId HOUSE_POSITIONS/HOUSE_IMAGES lookup.
  houses: Record<string, HouseState>;
  townLevel: number;
  merchant: MerchantState | null;
  onBirdPress: (defId: string) => void;
  onPlotPress: (plotId: string) => void;
  onShopPress: (shopKind: ShopKind) => void;
  onMerchantPress: () => void;
  onTownHallPress: () => void;
  onHousePress: (house: HouseState) => void;
  // Phase 14's free house placement — when true, the whole map becomes one
  // big tap target (a semi-transparent hint overlay shows this) instead of
  // its usual sprite-by-sprite Pressables; tapping anywhere calls
  // onMapTap with the tapped point in the same 0..1 normalized space
  // everything else here uses.
  placementMode?: boolean;
  onMapTap?: (x: number, y: number) => void;
}

// Map-split step 2: the town's own screen — town hall, shrine, shops/plots,
// houses, the road grid, and only recruited birds currently "in town" (see
// TownMapProps.birds). No town-zone ellipse/fence anymore (see this file's
// previous revision in git history) — now that this is its own dedicated
// screen rather than a carved-out region of one shared map, there's nothing
// left for that ellipse to distinguish; the background is just a plain flat
// fill (see styles.field), per the request's own "凝った演出は不要" — a
// fancier town backdrop is deferred to the later isometric/free-placement
// exploration.
export function TownMap({
  birds,
  plotStates,
  houses,
  townLevel,
  merchant,
  onBirdPress,
  onPlotPress,
  onShopPress,
  onMerchantPress,
  onTownHallPress,
  onHousePress,
  placementMode,
  onMapTap,
}: TownMapProps) {
  const fieldWidth = WORLD_CANVAS_WIDTH;
  const fieldHeight = WORLD_CANVAS_HEIGHT;
  const townLevelDef = getTownLevelDef(townLevel);

  // Phase 12①("空っぽスタート"): roads used to span the plot grid's full
  // extent (ring-3 included) from the very first tick, regardless of town
  // level — a brand-new save showed the entire road network already paved.
  // Roads now only reach as far out as the town has actually unlocked land,
  // so a fresh town starts with just the short ring-1 cross (the 4
  // orthogonal plots that unlock by default) and the road network visibly
  // grows outward each time the player claims a further ring of plots —
  // "buildings appearing worn a path in," per the request, without needing
  // a whole separate "is this exact tile trodden" simulation.
  const maxUnlockedRing = useMemo(() => {
    let max = 1; // ring-1's 4 orthogonal plots start unlocked by default
    for (const def of TOWN_PLOT_DEFS) {
      const state = plotStates[def.id];
      if (!state?.unlocked && !def.unlockedByDefault) continue;
      const parts = def.id.split('_');
      const ring = Math.max(Math.abs(Number(parts[1])), Math.abs(Number(parts[2])));
      if (ring > max) max = ring;
    }
    return max;
  }, [plotStates]);

  const roadGridNodes = useMemo(() => {
    const maxDx = plotGridColOffsetX(maxUnlockedRing) * fieldWidth;
    const maxDy = plotGridRowOffsetY(maxUnlockedRing) * fieldHeight;
    const nodes: React.ReactNode[] = [];
    for (const row of PLOT_GRID_RING_INDICES) {
      if (Math.abs(row) > maxUnlockedRing) continue;
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
      if (Math.abs(col) > maxUnlockedRing) continue;
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
  }, [fieldWidth, fieldHeight, maxUnlockedRing]);

  return (
    <View style={[styles.field, { width: fieldWidth, height: fieldHeight }]}>
      {roadGridNodes}

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
        const state = plotStates[def.id] ?? { id: def.id, unlocked: def.unlockedByDefault, building: null, constructedBuildingId: null };
        const levelLocked = !!def.minTownLevel && townLevel < def.minTownLevel;
        // Phase 12①("空っぽスタート"): general/feed used to be forced into
        // looking already-built (`{ ...state, unlocked: true, building:
        // 'shop' }`) regardless of the plot's real, persisted state — the
        // town always had these two shops standing from turn one. Now every
        // plot (including these two) renders its real state, and whichever
        // shopKind actually got built there (if any — could be any of the
        // four shop kinds, or none) is read straight off the constructed
        // BuildingOption instead of being tied to a fixed plot id. This also
        // means weapon/armor shops now get the same real building art
        // (SHOP_IMAGES) general/feed always had, instead of a plain emoji.
        const constructedOption = getBuildingOption(state.constructedBuildingId);
        const builtShopKind = state.building ? constructedOption?.shopKind ?? null : null;
        return (
          <PlotSprite
            key={def.id}
            def={def}
            state={state}
            shopEmoji={builtShopKind ? SHOP_DEFS[builtShopKind].emoji : undefined}
            shopName={builtShopKind ? SHOP_DEFS[builtShopKind].name : undefined}
            shopImage={builtShopKind ? SHOP_IMAGES[builtShopKind] : undefined}
            levelLocked={levelLocked}
            x={def.x * fieldWidth}
            y={def.y * fieldHeight}
            onPress={() => (builtShopKind ? onShopPress(builtShopKind) : onPlotPress(def.id))}
          />
        );
      })}

      <AnimatedPressable
        onPress={onTownHallPress}
        style={[styles.town, { left: TOWN_X * fieldWidth - 32, top: TOWN_Y * fieldHeight - 32 }]}
      >
        <Image source={TOWNHALL_IMAGES[townLevel]} resizeMode="contain" style={styles.townImage} />
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

      <ShrineSprite x={SHRINE_SPOT.x * fieldWidth} y={SHRINE_SPOT.y * fieldHeight} townLevel={townLevel} />

      {Object.values(houses).map((house) => {
        const resident = house.residentDefId ? getCharacterDef(house.residentDefId) : null;
        const houseImage = house.residentDefId ? HOUSE_IMAGES[house.residentDefId] ?? HOUSE_VACANT_IMAGE : HOUSE_VACANT_IMAGE;
        return (
          <AnimatedPressable
            key={house.id}
            style={[styles.house, { left: house.x * fieldWidth - 18, top: house.y * fieldHeight - 18 }]}
            onPress={() => onHousePress(house)}
          >
            <Image source={houseImage} resizeMode="contain" style={styles.houseImage} />
            <Text style={styles.houseTag}>{resident ? resident.emoji : '🔑'}</Text>
          </AnimatedPressable>
        );
      })}

      {birds.map((b) => (
        <BirdSprite
          key={b.defId}
          bird={b}
          targetX={b.x * fieldWidth}
          targetY={b.y * fieldHeight}
          onPress={() => onBirdPress(b.defId)}
        />
      ))}

      {placementMode && onMapTap && (
        <TouchableWithoutFeedback
          onPress={(e) => onMapTap(e.nativeEvent.locationX / fieldWidth, e.nativeEvent.locationY / fieldHeight)}
        >
          <View style={[styles.placementOverlay, { width: fieldWidth, height: fieldHeight }]} />
        </TouchableWithoutFeedback>
      )}
    </View>
  );
}

interface DungeonMapProps {
  enemies: EnemyInstance[];
  miningNodes: MiningNodeInstance[];
  treasures: TreasureNodeInstance[];
  leisureSpots: LeisureSpotInstance[];
  // Map-split step 2: only birds whose location is 'dungeon' — filtered by
  // the caller (see TownScreen).
  birds: BirdState[];
  // Not-yet-recruited defIds — only used to decide whether to show a
  // discoverable marker at tororo's/mone's encounter spot (see
  // game/recruitment.ts); dormant birds otherwise have no map presence.
  dormantDefIds: string[];
  onBirdPress: (defId: string) => void;
}

// Map-split step 2: the dungeon/field screen — forest/quarry/mushroom/lake/
// ruins flavor patches, mining nodes, enemies, treasures, leisure spots, and
// only recruited birds currently "out in the dungeon" (see
// DungeonMapProps.birds). Shares the exact same canvas coordinate space as
// TownMap (see WORLD_CANVAS_WIDTH/HEIGHT's own comment) — a bird's x/y here
// mean exactly what they always have, this screen just doesn't draw any
// town content over them.
export function DungeonMap({ enemies, miningNodes, treasures, leisureSpots, birds, dormantDefIds, onBirdPress }: DungeonMapProps) {
  const fieldWidth = WORLD_CANVAS_WIDTH;
  const fieldHeight = WORLD_CANVAS_HEIGHT;

  // These background patches only ever depend on constants, so memoizing
  // means this subtree is built once and left alone — recomputing (and
  // re-laying-out every tiled Image cell inside them) on every single game
  // tick was cheap to write but expensive to run, and was the real cause of
  // a reported freeze (tap and scroll both stop responding once the JS
  // thread is stuck redoing this every tick).
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

  return (
    <View style={[styles.field, { width: fieldWidth, height: fieldHeight }]}>
      {fieldZonePatchNodes}

      {dormantDefIds.includes('tororo') && (
        <EncounterMarker x={TORORO_ENCOUNTER_SPOT.x * fieldWidth} y={TORORO_ENCOUNTER_SPOT.y * fieldHeight} />
      )}
      {dormantDefIds.includes('mone') && (
        <EncounterMarker x={MONE_ENCOUNTER_SPOT.x * fieldWidth} y={MONE_ENCOUNTER_SPOT.y * fieldHeight} />
      )}

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
// world.merchant is non-null (see TownMap's caller). Tapping it opens a
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
    // Centered on (x,y) via its own fixed-size box rather than the shared,
    // top-left-anchored `sprite` style other generic map sprites (Rock/
    // Enemy/Treasure/Shopkeeper) use — the density rework needed to reason
    // about the merchant's actual footprint precisely (see townGrid.ts's
    // MERCHANT_SPOT comment), which only works if (x,y) is the box's
    // center, matching the convention already used for the town hall/
    // houses/plot buildings.
    <AnimatedPressable
      onPress={onPress}
      style={[styles.merchantBox, { left: x - 16, top: y - 21 }]}
    >
      <Animated.View style={{ transform: [{ translateY: bobY }] }}>
        <Image source={MERCHANT_TENT_IMAGE} resizeMode="contain" style={styles.merchantTentImage} />
      </Animated.View>
      <Text style={styles.nameTag}>商人</Text>
      <Text style={styles.tag}>残り{minutesLeft}分</Text>
    </AnimatedPressable>
  );
}

function RockSprite({ node, x, y }: { node: MiningNodeInstance; x: number; y: number }) {
  // Drives a brief pop-in when the node first flips to collected, rather
  // than the node just vanishing until its respawn timer clears (the old
  // behavior — this component used to `return null` the instant `collected`
  // went true, before the fade-out animation it kicked off ever had a
  // chance to render a single frame, so that animation was dead code).
  // Now the harvested-state art (see data/fieldImages.ts's
  // FIELD_OBJECT_AFTER_IMAGES — a stump, a small rock, mined-out ripples,
  // etc.) pops in in its place and stays until the node respawns.
  const pop = useRef(new Animated.Value(node.collected ? 1 : 0)).current;
  const hasAnimatedRef = useRef(node.collected);

  useEffect(() => {
    if (node.collected && !hasAnimatedRef.current) {
      hasAnimatedRef.current = true;
      Animated.timing(pop, { toValue: 1, duration: 350, useNativeDriver: true }).start();
    } else if (!node.collected) {
      hasAnimatedRef.current = false;
      pop.setValue(0);
    }
  }, [node.collected, pop]);

  const image = node.collected ? FIELD_OBJECT_AFTER_IMAGES[node.resource] : FIELD_OBJECT_IMAGES[node.resource];
  const fallbackEmoji = MATERIAL_ICON[node.resource];

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.sprite,
        {
          left: x,
          top: y,
          opacity: node.collected ? pop.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) : 1,
          transform: [{ scale: node.collected ? pop.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) : 1 }],
        },
      ]}
    >
      {!node.collected && <Image source={TILE_IMAGES.dirtPatchRound} resizeMode="contain" style={styles.rockAccent} />}
      {image ? (
        <Image
          source={image}
          resizeMode="contain"
          style={[styles.fieldObjectImage, DEBUG_SHOW_SPRITE_BOUNDS && styles.debugBorder]}
        />
      ) : (
        <Text style={styles.emojiLarge}>{fallbackEmoji}</Text>
      )}
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
  shopName,
  shopImage,
  levelLocked,
  x,
  y,
  onPress,
}: {
  def: (typeof TOWN_PLOT_DEFS)[number];
  state: TownPlotState;
  shopEmoji?: string;
  shopName?: string;
  shopImage?: number;
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
  // 'park'/'bathhouse' (Phase 11) have real art (see data/buildingImages.ts);
  // 'garden' and the cosmetic workshop/warehouse fallbacks don't, and keep
  // the emoji-in-a-card look below.
  const amenityImage = constructedOption ? AMENITY_IMAGES[constructedOption.id] : undefined;
  const buildingImage = shopImage ?? amenityImage;
  // A real-device request: a constructed building (in particular the new
  // park/bathhouse — see Phase 11) was hard to tell apart from any other
  // small emoji dotted around the map, since only the bare icon rendered
  // with no name at all. A short label underneath — same idea as the house/
  // merchant/town-hall sprites already have — makes what's actually built
  // here unambiguous at a glance.
  const label = shopName ?? constructedOption?.name;

  if (buildingImage) {
    // Real building art — a bigger, bottom-anchored (no card background)
    // box, same idea as the town-hall/house sprites: the art already has
    // its own ground shadow, so a background chip behind it would look
    // like a sticker rather than a building standing on the plot.
    return (
      <>
        <AnimatedPressable
          style={[styles.plotBuilt, { left: x - PLOT_BUILT_SIZE / 2, top: y - PLOT_BUILT_SIZE / 2 }]}
          onPress={onPress}
        >
          <Image source={buildingImage} resizeMode="contain" style={styles.plotBuiltImage} />
        </AnimatedPressable>
        {label && (
          <Text
            pointerEvents="none"
            style={[styles.plotBuildingLabel, { left: x - 30, top: y + PLOT_BUILT_SIZE / 2 + 1 }]}
            numberOfLines={1}
          >
            {label}
          </Text>
        )}
      </>
    );
  }

  return (
    <>
      <AnimatedPressable style={[styles.plot, styles.plotOpen, { left: x - 18, top: y - 18 }]} onPress={onPress}>
        <Text style={styles.plotBuildingIcon}>{shopEmoji ?? buildingIcon}</Text>
      </AnimatedPressable>
      {/* The plot box itself clips at 36x36 (overflow: hidden), so the
          label is a separate sibling positioned just below it rather than a
          child — otherwise it'd get cut off before ever becoming visible. */}
      {label && (
        <Text pointerEvents="none" style={[styles.plotBuildingLabel, { left: x - 30, top: y + 19 }]} numberOfLines={1}>
          {label}
        </Text>
      )}
    </>
  );
}

// Phase 15②: the town's abandoned shrine — always present from game start,
// no tap interaction (nothing to open yet, same as the leisure spots below),
// just a visual cue that gradually brightens/decorates as townLevel rises
// (see data/shrine.ts's SHRINE_STAGE_DEFS), until アルシェル moves in once
// the town reaches its top tier (see game/recruitment.ts's checkAlshel).
function ShrineSprite({ x, y, townLevel }: { x: number; y: number; townLevel: number }) {
  const stage = getShrineStageDef(townLevel);
  return (
    <View pointerEvents="none" style={[styles.sprite, { left: x, top: y, opacity: stage.opacity }]}>
      <Text style={styles.emojiLarge}>
        {stage.decor ? `${stage.decor} ` : ''}
        {stage.emoji}
        {stage.decor ? ` ${stage.decor}` : ''}
      </Text>
      <Text style={styles.nameTag}>{stage.label}</Text>
    </View>
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
        DEBUG_SHOW_SPRITE_BOUNDS && styles.debugBorder,
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
      {ENEMY_IMAGES[enemy.name] ? (
        <Image
          source={ENEMY_IMAGES[enemy.name]}
          resizeMode="contain"
          style={[styles.enemyImage, DEBUG_SHOW_SPRITE_BOUNDS && styles.debugBorder]}
        />
      ) : (
        <Text style={styles.emojiLarge}>{enemy.emoji}</Text>
      )}
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

  // Phase 11's ambient "chat" bubble — reused for both the two-birds-chat
  // event and the lightweight "💡ひらめいた" stat-inspiration cue (see
  // BirdState.chatLine/chatLineSetAt, useWorldStore's tick / ai.ts's
  // executePlay). Watches chatLineSetAt (not chatLine itself) so a *new*
  // line still shows even if the text happens to repeat — same shape as the
  // retreat-line effect above, just keyed off a timestamp instead of hp.
  const [chatBubbleLine, setChatBubbleLine] = useState<string | null>(null);
  const chatBubbleOpacity = useRef(new Animated.Value(0)).current;
  const prevChatSetAtRef = useRef(bird.chatLineSetAt);
  useEffect(() => {
    if (bird.chatLineSetAt !== prevChatSetAtRef.current && bird.chatLine) {
      setChatBubbleLine(bird.chatLine);
      chatBubbleOpacity.setValue(1);
      Animated.sequence([
        Animated.delay(2200),
        Animated.timing(chatBubbleOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) setChatBubbleLine(null);
      });
    }
    prevChatSetAtRef.current = bird.chatLineSetAt;
  }, [bird.chatLineSetAt, bird.chatLine, chatBubbleOpacity]);

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
    bird.activity === 'recovering' ||
    bird.activity === 'strolling' ||
    bird.activity === 'playing' ||
    bird.activity === 'chatting' ||
    bird.activity === 'napping';

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
      {retreatLine ? (
        <Animated.View style={[styles.speechBubble, { opacity: bubbleOpacity }]}>
          <Text style={styles.speechBubbleText}>{retreatLine}</Text>
        </Animated.View>
      ) : (
        chatBubbleLine && (
          <Animated.View style={[styles.speechBubble, { opacity: chatBubbleOpacity }]}>
            <Text style={styles.speechBubbleText}>{chatBubbleLine}</Text>
          </Animated.View>
        )
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
            <CharacterAvatar characterId={bird.defId} emoji={def.emoji} color={def.color} size={44} cosmeticId={bird.cosmeticId} />
          </Animated.View>
          {isSulking && <Text style={styles.sulkBadge}>😤</Text>}
          {showMineSwing && <Text style={styles.pickaxe}>⛏️</Text>}
          {bird.carrying && <Text style={styles.carryBadge}>{MATERIAL_ICON[bird.carrying.materialId]}</Text>}
          {(bird.activity === 'selling' || bird.activity === 'merchantSelling') && (
            <Text style={styles.carryBadge}>💰</Text>
          )}
          {bird.activity === 'playing' && <Text style={styles.carryBadge}>🎉</Text>}
          {bird.activity === 'strolling' && <Text style={styles.carryBadge}>💭</Text>}
          {bird.activity === 'napping' && <Text style={styles.carryBadge}>😴</Text>}
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
  // canvas itself, so it just needs the background fill. Map-split step 2:
  // both TownMap and DungeonMap share this same plain flat fill — the old
  // town-zone ellipse/tint/dashed-boundary/fence-ring that used to carve a
  // "town" region out of one shared map is gone, since each screen is now
  // its own dedicated space with nothing left for that boundary to mark.
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
  roadHorizontal: { position: 'absolute', height: 8, borderRadius: 2, backgroundColor: theme.road, opacity: 0.75 },
  roadVertical: { position: 'absolute', width: 8, borderRadius: 2, backgroundColor: theme.road, opacity: 0.75 },
  // Bottom-anchored (justifyContent: 'flex-end', no background/border card)
  // rather than the old fixed-size chip — the 5 town-hall images have very
  // different aspect ratios (a squat ボロ役場 vs. the towered トロロ自然
  // 保護本部), so centering them in a fixed box would leave each one's own
  // "ground line" at a different height. Anchoring the image's bottom edge
  // to the box's bottom edge keeps every level standing on the same spot.
  town: {
    position: 'absolute',
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'flex-end',
    // Phase 12③: a simple z-order fix so birds visibly walk behind the town
    // hall/plot buildings instead of appearing to pass straight over them
    // (see `plot`/`plotBuilt` below and `sprite`'s own zIndex) — not real
    // per-tile pathfinding, just resolves the "sprite floats on top of a
    // building" look the request explicitly allowed as a first pass.
    zIndex: 2,
  },
  townImage: { width: '100%', height: '100%' },
  townLabel: {
    position: 'absolute',
    bottom: -14,
    fontSize: 9,
    fontWeight: '700',
    color: theme.textPrimary,
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderRadius: 6,
    paddingHorizontal: 4,
  },
  decor: { position: 'absolute', fontSize: 20, opacity: 0.9 },
  // Same bottom-anchored, no-background-chip approach as `town` above —
  // the house art already includes its own ground/shadow, so the old
  // per-bird border-color chip (the previous way "whose house is this"
  // was shown) is replaced entirely by the 4 differently-colored house
  // images themselves (see data/buildingImages.ts's HOUSE_IMAGES).
  house: {
    position: 'absolute',
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  houseImage: { width: '100%', height: '100%' },
  houseTag: { position: 'absolute', bottom: -2, right: -2, fontSize: 14 },
  // Phase 14's house-placement mode — a transparent full-canvas tap target
  // sitting above every other sprite (zIndex, same convention as the
  // building/sprite zIndex split from Phase 12③) so a tap anywhere reaches
  // onMapTap instead of whatever sprite happens to be underneath it.
  placementOverlay: { position: 'absolute', left: 0, top: 0, zIndex: 50, backgroundColor: 'rgba(232,163,61,0.08)' },
  plot: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    zIndex: 2, // see `town`'s own zIndex comment above
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
  // Real building art (shops, park/bathhouse) — bottom-anchored like the
  // town-hall/house sprites, no card background (the art has its own
  // ground shadow already).
  plotBuilt: {
    position: 'absolute',
    width: PLOT_BUILT_SIZE,
    height: PLOT_BUILT_SIZE,
    alignItems: 'center',
    justifyContent: 'flex-end',
    zIndex: 2, // see `town`'s own zIndex comment above
  },
  plotBuiltImage: { width: '100%', height: '100%' },
  plotBuildingLabel: {
    position: 'absolute',
    width: 60,
    fontSize: 8,
    fontWeight: '700',
    color: theme.textPrimary,
    textAlign: 'center',
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderRadius: 6,
    paddingHorizontal: 2,
  },
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
  // zIndex: 1 keeps every sprite using this style (birds, the shopkeeper,
  // encounter markers, leisure spots) above ordinary field content but
  // below plots/the town hall (zIndex: 2 — see `town`'s comment) — birds no
  // longer render as if walking on top of a building (Phase 12③).
  sprite: { position: 'absolute', alignItems: 'center', width: 56, zIndex: 1 },
  // A faint dug-out patch behind a mining node's icon (see data/tileImages.ts)
  // — purely decorative, sits underneath the emoji/amount text.
  rockAccent: { position: 'absolute', width: 40, height: 40, top: -6, left: 8, opacity: 0.55 },
  // Field-object/enemy illustrations (see data/fieldImages.ts) — sized to
  // read clearly at the map's zoom level without dwarfing neighboring
  // sprites; resizeMode="contain" keeps each asset's own aspect ratio
  // (they range from tall trees to a wide pond) instead of stretching it.
  fieldObjectImage: { width: 40, height: 40 },
  enemyImage: { width: 36, height: 36 },
  // See DEBUG_SHOW_SPRITE_BOUNDS in game/config.ts — outlines the exact
  // image box a sprite is asked to render into, so a screenshot can show
  // directly whether the art is being clipped by that box or not.
  debugBorder: { borderWidth: 1, borderColor: 'red' },
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
  // Shrunk from 54x43 alongside the density rework — see townGrid.ts's
  // MERCHANT_SPOT comment for why this got its own (smaller) box instead
  // of the shared `sprite` style.
  merchantBox: { position: 'absolute', width: 32, height: 42, alignItems: 'center', justifyContent: 'center' },
  merchantTentImage: { width: 26, height: 21 },
  // top was -8 — real-device report showed the pickaxe swing overlapping
  // the bird's own head (the base sprite's head sits close to the top of
  // its 44px box by design, so 8px of clearance wasn't reliably enough,
  // costume or no costume). Pushed out to match sulkBadge's clearance.
  pickaxe: { position: 'absolute', top: -14, right: 0, fontSize: 14 },
  carryBadge: { position: 'absolute', top: -10, right: -4, fontSize: 15 },
  sulkBadge: { position: 'absolute', top: -14, left: -4, fontSize: 14 },
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
