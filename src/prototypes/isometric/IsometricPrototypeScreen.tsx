import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { AMENITY_IMAGES, TOWNHALL_IMAGES, SHOP_IMAGES } from '../../data/buildingImages';
import { BIRD_BASE_SPRITES } from '../../game/birdBaseSprites';
import { depthKey, gridToScreen, IsoTileSize } from '../../game/isoMath';

// Phase-13 feasibility prototype ("大型変更: アイソメトリックへの移行", ステップ
// 1). A throwaway 6x6-tile scene — NOT wired into the real game's own
// screens/stores. Two ways to view it on a device, both fully reversible:
//  - src/game/config.ts's SHOW_ISOMETRIC_PROTOTYPE (App.tsx replaces the
//    whole app with this screen)
//  - src/game/config.ts's SHOW_ISOMETRIC_DEBUG_BUTTON (a small button on
//    TownScreen opens this in a Modal over the real running game — added
//    per a follow-up request so the prototype's reachable without editing
//    any flags by hand)
// See this session's own written report(s) for the actual feasibility
// findings this was built to answer.
//
// Deliberately reuses real, already-shipped assets (TOWNHALL_IMAGES,
// SHOP_IMAGES, AMENITY_IMAGES, BIRD_BASE_SPRITES) rather than placeholder
// art — the whole point of this prototype is to see whether today's
// top-down-drawn illustrations read as acceptable once dropped onto an
// isometric ground plane, not to build new isometric-specific art first.
const TILE: IsoTileSize = { width: 96, height: 48 };
const GRID_SIZE = 6;
const ORIGIN_X = 300; // where grid (0,0) lands on screen — centers the diamond in the stage below
const ORIGIN_Y = 90;

// ---- Follow-up request: compare today's perfectly-circular plot grid
// against a more organic, free-placement layout, side by side in the same
// prototype. Both are just "which grid cells count as developed town land"
// plus "where are the buildings" — swapping between them is the whole demo,
// no separate screens needed.

// "radial" stands in for the current game's actual layout (buildings in
// concentric rings around the town hall) — a plain distance-from-center
// cutoff produces the same kind of perfect circle/diamond shape.
const RADIAL_CENTER = { x: 2.5, y: 2.5 };
const RADIAL_RADIUS = 2.3;
function isRadialTownCell(gridX: number, gridY: number): boolean {
  const dx = gridX - RADIAL_CENTER.x;
  const dy = gridY - RADIAL_CENTER.y;
  return Math.sqrt(dx * dx + dy * dy) <= RADIAL_RADIUS;
}

// "organic" is hand-authored on purpose (not a formula) — a real organic
// boundary is exactly the kind of shape that *isn't* describable by one
// clean equation: a bump reaching north around column 2, a narrow tail
// reaching out to (5,3). This is what "育っていく街の輪郭" would look like
// once it's not forced through a circle.
const ORGANIC_TOWN_CELLS = new Set<string>([
  '2_0',
  '1_1', '2_1', '3_1',
  '0_2', '1_2', '2_2', '3_2', '4_2',
  '1_3', '2_3', '3_3', '4_3', '5_3',
  '2_4', '3_4',
]);
function isOrganicTownCell(gridX: number, gridY: number): boolean {
  return ORGANIC_TOWN_CELLS.has(`${gridX}_${gridY}`);
}

type LayoutMode = 'radial' | 'organic';

interface LayoutBuildingSpec {
  key: string;
  gridX: number;
  gridY: number;
  image: number;
  width: number;
  height: number;
  label: string;
}

const LAYOUTS: Record<
  LayoutMode,
  { label: string; subtitle: string; isTownCell: (x: number, y: number) => boolean; buildings: LayoutBuildingSpec[] }
