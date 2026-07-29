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
// always the real final size. Attempted fix: track the last *measured* size
// and re-run whenever a new onLayout reported a different one.
//
// Round 3 (still misaligned, plus a "goes completely blank" symptom worse
// on TownMap's much bigger canvas): switched to a design that temporarily
// pinned `maximumZoomScale` to `minimumZoomScale` on first render, on the
// theory that iOS would clamp the default zoomScale (1.0) down into that
// single-point range immediately, then released the ceiling a tick later.
//
// Round 4 (this version — round 3 worked for TownMap but left DungeonMap
// stuck showing only a sliver in one corner, totally unresponsive to pan or
// zoom): the round-3 "pin min=max to force an alternate initial zoomScale"
// trick relies on undocumented iOS clamping behavior that isn't guaranteed
// to fire consistently — apparently it did for one canvas's dimensions but
// not the other. Chasing further variations of that trick isn't a sound
// foundation. This version drops the idea of forcing any zoomScale other
// than what iOS *actually*, unambiguously guarantees: a fresh ScrollView
// always starts at zoomScale exactly 1.0 — full documented, standard
// behavior, true for every mount regardless of content size or aspect
// ratio. So instead of fighting to start "zoomed out to fit," this version
// starts at real (1.0) resolution, centered on `initialFocus` — computed
// directly in that same zoomScale-1 coordinate space, with zero ambiguity
// about what scale is actually in effect. `minimumZoomScale` is still set
// to the fit-to-see-everything level, so pinching out still reaches a full
// overview — it just isn't the view you land on immediately. Given three
// rounds of instability chasing the alternative, trading a small UX cost
// (no auto zoomed-out overview on first open) for guaranteed-correct
// centering on both canvases is the right call.
//
// The inner ScrollView still isn't created until the viewport size is
// known (see `viewport` state below) — its correct initial `contentOffset`
// is baked in as a genuine mount-time prop instead of patched in
// imperatively after the fact — and a short (50ms) settle delay after the
// first onLayout, re-armed on every subsequent call, guards against a
// transient/undersized first firing (round 2's failure mode) getting
// permanently baked in.
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

  return (
    <View style={styles.viewport} onLayout={handleLayout}>
      {viewport &&
        (() => {
          // The floor a pinch-out can reach — computed so the *entire*
          // canvas becomes visible at that scale, regardless of aspect
          // ratio, with a little breathing room (FIT_MARGIN) at the edges.
          const fitScale = Math.min(
            1,
            Math.max(MINIMUM_ZOOM_FLOOR, Math.min(viewport.width / contentWidth, viewport.height / contentHeight) * FIT_MARGIN)
          );
          // contentOffset is computed for the ScrollView's real, guaranteed
          // initial zoomScale (1.0) — plain content-space coordinates, no
          // scale multiplication needed since zoomScale is documented to
          // always start at exactly 1.
          const maxOffsetX = Math.max(0, contentWidth - viewport.width);
          const maxOffsetY = Math.max(0, contentHeight - viewport.height);
          const offsetX = Math.min(maxOffsetX, Math.max(0, initialFocus.x * contentWidth - viewport.width / 2));
          const offsetY = Math.min(maxOffsetY, Math.max(0, initialFocus.y * contentHeight - viewport.height / 2));
          return (
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={{ width: contentWidth, height: contentHeight }}
              contentOffset={{ x: offsetX, y: offsetY }}
              minimumZoomScale={fitScale}
              maximumZoomScale={MAXIMUM_ZOOM_SCALE}
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
