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

// Wraps the map in native iOS pinch-zoom-and-pan (UIScrollView's own
// minimumZoomScale/maximumZoomScale/bouncesZoom), rather than a third-party
// gesture library — the app is iOS-only already, and this needs zero new
// native dependencies. minimumZoomScale is computed from the actual
// viewport size so "zoomed all the way out" always shows the whole map;
// the first layout pass scrolls to center initialFocus (the town hall)
// without animating.
//
// This was pulled out once already after a real-device report of every tap
// and drag going dead from the first frame — but that turned out to be an
// unrelated bug (TownScreen was replaying a backlog of already-seen
// "town leveled up!" popups on every launch, which blocked the map
// underneath; see TownScreen.tsx's shownLevelUpCount). With that fixed and
// confirmed on-device, zoom is back.
export function PannableMap({ contentWidth, contentHeight, initialFocus, children }: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const [minZoom, setMinZoom] = useState(0.4);
  const hasCenteredRef = useRef(false);
  // Last known viewport size (from onLayout) — kept around so the re-fit
  // effect below can recompute minZoom/scroll position without waiting for
  // another layout pass (the viewport's own size on screen doesn't change
  // when contentWidth/contentHeight do; only the content inside it does).
  const viewportSizeRef = useRef<{ width: number; height: number } | null>(null);

  const fit = useCallback(
    (width: number, height: number) => {
      // A little slack so "zoomed all the way out" still leaves a sliver of
      // breathing room at the map's own edges instead of cropping flush.
      const fitScale = Math.min(width / contentWidth, height / contentHeight) * 0.92;
      setMinZoom(Math.min(1, Math.max(0.15, fitScale)));
      const x = Math.max(0, initialFocus.x * contentWidth - width / 2);
      const y = Math.max(0, initialFocus.y * contentHeight - height / 2);
      // No animation — this is a framing reset (initial mount, or a content-
      // size change — see the effect below), not a user-triggered jump.
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ x, y, animated: false }));
    },
    [contentWidth, contentHeight, initialFocus.x, initialFocus.y]
  );

  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const { width, height } = e.nativeEvent.layout;
      if (width <= 0 || height <= 0) return;
      viewportSizeRef.current = { width, height };
      if (!hasCenteredRef.current) {
        hasCenteredRef.current = true;
        fit(width, height);
      }
    },
    [fit]
  );

  // TownScreen hands TownMap and DungeonMap each their own contentWidth/
  // contentHeight (they no longer share one fixed canvas — see WorldMap.tsx's
  // TOWN_ISO_CANVAS_WIDTH/HEIGHT bug-fix comment), and both screens sit
  // under the same mounted PannableMap. Without this, switching tabs would
  // leave the old screen's scroll offset/zoom applied to the new screen's
  // differently-sized content — e.g. scrolled to a spot that's off in blank
  // space, or zoomed to a scale that no longer fits. Re-running the exact
  // same fit the initial layout does, whenever the content size itself
  // actually changes, keeps every tab switch framed exactly like a fresh
  // mount would be. Skipped before the first layout (viewportSizeRef is
  // still null) — handleLayout's own initial fit covers that case.
  useEffect(() => {
    if (viewportSizeRef.current) fit(viewportSizeRef.current.width, viewportSizeRef.current.height);
  }, [contentWidth, contentHeight, fit]);

  return (
    <View style={styles.viewport} onLayout={handleLayout}>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={{ width: contentWidth, height: contentHeight }}
        minimumZoomScale={minZoom}
        maximumZoomScale={2.2}
        bouncesZoom
        centerContent
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
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
