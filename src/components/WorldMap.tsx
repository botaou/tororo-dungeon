import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, TouchableWithoutFeedback, View } from 'react-native';

import {
  BirdState,
  EnemyInstance,
  HouseState,
  LeisureSpotInstance,
  MerchantState,
  MiningNodeInstance,
  TownBuildingInstance,
  TreasureNodeInstance,
} from '../types';
import { getCharacterDef } from '../data/characters';
import { DUNGEON_GATE_SPOT, FIELD_TOWN_GATE_SPOT, getEnemyStrengthTier, TOWN_DECOR, TOWN_X, TOWN_Y } from '../data/world';
import { getTownLevelDef, MERCHANT_SPOT } from '../data/townGrid';
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
import { ALSHEL_NPC, ALSHEL_REVEAL_TOWN_LEVEL, getShrineStageDef, SHRINE_SPOT } from '../data/shrine';
import { depthKey, gridToScreen, IsoTileSize, screenToGrid } from '../game/isoMath';
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

// Step C ("街画面のアイソメトリック移行") — TownMap only; DungeonMap keeps its
// plain top-down x*width/y*height placement entirely unchanged (see
// DungeonMap's own render below). Every town entity's already-normalized
// (0..1) x/y (Step B's free-placement building/house coords, TOWN_X/
// TOWN_Y, SHRINE_SPOT, MERCHANT_SPOT, the gate spots, a bird's own x/y,
// ...) is fed straight into isoMath's gridToScreen/depthKey as a grid
// coordinate — no extra scaling step, no new data model, so every existing
// save's building/house positions land at the exact same *logical* spot
// they always did; only how that spot is drawn on screen changes.
// tileHeight is exactly half tileWidth — the classic shallow-diamond ratio
// (see game/isoMath.ts's own comment) the Phase-13 prototype validated.
//
// Bug fix (real-device report): the first cut of this used a much smaller
// tile ({760, 380}) sized as if buildings/houses would spread across the
// *entire* 0..1 domain — but Step B's clearance checks (HOUSE_CLEARANCE/
// TOWN_BUILDING_CLEARANCE, game/config.ts, both ~0.05) operate on that same
// 0..1 space, so a pair of buildings sitting at exactly the minimum legal
// distance apart barely moved on screen after that small a projection,
// reading as one solid clump with unreadable overlapping labels. The iso
// projection isn't a uniform-scale rotation — it's an anisotropic linear
// map — so its *worst-case* pixels-per-unit-grid-distance (the direction a
// clearance check can't protect against) is exactly (tile.height / 2) *
// sqrt(2) (calculus: minimizing |gridToScreen(unit vector)| over every
// direction). Setting tile.height so that HOUSE_CLEARANCE (0.05, the
// smaller of the two) times that worst-case factor is comfortably above a
// building sprite's own footprint (PLOT_BUILT_SIZE=44) plus its label
// (plotBuildingLabel, 60px wide) is what actually fixes the overlap — a
// bigger *tile*, not a bigger clearance constant, because existing saves'
// building positions (already placed under the old, smaller projection)
// can't retroactively gain more clearance in the data itself; only the
// rendering math can give them more visual room. With {4500, 2250}, worst-
// case separation for two buildings exactly HOUSE_CLEARANCE apart is
// (2250/2)*Math.SQRT2*0.05 ≈ 80px — comfortably more than the sprite/label
// footprint above.
const TOWN_ISO_TILE: IsoTileSize = { width: 4500, height: 2250 };
// A tile this large projects the full 0..1 domain far outside the old flat
// canvas (WORLD_CANVAS_WIDTH/HEIGHT, sized for DungeonMap's own top-down
// layout) — TownMap gets its own, bigger canvas instead. Sized to
// comfortably fit every fixed landmark (SHRINE_SPOT, MERCHANT_SPOT, the
// gate spots) plus the realistic building-placement area around TOWN_X/
// TOWN_Y (buildings cluster near the town hall in practice, same as the
// old flat layout's own density — nothing stops a tap further out, but
// there's no reason for one either) with real margin to spare, verified
// against every one of those fixed spots in this session's own check
// script. `PannableMap` already exists to pan/zoom around an
// intentionally-oversized canvas (see WORLD_CANVAS_WIDTH's own comment),
// so a bigger canvas here is the same established pattern, not a new one.
export const TOWN_ISO_CANVAS_WIDTH = 3200;
export const TOWN_ISO_CANVAS_HEIGHT = 2400;
// gridToScreen(gridX, gridY, tile) always maps equal coordinates (gridX ===
// gridY, e.g. TOWN_X/TOWN_Y's own (0.5, 0.5)) to (0, tile.height / 2)
// regardless of tile size — so centering the origin on this canvas's own
// geometric center, then nudging it up by exactly half the tile's height,
// makes the town hall's own iso screen position land on precisely
// (TOWN_ISO_CANVAS_WIDTH/2, TOWN_ISO_CANVAS_HEIGHT/2). That's the same
// point PannableMap's initialFocus={{x: TOWN_X, y: TOWN_Y}} already assumes
// (a plain x*width/y*height multiply — see PannableMap.tsx) as long as
// TownScreen passes this canvas's own size (not WORLD_CANVAS_WIDTH/HEIGHT)
// as PannableMap's contentWidth/contentHeight while TownMap is showing —
// see PannableMap's own re-fit-on-content-size-change fix, added alongside
// this bug fix so switching to/from DungeonMap's differently-sized canvas
// re-centers instead of keeping a scroll offset that means something
// different in the new content.
const TOWN_ISO_ORIGIN_X = TOWN_ISO_CANVAS_WIDTH / 2;
const TOWN_ISO_ORIGIN_Y = TOWN_ISO_CANVAS_HEIGHT / 2 - TOWN_ISO_TILE.height / 2;

