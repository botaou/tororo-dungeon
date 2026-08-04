import React, { useCallback, useMemo, useRef } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
// mapWrap's own horizontal padding (TownScreen.tsx: paddingHorizontal: 12
// on both sides).
const ESTIMATED_CHROME_WIDTH = 24;
// Generous fixed estimate of everything ABOVE and BELOW mapWrap that isn't
// safe-area inset — topBar (gold pill/icon row), the screen-tab row, and
// the bottom bar (activity log + request button).
const ESTIMATED_CHROME_HEIGHT = 230;

// Wraps the map in native iOS pinch-zoom-and-pan (UIScrollView's own
// minimumZoomScale/maximumZoomScale/bouncesZoom), rather than a third-party
// gesture library — the app is iOS-only already, and this needs zero new
// native dependencies.
//
// This component has gone through many rewrites chasing real-device
// display bugs. Rounds 1-6 (freeze on screen switch, stuck-top-left,
// non-deterministic centering, gesture recognizer corruption from
// mid-gesture prop churn) are covered in this file's git history and in the
// README — each narrowed the problem down further, but rounds 4/7/8 in
// particular kept getting stuck on the same fundamental question: *what
// coordinate space is `contentOffset` actually interpreted in* (raw content
// size, or content size scaled by whatever the view's real starting
// zoomScale turns out to be)? Round 7 assumed zoomScale=1 (documented as
// the default). Round 8's real-device screenshots contradicted that for
// DungeonMap specifically, so it switched to assuming zoomScale=fitScale
// instead, plus omitting `contentOffset` entirely when centerContent alone
// should suffice. Real-device testing after that round showed the result
// was still inconsistent — sometimes correctly centered, sometimes a small
// stuck-in-a-corner patch, sometimes fully blank — across nominally
// identical dungeon<->town switches. Four different theories about
// `contentOffset`'s coordinate space, three different partial fixes, and
// still no reliably correct behavior is a sign the problem was the
// approach, not the theory.
//
// Round 9 (this version): stop trying to guess `contentOffset` at all.
// `ScrollView.scrollResponderZoomTo(rect)` is a real, public, iOS-only
// method on RN's ScrollView (documented in ScrollView.d.ts) whose entire
// purpose is "make this rect — in the content's own, unscaled coordinate
// space, no ambiguity — fully visible," computing the correct zoomScale
// *and* offset together, atomically, natively. Passing the full content
// rect (0, 0, contentWidth, contentHeight) is exactly "zoom out to fit the
// whole map, centered" — our actual goal all along — without this
// component ever having to know or guess what zoomScale ends up in effect.
// It's called exactly once per mount, the moment the content is confirmed
// ready: `onContentSizeChange` fires when the ScrollView's native content
// view has actually settled at its declared size, a genuine readiness
// signal rather than a guessed delay or an assumption about initial state.
// This is different from Round 1's freeze (an imperative call racing a
// `minimumZoomScale` *prop change* on a ScrollView the user had already
// zoomed/panned) — this fires once, on a brand-new, never-yet-touched
// ScrollView (key={activeScreen} in TownScreen.tsx still guarantees a
// fresh native view per screen, and `mapTransitioning` there still gives
// the previous screen's gesture recognizer time to fully tear down first).
// `initialFocus` is currently unused: `scrollResponderZoomTo` always
// targets the full content rect, which is already centered on both
// screens' actual focus point (TOWN_X/TOWN_Y = 0.5, 0.5 by construction —
// see WorldMap.tsx's TOWN_ISO_ORIGIN comment) since "fit the whole canvas"
// and "center on the focus point" are the same operation here. Kept in the
// props contract in case a future caller ever needs an off-center initial
// view.
export function PannableMap({ contentWidth, contentHeight, children }: Props) {
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const hasZoomedRef = useRef(false);

  const viewportWidth = Math.max(200, window.width - insets.left - insets.right - ESTIMATED_CHROME_WIDTH);
  const viewportHeight = Math.max(200, window.height - insets.top - insets.bottom - ESTIMATED_CHROME_HEIGHT);

  // The floor a pinch-out can reach (and the ceiling a pinch-in can't pass
  // going the other way isn't affected) — computed so the *entire* canvas
  // could become visible at that scale, regardless of aspect ratio, with a
  // little breathing room (FIT_MARGIN) at the edges. `scrollResponderZoomTo`
  // below picks the actual starting zoom itself; this is only the pinch
  // bound.
  const fitScale = Math.min(
    1,
    Math.max(MINIMUM_ZOOM_FLOOR, Math.min(viewportWidth / contentWidth, viewportHeight / contentHeight) * FIT_MARGIN)
  );

  // Same object every render as long as the underlying numbers haven't
  // actually changed — TownScreen re-renders every game tick, and a fresh
  // object here every time would silently reapply the content size
  // mid-gesture (see this file's git history, Round 5).
  const contentContainerStyle = useMemo(() => ({ width: contentWidth, height: contentHeight }), [contentWidth, contentHeight]);

  const handleContentSizeChange = useCallback(() => {
    if (hasZoomedRef.current) return;
    hasZoomedRef.current = true;
    scrollRef.current?.scrollResponderZoomTo({ x: 0, y: 0, width: contentWidth, height: contentHeight, animated: false });
  }, [contentWidth, contentHeight]);

  return (
    <View style={styles.viewport}>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={contentContainerStyle}
        onContentSizeChange={handleContentSizeChange}
        minimumZoomScale={fitScale}
        maximumZoomScale={MAXIMUM_ZOOM_SCALE}
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
