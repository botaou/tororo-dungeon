import React, { useCallback, useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, ScrollView, StyleSheet, View } from 'react-native';

import { theme } from '../theme';

interface Props {
  contentWidth: number;
  contentHeight: number;
  // Normalized (0..1) point to center in the viewport the first time it
  // lays out — e.g. the town hall's own (TOWN_X, TOWN_Y).
  initialFocus: { x: number; y: number };
  children: React.ReactNode;
}

const MAXIMUM_ZOOM_SCALE = 2.2;
const MINIMUM_ZOOM_FLOOR = 0.15;
// Small breathing room so "zoomed all the way out" doesn't crop flush with
// the map's own edges.
const FIT_MARGIN = 0.92;

// Wraps the map in native iOS pinch-zoom-and-pan (UIScrollView's own
// minimumZoomScale/maximumZoomScale/bouncesZoom), rather than a third-party
// gesture library — the app is iOS-only already, and this needs zero new
// native dependencies.
//
// This component has gone through several rewrites chasing real-device
// display bugs, each one narrowing in on the actual root cause:
//
// Round 1 (freeze on dungeon<->town switch): an earlier version let ONE
// long-lived PannableMap/ScrollView instance re-fit itself imperatively
// (setMinZoom + scrollTo) whenever contentWidth/contentHeight changed
// underneath it on a tab switch (TownMap and DungeonMap use different-sized
// canvases — see WorldMap.tsx's TOWN_ISO_CANVAS_WIDTH/HEIGHT comment).
// Changing `minimumZoomScale` on a UIScrollView already sitting at some
// other native zoomScale made iOS's own zoom-clamping race against our
// imperative `scrollTo` call in the same frame, leaving the view unable to
// forward further gestures at all. Fixed in TownScreen.tsx by giving
// `<PannableMap key={activeScreen} .../>` a key, forcing a full unmount and
// fresh native ScrollView on every tab switch instead of resizing a live one.
//
// Round 2 (stuck top-left / pinch makes content disappear): the one-shot
// centering logic was gated by a plain boolean ref, but RN's onLayout can
// fire more than once while a fresh mount's layout settles (SafeAreaView's
// inset adjustment is a common cause on iOS) — the FIRST firing isn't
// always the real final size. That first (possibly transient/undersized)
// firing consumed the one-shot scrollTo with the wrong numbers, and nothing
// ever re-ran it. Attempted fix: track the last *measured* size and re-run
// whenever a new onLayout reported a different one.
//
// Round 3 (this version — still misaligned after round 2, and a new "goes
// completely blank" symptom after dungeon->town, worse on TownMap's much
// bigger canvas): round 2's fix addressed *when* the centering math ran,
// but not whether the math itself was correct. It called
// `scrollRef.current?.scrollTo({x, y})` using x/y computed directly from
// raw contentWidth/contentHeight (i.e. contentWidth * initialFocus.x, as if
// the view were already shrunk to the fit zoom level) — but on iOS, setting
// `minimumZoomScale` alone does NOT make a UIScrollView start out actually
// zoomed to that level; the real initial zoomScale is 1.0 regardless.
// `contentOffset`/`scrollTo` coordinates are interpreted in the *currently
// zoomed* coordinate space (the standard "center a zoomed UIScrollView"
// recipe multiplies the target content point by the current zoomScale), so
// at the real initial zoomScale of 1.0 our old numbers pointed at
// completely the wrong spot — the bigger the canvas relative to the target
// zoom level, the further off, up to landing somewhere with nothing drawn
// at all (a plain background — the reported "white screen" on TownMap's
// 3200x2400 canvas, where DungeonMap's much smaller 900x1400 canvas only
// showed a smaller, still-wrong offset).
//
// The fix, and the reason this version looks structurally different:
//  1. Never call scrollTo/setNativeProps imperatively at all. The inner
//     ScrollView isn't created until the viewport size is known (see
//     `viewport` state below), so its correct initial zoom/scroll position
//     can be baked in as genuine mount-time props (`contentOffset`,
//     `minimumZoomScale`) instead of being patched in after the fact.
//  2. To actually START zoomed out to fitScale (not 1.0), temporarily pin
//     `maximumZoomScale` to the same value as `minimumZoomScale` for the
//     very first render. Since the default zoomScale (1.0) is now *outside*
//     that single-point [fitScale, fitScale] range, iOS clamps the initial
//     zoomScale down to fitScale before the first frame is ever shown.
//     `zoomCeilingReleased` widens `maximumZoomScale` back out to the real
//     maximum one tick later so pinch-in still works — raising a ceiling
//     never forces a jump, only lowering one would, so this is safe.
//  3. `contentOffset` is computed by multiplying the target content point
//     by fitScale (matching what zoomScale will actually be at mount), not
//     by the raw content size.
//  4. A short (50ms) settle delay after the first onLayout, re-armed on
//     every subsequent call, before committing to a `viewport` size at all
//     — so a transient first firing (round 2's failure mode) gets
//     overwritten by the real one instead of being permanently baked in.
export function PannableMap({ contentWidth, contentHeight, initialFocus, children }: Props) {
  // The measured size of this component's own on-screen box, committed once
  // per mount. The inner ScrollView doesn't render at all until this is
  // known — see the comment block above for why that matters.
  const [viewport, setViewport] = useState<{ width: number; height: number } | null>(null);
  const pendingSizeRef = useRef<{ width: number; height: number } | null>(null);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => {
      if (viewport) return; // already committed for this mount
      const { width, height } = e.nativeEvent.layout;
      if (width <= 0 || height <= 0) return;
      pendingSizeRef.current = { width, height };
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
      settleTimerRef.current = setTimeout(() => setViewport(pendingSizeRef.current), 50);
    },
    [viewport]
  );

  useEffect(() => {
    return () => {
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    };
  }, []);

  const fitScale = viewport
    ? Math.min(
        1,
        Math.max(MINIMUM_ZOOM_FLOOR, Math.min(viewport.width / contentWidth, viewport.height / contentHeight) * FIT_MARGIN)
      )
    : MINIMUM_ZOOM_FLOOR;

  const [zoomCeilingReleased, setZoomCeilingReleased] = useState(false);
  useEffect(() => {
    if (!viewport || zoomCeilingReleased) return;
    const id = requestAnimationFrame(() => setZoomCeilingReleased(true));
    return () => cancelAnimationFrame(id);
  }, [viewport, zoomCeilingReleased]);

  return (
    <View style={styles.viewport} onLayout={handleLayout}>
      {viewport &&
        (() => {
          const scaledWidth = contentWidth * fitScale;
          const scaledHeight = contentHeight * fitScale;
          const maxOffsetX = Math.max(0, scaledWidth - viewport.width);
          const maxOffsetY = Math.max(0, scaledHeight - viewport.height);
          const offsetX = Math.min(maxOffsetX, Math.max(0, initialFocus.x * scaledWidth - viewport.width / 2));
          const offsetY = Math.min(maxOffsetY, Math.max(0, initialFocus.y * scaledHeight - viewport.height / 2));
          return (
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={{ width: contentWidth, height: contentHeight }}
              contentOffset={{ x: offsetX, y: offsetY }}
              minimumZoomScale={fitScale}
              maximumZoomScale={zoomCeilingReleased ? MAXIMUM_ZOOM_SCALE : fitScale}
              bouncesZoom
              centerContent
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>
          );
        })()}
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: theme.cardBorder,
    overflow: 'hidden',
  },
  scroll: { flex: 1 },
});