> = {
  radial: {
    label: '現状イメージ(円形グリッド)',
    subtitle: '役場を中心に、リング状に整然と並ぶ今の配置ルール',
    isTownCell: isRadialTownCell,
    buildings: [
      { key: 'townhall', gridX: 2, gridY: 2, image: TOWNHALL_IMAGES[1], width: 70, height: 70, label: '役場' },
      { key: 'shopA', gridX: 2, gridY: 0, image: SHOP_IMAGES.general!, width: 56, height: 56, label: '道具屋' },
      { key: 'shopB', gridX: 4, gridY: 2, image: SHOP_IMAGES.feed!, width: 56, height: 56, label: '餌屋' },
    ],
  },
  organic: {
    label: '提案イメージ(自由配置+有機的な境界)',
    subtitle: '円形のリングをやめ、輪郭も配置も非対称・自由なマス目に',
    isTownCell: isOrganicTownCell,
    buildings: [
      { key: 'townhall', gridX: 2, gridY: 2, image: TOWNHALL_IMAGES[1], width: 70, height: 70, label: '役場' },
      // Tucked into a corner of the blob rather than sitting on an axis —
      // "not on a ring" is the whole point here.
      { key: 'shopA', gridX: 1, gridY: 1, image: SHOP_IMAGES.general!, width: 56, height: 56, label: '道具屋' },
      { key: 'shopB', gridX: 5, gridY: 3, image: SHOP_IMAGES.feed!, width: 56, height: 56, label: '餌屋' },
      // Deliberately non-integer grid coordinates — gridToScreen already
      // accepts any real number, so "free" (not grid-locked) placement
      // needs zero new math, just a UI for picking a continuous position.
      { key: 'garden', gridX: 3.4, gridY: 1.6, image: AMENITY_IMAGES.park, width: 40, height: 40, label: '公園(自由配置)' },
    ],
  },
};

// A single ground tile, drawn as a rotated+squashed square so it reads as
// an isometric diamond without needing real diamond-shaped tile art yet.
// Cells inside the active layout's town shape get a greener/richer tint;
// cells outside it get a paler, desaturated "not yet claimed" tint — this
// contrast IS the boundary-shape comparison, no separate outline needed.
function GroundTile({ gridX, gridY, isTown }: { gridX: number; gridY: number; isTown: boolean }) {
  const { x, y } = gridToScreen(gridX, gridY, TILE);
  const parity = (gridX + gridY) % 2 === 0;
  const backgroundColor = isTown ? (parity ? '#bfe3a8' : '#aed896') : parity ? '#dde3d0' : '#d4dac7';
  return (
    <View
      pointerEvents="none"
      style={[
        styles.groundTile,
        {
          left: ORIGIN_X + x - TILE.width / 2,
          top: ORIGIN_Y + y - TILE.height / 2,
          width: TILE.width,
          height: TILE.height,
          backgroundColor,
        },
      ]}
    />
  );
}

// A building/bird sprite anchored at its own grid cell — `depth` decides
// paint order relative to every other IsoSprite (see isoMath's depthKey
// comment on why bottom-anchored building art makes "footprint depth" and
// "sprite anchor point" the same thing).
interface IsoSpriteSpec {
  key: string;
  gridX: number;
  gridY: number;
  depth: number;
  image: number;
  width: number;
  height: number;
  label: string;
  dropShadow?: boolean;
}

function IsoSprite({ spec, showShadow }: { spec: IsoSpriteSpec; showShadow: boolean }) {
  const { x, y } = gridToScreen(spec.gridX, spec.gridY, TILE);
  return (
    <View
      pointerEvents="none"
      style={[
        styles.spriteBox,
        {
          left: ORIGIN_X + x - spec.width / 2,
          top: ORIGIN_Y + y - spec.height, // bottom-anchored: sprite's bottom edge sits on the tile
          width: spec.width,
          height: spec.height,
        },
      ]}
    >
      {/* The "light retouch" the follow-up asked to compare: a soft dark
          ellipse under the building's own footprint, toggled independently
          of layout mode so both can be A/B'd without leaving this screen. */}
      {showShadow && spec.dropShadow ? <View style={styles.shadowEllipse} /> : null}
      <Image source={spec.image} resizeMode="contain" style={styles.spriteImage} />
      <Text style={styles.spriteLabel}>{spec.label}</Text>
    </View>
  );
}

const BIRD_DEPTH_BIAS = 0.01; // ties at equal depth resolve in favor of the moving bird — see isoMath's depthKey comment

