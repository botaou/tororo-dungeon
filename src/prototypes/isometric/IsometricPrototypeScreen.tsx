import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';

import { TOWNHALL_IMAGES, SHOP_IMAGES } from '../../data/buildingImages';
import { BIRD_BASE_SPRITES } from '../../game/birdBaseSprites';
import { depthKey, gridToScreen, IsoTileSize } from './isoMath';

// Phase-13 feasibility prototype ("大型変更: アイソメトリックへの移行", ステップ
// 1). A throwaway 3x3-tile scene — NOT wired into the real game, NOT
// reachable from anywhere production code touches. See App.tsx's own
// SHOW_ISOMETRIC_PROTOTYPE toggle (default false) for the one-line, fully
// reversible way to preview this on a device; nothing else in the app
// changed to make this exist. See this session's own written report for
// the actual feasibility findings this was built to answer.
//
// Deliberately reuses real, already-shipped assets (TOWNHALL_IMAGES,
// SHOP_IMAGES, BIRD_BASE_SPRITES) rather than placeholder art — the whole
// point of this prototype is to see whether today's top-down-drawn
// illustrations read as acceptable once dropped onto an isometric ground
// plane, not to build new isometric-specific art first.
const TILE: IsoTileSize = { width: 96, height: 48 };
const GRID_SIZE = 3; // a 3x3 test plot, per the request
const ORIGIN_X = 220; // where grid (0,0) lands on screen — centers the diamond in the box below
const ORIGIN_Y = 60;

// A single ground tile, drawn as a rotated+squashed square so it reads as
// an isometric diamond without needing real diamond-shaped tile art yet.
// Alternating tint per (gridX+gridY) parity just makes the grid legible at
// a glance — not meant to look "finished."
function GroundTile({ gridX, gridY }: { gridX: number; gridY: number }) {
  const { x, y } = gridToScreen(gridX, gridY, TILE);
  const parity = (gridX + gridY) % 2 === 0;
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
          backgroundColor: parity ? '#bfe3a8' : '#aed896',
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
}

function IsoSprite({ spec }: { spec: IsoSpriteSpec }) {
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
      <Image source={spec.image} resizeMode="contain" style={styles.spriteImage} />
      <Text style={styles.spriteLabel}>{spec.label}</Text>
    </View>
  );
}

const BIRD_DEPTH_BIAS = 0.01; // ties at equal depth resolve in favor of the moving bird — see isoMath's depthKey comment

export function IsometricPrototypeScreen() {
  // Animates a continuous grid position back and forth along the (0,0)→
  // (2,2) diagonal — deliberately passes *through* the town hall's own
  // (1,1) cell, the classic isometric Y-sort torture test: the bird must
  // render behind the town hall while approaching, then in front of it
  // once past. anim goes 0→1→0 forever; birdGrid is a plain-state mirror
  // (updated via the Animated listener) since depth-sort order has to be
  // decided in JS on each render, not just in a native-driven transform.
  const anim = useRef(new Animated.Value(0)).current;
  const [birdGrid, setBirdGrid] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const id = anim.addListener(({ value }) => {
      setBirdGrid({ x: value * 2, y: value * 2 });
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

  const buildingSprites: IsoSpriteSpec[] = [
    { key: 'townhall', gridX: 1, gridY: 1, depth: depthKey(1, 1), image: TOWNHALL_IMAGES[1], width: 70, height: 70, label: '役場' },
    { key: 'shopA', gridX: 0, gridY: 0, depth: depthKey(0, 0), image: SHOP_IMAGES.general, width: 56, height: 56, label: '道具屋' },
    { key: 'shopB', gridX: 2, gridY: 2, depth: depthKey(2, 2), image: SHOP_IMAGES.feed, width: 56, height: 56, label: '餌屋' },
  ];

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
      <Text style={styles.title}>アイソメトリック検証プロトタイプ</Text>
      <Text style={styles.subtitle}>3×3マス・役場+建物2つ・鳥1羽が対角線上を往復</Text>
      <View style={styles.stage}>
        {groundCells.map((c) => (
          <GroundTile key={`${c.gridX}_${c.gridY}`} gridX={c.gridX} gridY={c.gridY} />
        ))}
        {allSprites.map((s) => (
          <IsoSprite key={s.key} spec={s} />
        ))}
      </View>
      <Text style={styles.note}>鳥が役場の手前/奥どちらに描かれるかで、Yソートの動作を確認できます。</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fdf6e3', paddingTop: 60, alignItems: 'center' },
  title: { fontSize: 16, fontWeight: '800', color: '#5a4632' },
  subtitle: { fontSize: 11, color: '#8a7660', marginTop: 4, textAlign: 'center', paddingHorizontal: 20 },
  stage: { width: 440, height: 320, marginTop: 16 },
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
  note: { fontSize: 11, color: '#8a7660', marginTop: 24, textAlign: 'center', paddingHorizontal: 30 },
});
