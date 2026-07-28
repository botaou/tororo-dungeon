import React, { useCallback, useRef, useState } from 'react';
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
//
// Real-device report #2: TownMap and DungeonMap now use differently-sized
// canvases (see WorldMap.tsx's TOWN_ISO_CANVAS_WIDTH/HEIGHT bug-fix
// comment), and an earlier fix here tried to let ONE long-lived PannableMap
// instance re-fit/re-center itself imperatively (setMinZoom + scrollTo)
// whenever contentWidth/contentHeight changed underneath it on a tab
// switch. That froze the map solid after switching dungeon->town: changing
// `minimumZoomScale` on a UIScrollView that's already sitting at some other
// native zoomScale (left over from whichever screen was showing a moment
// ago) makes iOS's own zoom-clamping kick in on the native side, at the
// same moment our own imperative `scrollTo` call was trying to move the
// content — two different things fighting over the same native scroll/zoom
// transform in the same frame, and the view lands in a state that no
// longer forwards further gestures at all. The fix is to not persist the
// underlying ScrollView across a canvas-size change in the first place —
// see TownScreen.tsx's own `key={activeScreen}` on this component. A fresh
// mount gets a fresh native UIScrollView (zoomScale starts valid for
// whatever minimumZoomScale this mount declares) and hits the exact same
// "first layout" framing code path below that already worked correctly.
// The only UX cost is that pan/zoom position no longer survives a tab
// switch — but since a "spot" in the old shared canvas doesn't correspond
// to the same spot in either screen's own new canvas anymore anyway, there
// was no meaningful position to preserve, so resetting to a clean centered
// view on every switch is strictly better than the alternative (frozen).
export function PannableMap({ contentWidth, contentHeight, initialFocus, children }: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const [minZoom, setMinZoom] = useState(0.4);
  // The last *measured viewport* size (not contentWidth/contentHeight —
  // this is onLayout's own width/height, i.e. how big this component
  // actually is on screen) we ran the fit/centering calculation for.
  //
  // Real-device report: switching to DungeonMap left it stuck in the
  // top-left corner with most of the screen blank, and pinch-zooming made
  // its content disappear entirely. Root cause: the previous version only
  // ever ran the one-shot centering scrollTo the *first* time onLayout
  // fired at all (gated by a plain boolean ref) — but RN's layout pass can
  // legitimately fire onLayout more than once while it settles, and the
  // very first call can report a transient, too-small size (mid-reflow)
  // rather than the real final viewport. That first (wrong) call still
  // passed the `width/height > 0` guard, so it both (a) computed a bogus
  // minZoom from the tiny size and (b) consumed the one-shot centering
  // scrollTo using that same bogus size — landing the scroll position near
  // (0,0) permanently, since the boolean gate meant the *next*, correctly-
  // sized onLayout call never got to re-run the recenter. This was a
  // latent risk even before Step C, but `key={activeScreen}` (see
  // TownScreen.tsx) makes PannableMap remount on every tab switch instead
  // of just once at app launch, giving this transient-first-layout race
  // far more chances to actually fire. The fix: track the last *measured*
  // size and only skip re-running the fit/centering calculation when a new
  // onLayout call reports the exact same size as before — a genuinely
  // different size (whether the true settle after a bogus first call, or
  // an actual rotation) always gets a fresh, correct recenter.
  const lastMeasuredSizeRef = useRef<{ width: number; height: number } | null>(null);

  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const { width, height } = e.nativeEvent.layout;
      if (width <= 0 || height <= 0) return;
      const last = lastMeasuredSizeRef.current;
      if (last && last.width === width && last.height === height) return; // no real change — don't fight the user's own pan/zoom
      lastMeasuredSizeRef.current = { width, height };

      // A little slack so "zoomed all the way out" still leaves a sliver of
      // breathing room at the map's own edges instead of cropping flush.
      const fitScale = Math.min(width / contentWidth, height / contentHeight) * 0.92;
      setMinZoom(Math.min(1, Math.max(0.15, fitScale)));

      const x = Math.max(0, initialFocus.x * contentWidth - width / 2);
      const y = Math.max(0, initialFocus.y * contentHeight - height / 2);
      // No animation — this is the initial framing, not a user-triggered jump.
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ x, y, animated: false }));
    },
    [contentWidth, contentHeight, initialFocus.x, initialFocus.y]
  );

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
