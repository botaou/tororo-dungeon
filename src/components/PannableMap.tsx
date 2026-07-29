import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
// underneath it on a tab switch. Fixed via `<PannableMap key={activeScreen}
// .../>` in TownScreen.tsx, forcing a full unmount/fresh mount per screen.
//
// Round 2 (stuck top-left / pinch makes content disappear): the one-shot
// centering logic was gated by a plain boolean ref, but RN's onLayout can
// fire more than once while a fresh mount's layout settles, and the FIRST
// firing isn't always the real final size.
//
// Round 3 (still misaligned, plus a "goes completely blank" symptom worse
// on TownMap's much bigger canvas): tried to force an alternate initial
// zoomScale by temporarily pinning maximumZoomScale to minimumZoomScale.
//
// Round 4 (that trick worked for TownMap but left DungeonMap stuck showing
// only a sliver, unresponsive to pan or zoom): dropped the zoomScale-forcing
// idea entirely — it relied on undocumented iOS clamping behavior that
// didn't fire consistently across both canvases. Switched to only relying
// on the one thing iOS unambiguously guarantees (fresh zoomScale = 1.0) and
// computing contentOffset directly in that coordinate space.
//
// Round 5 (this version — DungeonMap froze solid on the very first pinch,
// and critically the freeze then PERSISTED even after switching back to
// TownMap, which remounts PannableMap entirely via key={activeScreen}): a
// persisting-across-remount freeze meant the bug couldn't be purely inside
// this component's own JS state (a fresh mount has fresh state, full stop)
// — it had to be corrupting something at the native gesture-recognizer
// level itself, in a way that survives the JS-side view being torn down.
// The culprit: `contentContainerStyle={{ width, height }}` and
// `contentOffset={{ x, y }}` below were plain object literals created fresh
// on *every render* of this component — and TownScreen re-renders on every
// single game tick (it subscribes to the whole `world` store, which
// changes as birds move, roughly once a second). Each of those re-renders
// handed the ScrollView a brand-new object for both props; React's
// reconciler treats a new object reference as "this prop changed" and
// forwards it to the native module again, meaning the content container's
// declared size and the scroll offset were both being silently reapplied
// about once a second — including in the middle of an active pinch
// gesture. Resizing/repositioning a UIScrollView's content while a pinch
// gesture recognizer is mid-transform is exactly the kind of collision
// that corrupted the view in Round 1 (there, it only happened once, on a
// tab switch; here it was happening continuously). The fix: `contentOffset`
// and `contentContainerStyle` are now computed via `useMemo`, keyed only on
// their true inputs (viewport size, contentWidth/contentHeight, the
// *primitive* focus x/y rather than the `initialFocus` object's identity)
// — so they keep the exact same object reference across the once-a-second
// re-renders the game loop causes, and only actually change if the
// underlying numbers do (which, after the initial mount, they don't).
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

  // Depending on the primitive x/y (not the `initialFocus` object itself)
  // means a caller passing a fresh `{x, y}` literal every render (as
  // TownScreen does) doesn't defeat this memoization.
  const focusX = initialFocus.x;
  const focusY = initialFocus.y;

  // Same object every render as long as contentWidth/contentHeight haven't
  // actually changed — see the Round 5 comment above for why that matters.
  const contentContainerStyle = useMemo(() => ({ width: contentWidth, height: contentHeight }), [contentWidth, contentHeight]);

  const fitAndOffset = useMemo(() => {
    if (!viewport) return null;
    // The floor a pinch-out can reach — computed so the *entire* canvas
    // becomes visible at that scale, regardless of aspect ratio, with a
    // little breathing room (FIT_MARGIN) at the edges.
    const fitScale = Math.min(
      1,
      Math.max(MINIMUM_ZOOM_FLOOR, Math.min(viewport.width / contentWidth, viewport.height / contentHeight) * FIT_MARGIN)
    );
    // contentOffset is computed for the ScrollView's real, guaranteed
    // initial zoomScale (1.0) — plain content-space coordinates, no scale
    // multiplication needed since zoomScale is documented to always start
    // at exactly 1.
    const maxOffsetX = Math.max(0, contentWidth - viewport.width);
    const maxOffsetY = Math.max(0, contentHeight - viewport.height);
    const offsetX = Math.min(maxOffsetX, Math.max(0, focusX * contentWidth - viewport.width / 2));
    const offsetY = Math.min(maxOffsetY, Math.max(0, focusY * contentHeight - viewport.height / 2));
    return { fitScale, contentOffset: { x: offsetX, y: offsetY } };
  }, [viewport, contentWidth, contentHeight, focusX, focusY]);

  return (
    <View style={styles.viewport} onLayout={handleLayout}>
      {viewport && fitAndOffset && (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={contentContainerStyle}
          contentOffset={fitAndOffset.contentOffset}
          minimumZoomScale={fitAndOffset.fitScale}
          maximumZoomScale={MAXIMUM_ZOOM_SCALE}
          bouncesZoom
          centerContent
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      )}
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