export function IsometricPrototypeScreen({ onClose }: { onClose?: () => void }) {
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('radial');
  const [showShadow, setShowShadow] = useState(false);
  const layout = LAYOUTS[layoutMode];

  // Animates a continuous grid position back and forth along the (0,0)→
  // (4,4) diagonal — deliberately passes *through* the town hall's own
  // (2,2) cell, the classic isometric Y-sort torture test: the bird must
  // render behind the town hall while approaching, then in front of it
  // once past. anim goes 0→1→0 forever; birdGrid is a plain-state mirror
  // (updated via the Animated listener) since depth-sort order has to be
  // decided in JS on each render, not just in a native-driven transform.
  const anim = useRef(new Animated.Value(0)).current;
  const [birdGrid, setBirdGrid] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const id = anim.addListener(({ value }) => {
      setBirdGrid({ x: value * 4, y: value * 4 });
    });
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
        Animated.timing(anim, { toValue: 0, duration: 2600, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
      ])
    ).start();
    return () => anim.removeListener(id);
  }, [anim]);

  const groundCells: { gridX: number; gridY: number }[] = [];
  for (let gy = 0; gy < GRID_SIZE; gy++) {
    for (let gx = 0; gx < GRID_SIZE; gx++) groundCells.push({ gridX: gx, gridY: gy });
  }

  const buildingSprites: IsoSpriteSpec[] = layout.buildings.map((b) => ({
    ...b,
    depth: depthKey(b.gridX, b.gridY),
    dropShadow: true,
  }));

  const birdSprite: IsoSpriteSpec = {
    key: 'bird',
    gridX: birdGrid.x,
    gridY: birdGrid.y,
    depth: depthKey(birdGrid.x, birdGrid.y) + BIRD_DEPTH_BIAS,
    image: BIRD_BASE_SPRITES.tororo,
    width: 40,
    height: 40,
    label: '',
  };

  const allSprites = [...buildingSprites, birdSprite].sort((a, b) => a.depth - b.depth);

  return (
    <View style={styles.screen}>
      {onClose ? (
        <Pressable style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeButtonText}>✕ 閉じる</Text>
        </Pressable>
      ) : null}
      <Text style={styles.title}>アイソメトリック検証プロトタイプ</Text>
      <Text style={styles.subtitle}>{layout.subtitle}</Text>

      <View style={styles.toggleRow}>
        <Pressable
          style={[styles.toggleButton, layoutMode === 'radial' && styles.toggleButtonActive]}
          onPress={() => setLayoutMode('radial')}
        >
          <Text style={[styles.toggleButtonText, layoutMode === 'radial' && styles.toggleButtonTextActive]}>
            {LAYOUTS.radial.label}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.toggleButton, layoutMode === 'organic' && styles.toggleButtonActive]}
          onPress={() => setLayoutMode('organic')}
        >
          <Text style={[styles.toggleButtonText, layoutMode === 'organic' && styles.toggleButtonTextActive]}>
            {LAYOUTS.organic.label}
          </Text>
        </Pressable>
      </View>
      <Pressable style={[styles.shadowButton, showShadow && styles.toggleButtonActive]} onPress={() => setShowShadow((s) => !s)}>
        <Text style={[styles.toggleButtonText, showShadow && styles.toggleButtonTextActive]}>
          建物に影を{showShadow ? '付ける (ON)' : '付けない (OFF)'} — タップで切替
        </Text>
      </Pressable>

      <View style={styles.stage}>
        {groundCells.map((c) => (
          <GroundTile key={`${c.gridX}_${c.gridY}`} gridX={c.gridX} gridY={c.gridY} isTown={layout.isTownCell(c.gridX, c.gridY)} />
        ))}
        {allSprites.map((s) => (
          <IsoSprite key={s.key} spec={s} showShadow={showShadow} />
        ))}
      </View>
      <Text style={styles.note}>
        濃い緑=街の土地・薄い緑=未開拓の土地。鳥が役場の手前/奥どちらに描かれるかでYソートの動作を、2つのボタンで境界の形と影の有無を確認できます。
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fdf6e3', paddingTop: 60, alignItems: 'center' },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  closeButtonText: { fontSize: 12, fontWeight: '700', color: '#5a4632' },
  title: { fontSize: 16, fontWeight: '800', color: '#5a4632' },
  subtitle: { fontSize: 11, color: '#8a7660', marginTop: 4, textAlign: 'center', paddingHorizontal: 20 },
  toggleRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  toggleButton: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  toggleButtonActive: { backgroundColor: '#e8a33d' },
  toggleButtonText: { fontSize: 11, fontWeight: '700', color: '#8a7660' },
  toggleButtonTextActive: { color: '#fff' },
  shadowButton: {
    marginTop: 8,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  stage: { width: 600, height: 420, marginTop: 16 },
  groundTile: {
    position: 'absolute',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  spriteBox: { position: 'absolute', alignItems: 'center' },
  spriteImage: { width: '100%', height: '100%' },
  spriteLabel: {
    position: 'absolute',
    bottom: -14,
    fontSize: 9,
    fontWeight: '700',
    color: '#5a4632',
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 6,
    paddingHorizontal: 4,
  },
  shadowEllipse: {
    position: 'absolute',
    bottom: -2,
    alignSelf: 'center',
    width: '70%',
    height: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  note: { fontSize: 11, color: '#8a7660', marginTop: 20, textAlign: 'center', paddingHorizontal: 24 },
});