function townIsoScreenPos(gridX: number, gridY: number): { x: number; y: number } {
  const p = gridToScreen(gridX, gridY, TOWN_ISO_TILE);
  return { x: p.x + TOWN_ISO_ORIGIN_X, y: p.y + TOWN_ISO_ORIGIN_Y };
}

// Painter's-algorithm depth (see game/isoMath.ts's depthKey) shared by every
// kind of TownMap entity — buildings/houses/the town hall/birds/etc. are all
// sorted together into one paint order (townIsoSortedItems below) rather
// than drawn in separate fixed layers, so a bird correctly renders in front
// of a building it has walked past and behind one it hasn't reached yet.
function townIsoDepth(gridX: number, gridY: number): number {
  return depthKey(gridX, gridY);
}

// A screen-space tap (already relative to the field's own top-left corner,
// e.g. a TouchableWithoutFeedback's locationX/Y) back to the same
// normalized (0..1) x/y every store action (constructBuilding, buildHouse,
// ...) already expects — the exact inverse of townIsoScreenPos above, used
// by TownMap's placement-mode tap overlay.
function townIsoScreenToGrid(screenX: number, screenY: number): { x: number; y: number } {
  return screenToGrid(screenX - TOWN_ISO_ORIGIN_X, screenY - TOWN_ISO_ORIGIN_Y, TOWN_ISO_TILE);
}

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
  // Step B ("building free placement"): every constructed shop/amenity,
  // freely positioned rather than tied to a fixed grid plot id — see
  // types.ts's TownBuildingInstance.
  buildings: Record<string, TownBuildingInstance>;
  // Phase 14: houses, independent of any particular bird (see HouseState) —
  // replaces the old fixed per-defId HOUSE_POSITIONS/HOUSE_IMAGES lookup.
  houses: Record<string, HouseState>;
  townLevel: number;
  merchant: MerchantState | null;
  onBirdPress: (defId: string) => void;
  // Tapping an already-built shop-kind building reopens its shop modal (see
  // getBuildingOption) — decorative buildings (garden/park/bathhouse) do
  // nothing when tapped, same as before.
  onBuildingPress: (buildingId: string) => void;
  onMerchantPress: () => void;
  onTownHallPress: () => void;
  onHousePress: (house: HouseState) => void;
  // Phase 14's free house placement (and now Step B's free building
  // placement too) — when true, the whole map becomes one big tap target (a
  // semi-transparent hint overlay shows this) instead of its usual
  // sprite-by-sprite Pressables; tapping anywhere calls onMapTap with the
  // tapped point in the same 0..1 normalized space everything else here
  // uses. TownScreen itself decides what "placement mode" currently means
  // (a house, or a specific building type) and routes onMapTap accordingly.
  placementMode?: boolean;
  onMapTap?: (x: number, y: number) => void;
  // Construction placement preview — set while the player has picked a
  // building type and is tapping around to choose where it goes (see
  // TownScreen's previewPosition), null the rest of the time (including
  // while placing a house, which has no preview step). `blocked` is a
  // pure read-only check (see useTownStore's isBuildingPlacementBlocked) —
  // it doesn't reflect the building cap, only spot clearance, since the cap
  // is already enforced back in ConstructionModal before placement mode
  // even starts.
  previewBuilding?: { x: number; y: number; optionId: string; blocked: boolean } | null;
  // Map-split follow-up: tapping the town-side gate marker below jumps
  // straight to the dungeon screen (same effect as TownScreen's own tab
  // switcher) — purely a convenience shortcut, not a new game mechanic.
  onDungeonGatePress: () => void;
}

// Grid-space nudges for two fixed presences that used to be positioned with
// a raw pixel offset from the town hall/shrine (44px / 40px respectively, at
// the old flat fieldHeight=1400 scale) — converted to an equivalent small
// offset in normalized grid units (44/1400 ≈ 0.03) so they keep "standing
// just in front of" their landmark once that offset also has to survive
// being run through the iso projection (a raw pixel nudge applied *after*
// projecting would no longer point in a consistent visual direction).
const SHOPKEEPER_GRID_OFFSET = 0.03;
const ALSHEL_GRID_OFFSET = 0.03;

// One entry in TownMap's single Y-sorted paint order — every kind of town
// entity (building, house, the town hall, a bird, ...) reduces to "where is
// its footprint in grid space" (gx/gy) plus a render callback that receives
// the already-projected screen position and this item's computed zIndex.
// Painting everything through one sorted list (rather than the old fixed
// per-category layering) is what makes a bird correctly walk behind a
// building it hasn't reached yet and in front of one it's already passed.
interface TownIsoItem {
  key: string;
  gx: number;
  gy: number;
  render: (pos: { x: number; y: number }, zIndex: number) => React.ReactNode;
}

// Map-split step 2: the town's own screen — town hall, shrine, shops,
// houses, and only recruited birds currently "in town" (see
// TownMapProps.birds). No town-zone ellipse/fence anymore (see this file's
// previous revision in git history) — now that this is its own dedicated
// screen rather than a carved-out region of one shared map, there's nothing
// left for that ellipse to distinguish. Step B (building free placement)
// removed the fixed 48-plot grid — buildings render wherever their own
// (x, y) says, same as houses already did. Step C ("アイソメトリックへの移行")
// projects every one of those (x, y) positions through isoMath's
// gridToScreen (see townIsoScreenPos above) and paints them all in one
// Y-sorted (townIsoDepth) list instead of the old flat top-down layering —
// DungeonMap below is completely unaffected, still plain top-down.
export function TownMap({
  birds,
  buildings,
  houses,
  townLevel,
  merchant,
  onBirdPress,
  onBuildingPress,
  onMerchantPress,
  onTownHallPress,
  onHousePress,
  placementMode,
  onMapTap,
  previewBuilding,
  onDungeonGatePress,
}: TownMapProps) {
  // Its own (bigger — see TOWN_ISO_TILE's bug-fix comment above) canvas,
  // not WORLD_CANVAS_WIDTH/HEIGHT — DungeonMap keeps using those.
  const fieldWidth = TOWN_ISO_CANVAS_WIDTH;
  const fieldHeight = TOWN_ISO_CANVAS_HEIGHT;
  const townLevelDef = getTownLevelDef(townLevel);

  const isoItems: TownIsoItem[] = [];

  TOWN_DECOR.forEach((d, i) => {
    isoItems.push({
      key: `decor-${i}`,
      gx: d.x,
      gy: d.y,
      render: (pos, zIndex) => (
        <Text key={`decor-${i}`} pointerEvents="none" style={[styles.decor, { left: pos.x - 12, top: pos.y - 12, zIndex }]}>
          {d.emoji}
        </Text>
      ),
    });
  });

  Object.values(buildings).forEach((b) => {
    isoItems.push({
      key: b.id,
      gx: b.x,
      gy: b.y,
      render: (pos, zIndex) => (
        <BuildingSprite key={b.id} instance={b} x={pos.x} y={pos.y} zIndex={zIndex} onPress={() => onBuildingPress(b.id)} />
      ),
    });
  });

  isoItems.push({
    key: 'townhall',
    gx: TOWN_X,
    gy: TOWN_Y,
    render: (pos, zIndex) => (
      <AnimatedPressable
        key="townhall"
        onPress={onTownHallPress}
        style={[styles.town, { left: pos.x - 32, top: pos.y - 32, zIndex }]}
      >
        <View pointerEvents="none" style={styles.shadowEllipse} />
        <Image source={TOWNHALL_IMAGES[townLevel]} resizeMode="contain" style={styles.townImage} />
        <Text style={styles.townLabel}>{townLevelDef.name}</Text>
      </AnimatedPressable>
    ),
  });

  isoItems.push({
    key: 'shopkeeper',
    gx: TOWN_X,
    gy: TOWN_Y + SHOPKEEPER_GRID_OFFSET,
    render: (pos, zIndex) => <ShopkeeperSprite key="shopkeeper" x={pos.x} y={pos.y} zIndex={zIndex} />,
  });

  if (merchant) {
    isoItems.push({
      key: 'merchant',
      gx: MERCHANT_SPOT.x,
      gy: MERCHANT_SPOT.y,
      render: (pos, zIndex) => (
        <MerchantSprite key="merchant" merchant={merchant} x={pos.x} y={pos.y} zIndex={zIndex} onPress={onMerchantPress} />
      ),
    });
  }

  isoItems.push({
    key: 'shrine',
    gx: SHRINE_SPOT.x,
    gy: SHRINE_SPOT.y,
    render: (pos, zIndex) => <ShrineSprite key="shrine" x={pos.x} y={pos.y} townLevel={townLevel} zIndex={zIndex} />,
  });

  isoItems.push({
    key: 'alshel',
    gx: SHRINE_SPOT.x,
    gy: SHRINE_SPOT.y + ALSHEL_GRID_OFFSET,
    render: (pos, zIndex) => <AlshelSprite key="alshel" x={pos.x} y={pos.y} townLevel={townLevel} zIndex={zIndex} />,
  });

  isoItems.push({
    key: 'dungeon-gate',
    gx: DUNGEON_GATE_SPOT.x,
    gy: DUNGEON_GATE_SPOT.y,
    render: (pos, zIndex) => (
      <GateMarker key="dungeon-gate" x={pos.x} y={pos.y} zIndex={zIndex} emoji="🚪" label="ダンジョンへ" onPress={onDungeonGatePress} />
    ),
  });

  Object.values(houses).forEach((house) => {
    isoItems.push({
      key: house.id,
      gx: house.x,
      gy: house.y,
      render: (pos, zIndex) => {
        const resident = house.residentDefId ? getCharacterDef(house.residentDefId) : null;
        const houseImage = house.residentDefId ? HOUSE_IMAGES[house.residentDefId] ?? HOUSE_VACANT_IMAGE : HOUSE_VACANT_IMAGE;
        return (
          <AnimatedPressable
            key={house.id}
            style={[styles.house, { left: pos.x - 18, top: pos.y - 18, zIndex }]}
            onPress={() => onHousePress(house)}
          >
            <View pointerEvents="none" style={styles.shadowEllipse} />
            <Image source={houseImage} resizeMode="contain" style={styles.houseImage} />
            <Text style={styles.houseTag}>{resident ? resident.emoji : '🔑'}</Text>
          </AnimatedPressable>
        );
      },
    });
  });

  birds.forEach((b) => {
    isoItems.push({
      key: b.defId,
      gx: b.x,
      gy: b.y,
      render: (pos, zIndex) => (
        <BirdSprite key={b.defId} bird={b} targetX={pos.x} targetY={pos.y} zIndex={zIndex} onPress={() => onBirdPress(b.defId)} />
      ),
    });
  });

  // Painter's algorithm: further-back (smaller gx+gy) first, closer-to-
  // camera (larger gx+gy) last — see game/isoMath.ts's depthKey comment.
  const sortedIsoItems = [...isoItems].sort((a, b) => townIsoDepth(a.gx, a.gy) - townIsoDepth(b.gx, b.gy));

  // The road network: a branching web of dirt-road segments connecting
  // nearby buildings to each other (see buildRoadEdges above — a Prim's-
  // algorithm minimum spanning tree rooted at the town hall, computed in
  // grid space), not a hub where every single building connects straight
  // back to the town hall (real-device feedback: that read as an unnatural
  // spoked wheel). Derived fresh from `buildings` on every render (not
  // stored anywhere), so it automatically "re-generates" the instant a
  // building is constructed, relocated (useTownStore's moveBuilding), or
  // removed, with zero extra wiring. Purely a ground-level decoration (see
  // RoadSegment/styles.roadSegment below) — rendered before the Y-sorted
  // items so buildings/birds always draw on top of the road surface, never
  // underneath it.
  const roadNetworkNodes: RoadNode[] = [
    { id: 'townhall', x: TOWN_X, y: TOWN_Y },
    ...Object.values(buildings).map((b) => ({ id: b.id, x: b.x, y: b.y })),
  ];
  const roadEdges = buildRoadEdges(roadNetworkNodes);

  return (
    <View style={[styles.field, styles.isoField, { width: fieldWidth, height: fieldHeight }]}>
      {/* Step C's background rework: a soft rounded "land" patch standing
          out from the pale sky-toned backdrop set by styles.isoField above
          (see styles.isoGroundPatch) — deliberately simple (no new art, no
          real diamond-tiled ground) per the request's own "凝った演出は不要". */}
      <View
        pointerEvents="none"
        style={[
          styles.isoGroundPatch,
          {
            left: TOWN_ISO_ORIGIN_X - TOWN_ISO_TILE.width / 2 - 60,
            top: TOWN_ISO_ORIGIN_Y - 70,
            width: TOWN_ISO_TILE.width + 120,
            height: TOWN_ISO_TILE.height + 170,
          },
        ]}
      />

      {roadEdges.map((edge) => {
        const fromPos = townIsoScreenPos(edge.from.x, edge.from.y);
        const toPos = townIsoScreenPos(edge.to.x, edge.to.y);
        // A gentle, stable-per-edge bend (see bentMidpoint) instead of one
        // dead-straight segment — real-device feedback specifically asked
        // for roads that "curve or bend a little" rather than ruler-straight
        // lines. Two straight RoadSegments meeting at the bent midpoint is
        // the same "line between two points" trick RoadSegment already
        // uses, just applied twice — no new rendering primitive needed.
        const seed = pseudoRandom(seedFromString(`${edge.from.id}|${edge.to.id}`));
        const bend = bentMidpoint(fromPos, toPos, seed);
        return (
          <React.Fragment key={`road-${edge.from.id}-${edge.to.id}`}>
            <RoadSegment from={fromPos} to={bend} />
            <RoadSegment from={bend} to={toPos} />
          </React.Fragment>
        );
      })}

      {sortedIsoItems.map((item) => item.render(townIsoScreenPos(item.gx, item.gy), Math.round(townIsoDepth(item.gx, item.gy) * 1000) + 10))}

      {placementMode && onMapTap && (
        <TouchableWithoutFeedback
          onPress={(e) => {
            const { x, y } = townIsoScreenToGrid(e.nativeEvent.locationX, e.nativeEvent.locationY);
            onMapTap(x, y);
          }}
        >
          <View style={[styles.placementOverlay, { width: fieldWidth, height: fieldHeight }]} />
        </TouchableWithoutFeedback>
      )}

      {previewBuilding && (
        <PlacementPreviewSprite
          pos={townIsoScreenPos(previewBuilding.x, previewBuilding.y)}
          optionId={previewBuilding.optionId}
          blocked={previewBuilding.blocked}
        />
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
  // Map-split follow-up: tapping the field-side gate marker below jumps
  // straight back to the town screen — the return-trip counterpart of
  // TownMapProps.onDungeonGatePress.
  onTownGatePress: () => void;
}

// Map-split step 2: the dungeon/field screen — forest/quarry/mushroom/lake/
// ruins flavor patches, mining nodes, enemies, treasures, leisure spots, and
// only recruited birds currently "out in the dungeon" (see
// DungeonMapProps.birds). Shares the exact same canvas coordinate space as
// TownMap (see WORLD_CANVAS_WIDTH/HEIGHT's own comment) — a bird's x/y here
// mean exactly what they always have, this screen just doesn't draw any
// town content over them.
export function DungeonMap({
  enemies,
  miningNodes,
  treasures,
  leisureSpots,
  birds,
  dormantDefIds,
  onBirdPress,
  onTownGatePress,
}: DungeonMapProps) {
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

      <GateMarker
        x={FIELD_TOWN_GATE_SPOT.x * fieldWidth}
        y={FIELD_TOWN_GATE_SPOT.y * fieldHeight}
        emoji="🚪"
        label="街へ戻る"
        onPress={onTownGatePress}
      />

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
function ShopkeeperSprite({ x, y, zIndex }: { x: number; y: number; zIndex?: number }) {
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
    <Animated.View pointerEvents="none" style={[styles.sprite, { left: x, top: y, zIndex, transform: [{ translateY: bobY }] }]}>
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
  zIndex,
  onPress,
}: {
  merchant: MerchantState;
  x: number;
  y: number;
  zIndex?: number;
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
      style={[styles.merchantBox, { left: x - 16, top: y - 21, zIndex }]}
    >
      <View pointerEvents="none" style={styles.shadowEllipse} />
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

// Step B ("building free placement"): a constructed shop/amenity, drawn at
// its own freely-chosen (x, y) — replaces the old PlotSprite, which used to
// also cover "locked"/"unlocked-but-empty" plot states that no longer exist
// (every TownBuildingInstance is, by construction, already built — see
// useTownStore's constructBuilding). getBuildingOption always resolves for a
// real instance (it was looked up successfully at construction time), so
// unlike the old PlotSprite there's no BUILDING_ICON fallback branch to
// cover a missing option.
function BuildingSprite({
  instance,
  x,
  y,
  zIndex,
  onPress,
}: {
  instance: TownBuildingInstance;
  x: number;
  y: number;
  zIndex?: number;
  onPress: () => void;
}) {
  const option = getBuildingOption(instance.constructedBuildingId);
  // 'park'/'bathhouse' (Phase 11) and every shop kind have real art (see
  // data/buildingImages.ts); 'garden' doesn't, and keeps the
  // emoji-in-a-card look below.
  const shopImage = option?.shopKind ? SHOP_IMAGES[option.shopKind] : undefined;
  const amenityImage = option ? AMENITY_IMAGES[option.id] : undefined;
  const buildingImage = shopImage ?? amenityImage;
  const label = option?.name;

  if (buildingImage) {
    // Real building art — a bigger, bottom-anchored (no card background)
    // box, same idea as the town-hall/house sprites: the art already has
    // its own ground shadow, so a background chip behind it would look
    // like a sticker rather than a building standing on the ground.
    return (
      <>
        <AnimatedPressable
          style={[styles.plotBuilt, { left: x - PLOT_BUILT_SIZE / 2, top: y - PLOT_BUILT_SIZE / 2, zIndex }]}
          onPress={onPress}
        >
          <View pointerEvents="none" style={styles.shadowEllipse} />
          <Image source={buildingImage} resizeMode="contain" style={styles.plotBuiltImage} />
        </AnimatedPressable>
        {label && (
          <Text
            pointerEvents="none"
            style={[styles.plotBuildingLabel, { left: x - 30, top: y + PLOT_BUILT_SIZE / 2 + 1, zIndex }]}
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
      <AnimatedPressable style={[styles.plot, styles.plotOpen, { left: x - 18, top: y - 18, zIndex }]} onPress={onPress}>
        <Text style={styles.plotBuildingIcon}>{option?.emoji ?? '·'}</Text>
      </AnimatedPressable>
      {/* The box itself clips at 36x36 (overflow: hidden), so the label is
          a separate sibling positioned just below it rather than a child —
          otherwise it'd get cut off before ever becoming visible. */}
      {label && (
        <Text pointerEvents="none" style={[styles.plotBuildingLabel, { left: x - 30, top: y + 19, zIndex }]} numberOfLines={1}>
          {label}
        </Text>
      )}
    </>
  );
}

// One town-hall-or-building node in the road network — grid-space (not yet
// projected) x/y, plus an id used both to identify it and to seed each of
// its edges' bend (see bentMidpoint/seedFromString below) deterministically.
interface RoadNode {
  id: string;
  x: number;
  y: number;
}

// Real-device feedback: a road straight from the town hall to *every*
// building read as an unnatural spoked wheel, not "a town that feels
// connected." Builds a branching network instead — Prim's-algorithm minimum
// spanning tree rooted at the town hall: starting from just the town hall,
// repeatedly connects whichever not-yet-connected node is *closest to any
// already-connected node* (not necessarily the town hall itself), so a
// building usually ends up connected to its nearest neighboring building
// rather than converging on one central point — "近くの建物同士をつなぎ、
// それが結果的に街全体を繋ぐネットワークになる" is exactly what this
// produces. Distance is plain Euclidean in grid space (matching the same
// clearance-radius math the rest of Step B/C already uses), not post-
// projection screen space — "nearest" should mean nearest in the actual
// game world, not however the current iso tile happens to skew things.
// O(n²), fine at this game's building-count scale (capped at 48 — see
// TOWN_BUILDING_CAP_BY_LEVEL).
function buildRoadEdges(nodes: RoadNode[]): { from: RoadNode; to: RoadNode }[] {
  if (nodes.length < 2) return [];
  const connected = [nodes[0]];
  const remaining = nodes.slice(1);
  const edges: { from: RoadNode; to: RoadNode }[] = [];
  while (remaining.length > 0) {
    let bestConnectedIndex = -1;
    let bestRemainingIndex = -1;
    let bestDist = Infinity;
    for (let i = 0; i < connected.length; i++) {
      for (let j = 0; j < remaining.length; j++) {
        const d = Math.hypot(connected[i].x - remaining[j].x, connected[i].y - remaining[j].y);
        if (d < bestDist) {
          bestDist = d;
          bestConnectedIndex = i;
          bestRemainingIndex = j;
        }
      }
    }
    const newNode = remaining[bestRemainingIndex];
    edges.push({ from: connected[bestConnectedIndex], to: newNode });
    connected.push(newNode);
    remaining.splice(bestRemainingIndex, 1);
  }
  return edges;
}

// A short, stable numeric hash for a string (e.g. "buildingA|buildingB") —
// feeds pseudoRandom (already defined above for tile-variant selection) so
// each road edge's bend is deterministic/stable across re-renders instead
// of jittering every tick, without storing anything.
function seedFromString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

// Nudges a straight segment's midpoint sideways (perpendicular to the
// from->to direction) by a small, seeded amount — real-device feedback
// specifically asked for roads that "curve or bend a little" rather than
// perfectly straight lines. Two straight segments meeting at this bent
// point (see TownMap's roadEdges.map) read as one gently-kinked path, no
// bezier/SVG needed. Capped at 40px regardless of segment length so a very
// long edge doesn't get an exaggerated kink.
function bentMidpoint(from: { x: number; y: number }, to: { x: number; y: number }, seed: number): { x: number; y: number } {
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length < 1e-6) return { x: midX, y: midY };
  const perpX = -dy / length;
  const perpY = dx / length;
  const magnitude = Math.min(length * 0.18, 40) * (seed * 2 - 1);
  return { x: midX + perpX * magnitude, y: midY + perpY * magnitude };
}

// A single straight dirt-road band between two already-projected screen
// points (see TownMap's roadEdges — either half of a bent two-segment
// road). Positioned/sized so its own box's *center* sits at the segment's
// midpoint, then rotated to the from->to angle — since RN's default
// transform-origin is an element's own center, this is the standard
// technique for drawing a line between two points without needing
// `transformOrigin` support or SVG. pointerEvents="none": purely a ground
// decoration, never a tap target.
const ROAD_WIDTH = 14;

function RoadSegment({ from, to }: { from: { x: number; y: number }; to: { x: number; y: number } }) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;

  return (
    <View
      pointerEvents="none"
      style={[
        styles.roadSegment,
        {
          left: midX - length / 2,
          top: midY - ROAD_WIDTH / 2,
          width: length,
          height: ROAD_WIDTH,
          transform: [{ rotate: `${angleDeg}deg` }],
        },
      ]}
    />
  );
}

// Construction placement preview — a semi-transparent, color-coded (green =
// placeable, red = blocked, see useTownStore's isBuildingPlacementBlocked)
// stand-in shown at wherever the player last tapped, before they've
// confirmed the actual build (see TownScreen's previewPosition/
// handleConfirmBuild). Purely a rendering aid: pointerEvents="none" so it
// never intercepts the tap overlay underneath it, which is what actually
// moves the preview on each re-tap.
function PlacementPreviewSprite({
  pos,
  optionId,
  blocked,
}: {
  pos: { x: number; y: number };
  optionId: string;
  blocked: boolean;
}) {
  const option = getBuildingOption(optionId);
  return (
    <View
      pointerEvents="none"
      style={[styles.previewSprite, blocked ? styles.previewBlocked : styles.previewOk, { left: pos.x - 22, top: pos.y - 22 }]}
    >
      <Text style={styles.previewEmoji}>{option?.emoji ?? '·'}</Text>
    </View>
  );
}

// Phase 15②: the town's abandoned shrine — always present from game start,
// no tap interaction (nothing to open yet, same as the leisure spots below),
// just a visual cue that gradually brightens/decorates as townLevel rises
// (see data/shrine.ts's SHRINE_STAGE_DEFS), until it's fully restored and
// アルシェル (see AlshelSprite below) reveals herself right beside it.
function ShrineSprite({ x, y, townLevel, zIndex }: { x: number; y: number; townLevel: number; zIndex?: number }) {
  const stage = getShrineStageDef(townLevel);
  return (
    <View pointerEvents="none" style={[styles.sprite, { left: x, top: y, zIndex, opacity: stage.opacity }]}>
      <Text style={styles.emojiLarge}>
        {stage.decor ? `${stage.decor} ` : ''}
        {stage.emoji}
        {stage.decor ? ` ${stage.decor}` : ''}
      </Text>
      <Text style={styles.nameTag}>{stage.label}</Text>
    </View>
  );
}

// アルシェル — the shrine's own fixed keeper/spirit (see data/shrine.ts's
// ALSHEL_NPC's own comment for the full spec correction this replaces: she
// is NOT a recruitable bird, never gathers/fights/shops, and never leaves
// the shrine). Modeled directly on ShopkeeperSprite above — a fixed,
// non-interactive presence with a gentle idle bob — rather than on
// BirdSprite/the bird-AI pipeline. Renders nothing until the shrine is fully
// restored (see ALSHEL_REVEAL_TOWN_LEVEL); her actual roles (prayer buffs,
// seasonal events, calling rare birds/spirits, omikuji, shrine level
// management) are intentionally not implemented yet — this is just her
// fixed presence.
function AlshelSprite({ x, y, townLevel, zIndex }: { x: number; y: number; townLevel: number; zIndex?: number }) {
  const bob = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 1400, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
        Animated.timing(bob, { toValue: 0, duration: 1400, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [bob]);

  if (townLevel < ALSHEL_REVEAL_TOWN_LEVEL) return null;

  const bobY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -3] });

  return (
    <Animated.View pointerEvents="none" style={[styles.sprite, { left: x, top: y, zIndex, transform: [{ translateY: bobY }] }]}>
      <Text style={styles.emojiLarge}>{ALSHEL_NPC.emoji}</Text>
      <Text style={styles.nameTag}>{ALSHEL_NPC.name}様</Text>
    </Animated.View>
  );
}

// Map-split follow-up: a simple, tappable "entrance" marker shown on both
// screens (see DUNGEON_GATE_SPOT/FIELD_TOWN_GATE_SPOT in data/world.ts) so
// switching between TownMap/DungeonMap reads as birds passing through a
// shared gate rather than vanishing/appearing out of nowhere. Purely
// decorative + a tap shortcut — no bird actually paths through this spot,
// same as before.
function GateMarker({
  x,
  y,
  zIndex,
  emoji,
  label,
  onPress,
}: {
  x: number;
  y: number;
  zIndex?: number;
  emoji: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <AnimatedPressable onPress={onPress} style={[styles.sprite, { left: x, top: y, zIndex }]}>
      <Text style={styles.emojiLarge}>{emoji}</Text>
      <Text style={styles.nameTag}>{label}</Text>
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
  zIndex,
  onPress,
}: {
  bird: BirdState;
  targetX: number;
  targetY: number;
  zIndex?: number;
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
        { zIndex, transform: [{ translateX: pos.x }, { translateY: Animated.add(pos.y, Animated.add(bobY, hopY)) }] },
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
  // Step C: TownMap's own background — a pale "sky" backdrop (rather than
  // the flat meadow-green fill DungeonMap still uses) so the isoGroundPatch
  // below reads as a distinct patch of land the town stands on, not just
  // more of the same color. DungeonMap is untouched (still plain `field`).
  isoField: {
    backgroundColor: theme.bgTop,
  },
  // The "land" itself — a single soft-edged patch roughly matching the
  // projected content's own footprint (see TOWN_ISO_TILE/TOWN_ISO_ORIGIN_Y
  // above), deliberately plain (a big rounded rect, no tile art, no real
  // diamond shape) per the request's own "凝った演出は不要" — this is meant
  // to fix "地面に立っている感が薄い", not to be a finished ground texture.
  isoGroundPatch: {
    position: 'absolute',
    backgroundColor: theme.ground,
    borderRadius: 260,
    opacity: 0.95,
  },
  // This round's dynamic road segments (see RoadSegment above) — a flat
  // solid tan band (theme.road, previously defined for the old fixed-grid
  // road system that Step B removed, never reused until now) rather than
  // new tile art, per the request's own "既存の道の表現(単色〜グラデーション
  // の帯)を流用してください". Rounded ends (borderRadius) so a road reads as
  // one continuous band rather than a hard-edged rectangle where it meets
  // the town hall / a building.
  roadSegment: {
    position: 'absolute',
    backgroundColor: theme.road,
    borderRadius: ROAD_WIDTH / 2,
    opacity: 0.75,
  },
  // A soft dark ellipse under a structure's own footprint — the same "does
  // this thing look like it's standing on the ground" fix the Phase-13
  // prototype's shadow toggle validated, now always-on rather than a
  // debug toggle. `alignSelf: 'center'` + a percentage width means one
  // shared style scales correctly across every bottom-anchored container
  // that uses it (town hall/house/building — all differently sized).
  shadowEllipse: {
    position: 'absolute',
    bottom: -4,
    alignSelf: 'center',
    width: '68%',
    height: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.25)',
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
    // A plain fallback zIndex (Phase 12③'s original static "buildings always
    // above birds" fix) — TownMap always overrides this per-instance with
    // its own Y-sorted depth (see townIsoDepth/TownIsoItem above) now that
    // Step C's isometric migration needs a bird to correctly render in
    // front of a building it's already passed and behind one it hasn't
    // reached yet, not a fixed layer order.
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
  // sitting above every other sprite so a tap anywhere reaches onMapTap
  // instead of whatever sprite happens to be underneath it. Bumped from 50
  // to 9000 for Step C: TownMap's Y-sorted iso items now carry a per-
  // instance zIndex of up to roughly depth*1000 (see townIsoDepth/
  // TownIsoItem — depth is gx+gy, which can reach ~2 for the far corner of
  // the grid), which would otherwise render above this overlay for any
  // building/bird past the map's very near edge.
  placementOverlay: { position: 'absolute', left: 0, top: 0, zIndex: 9000, backgroundColor: 'rgba(232,163,61,0.08)' },
  // Sits above the placement overlay (zIndex 9000 — see its own comment)
  // so it's actually visible while placing — pointerEvents: none (see
  // PlacementPreviewSprite's own comment) keeps it from stealing the
  // overlay's own taps.
  previewSprite: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9010,
  },
  previewOk: { backgroundColor: 'rgba(90, 200, 120, 0.4)', borderColor: 'rgba(52, 168, 83, 0.95)' },
  previewBlocked: { backgroundColor: 'rgba(220, 90, 90, 0.4)', borderColor: 'rgba(196, 60, 60, 0.95)' },
  previewEmoji: { fontSize: 22 },
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
  plotOpen: {
    backgroundColor: theme.cardAlt,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: theme.pink,
  },
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
