import React, { useMemo } from 'react';
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
// the bottom bar (activity log + request button). Deliberately generous
// (i.e. errs toward *underestimating* available height) — see the comment
// below for why erring in that direction is the safe side.
const ESTIMATED_CHROME_HEIGHT = 230;

// Wraps the map in native iOS pinch-zoom-and-pan (UIScrollView's own
// minimumZoomScale/maximumZoomScale/bouncesZoom), rather than a third-party
// gesture library — the app is iOS-only already, and this needs zero new
// native dependencies.
//
// This component has gone through many rewrites chasing real-device
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
// idea entirely and computed contentOffset directly at the one zoomScale
// iOS unambiguously guarantees on a fresh mount (1.0).
//
// Round 5 (DungeonMap froze solid on the first pinch, and the freeze
// PERSISTED even after switching back to TownMap — a fresh mount via
// key={activeScreen}): traced to `contentContainerStyle`/`contentOffset`
// being plain object literals recreated on every render — and TownScreen
// re-renders every game tick — silently reapplying the scroll offset and
// content size roughly once a second, including mid-gesture. Fixed via
// `useMemo`, keyed on primitive values so the object references stay
// stable across those re-renders.
//
// Round 6 (still froze specifically on a screen reached right after
// pinching the *other* one): theorized that tearing down a ScrollView with
// a just-active gesture recognizer and mounting a new one in the very same
// commit could corrupt the native gesture/touch-responder layer. Added a
// brief fully-unmounted gap between screens (see TownScreen.tsx's
// `mapTransitioning`) to give iOS time to release the old recognizer first.
//
// Round 7 (this version — reported as *non-deterministic*: the same
// dungeon<->town sequence sometimes centered correctly and sometimes didn't,
// and the white-screen/freeze symptom came and went across otherwise
// identical attempts): non-determinism that varies run to run on the exact
// same steps is the signature of a genuine timing race, not a one-time
// logic bug — and the remaining race was the viewport *measurement* itself.
// Every version through Round 6 measured the wrapping View's actual
// on-screen size via `onLayout`, gated by either a boolean, a "last
// measured size" comparison, or (most recently) a 50ms "wait for it to stop
// changing" timer. All of those still fundamentally raced against however
// long iOS's own layout pass (safe-area inset resolution in particular)
// happened to take on that specific run — sometimes faster than the wait,
// sometimes slower, hence different results on nominally identical repeats.
// This version removes that race by not measuring the viewport at all:
// `useWindowDimensions()` (the physical screen size) and
// `useSafeAreaInsets()` (from the already-installed react-native-safe-
// area-context) are both synchronous, available on the very first render,
// with no native round-trip to wait for. The wrapping View's own precise
// size is approximated as the window size minus its safe-area insets minus
// a fixed, generously-estimated constant for the surrounding chrome
// (ESTIMATED_CHROME_WIDTH/HEIGHT) — not pixel-perfect, but the same,
// correct-enough number on literally every run, with zero timing
// dependency. The existing FIT_MARGIN slack and `centerContent` already
// tolerate the resulting small imprecision gracefully.
//
// Round 8 (real-device screenshots: DungeonMap rendered as a small patch of
// field stuck flush in the viewport's top-left corner, with the rest blank
// — occasionally scrolled almost entirely off-screen on touch — while
// TownMap kept looking fine): Round 7's `contentOffset` was computed
// assuming the ScrollView's real initial zoomScale is 1.0 ("the one thing
// iOS unambiguously guarantees" — Round 4's words). The screenshots
// contradict that assumption: DungeonMap's canvas (900x1400 — much closer
// in scale to a phone screen than TownMap's 3200x2400) rendered as a patch
// far smaller than 900x1400-at-zoomScale-1 would ever look, sitting at
// (0,0) rather than centered — consistent with the *real* initial zoomScale
// actually being `minimumZoomScale` (i.e. `fitAndOffset.fitScale`, well
// below 1.0), which made the zoomScale-1-shaped `contentOffset` request
// invalid at the view's actual scale and get clamped down to (0,0) instead.
// TownMap's fitScale sits at MINIMUM_ZOOM_FLOOR regardless of this bug (its
// canvas is so much larger that the fit ratio was already below the floor
// before this round), and even scaled down that far its content is still
// wider than the viewport on at least one axis, so the "content ends up
// entirely smaller than the viewport" failure mode this bug depends on
// never actually triggered for it — a coincidence of scale, not evidence
// the zoomScale-1 assumption was ever correct. The fix has two parts:
//  1. `contentOffset` is now computed against `contentWidth * fitScale` /
//     `contentHeight * fitScale` (the coordinate space the view's *actual*
//     starting zoomScale implies) rather than the raw, unscaled content
//     size.
//  2. Even so, the screenshots showed the clamped-to-(0,0) content sitting
//     flush in the corner rather than centered by `centerContent` — which
//     should have centered it, since content-smaller-than-viewport is
//     exactly the case that prop exists for. The likely explanation:
//     explicitly declaring `contentOffset` (even as `{x:0, y:0}`) marks the
//     offset as caller-provided, and iOS's automatic "center content
//     smaller than the viewport" adjustment (implemented as an automatic
//     `contentInset`, a *different* mechanism than `contentOffset`) doesn't
//     get to run — or gets fought — as a result. So `contentOffset` is now
//     entirely omitted (left `undefined`) whenever the scaled content fits
//     within the viewport on *both* axes, deferring completely to
//     `centerContent`'s own native centering in that case; it's only
//     supplied when there's real, meaningful scrolling to position (content
//     bigger than the viewport on at least one axis), where `centerContent`
//     doesn't engage anyway.
// The inner ScrollView still mounts on the very first render with its
// final `contentOffset`/`minimumZoomScale` already known — no waiting for
// a measurement to "settle" before it can exist at all.
export function PannableMap({ contentWidth, contentHeight, initialFocus, children }: Props) {
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const focusX = initialFocus.x;
  const focusY = initialFocus.y;

  const viewportWidth = Math.max(200, window.width - insets.left - insets.right - ESTIMATED_CHROME_WIDTH);
  const viewportHeight = Math.max(200, window.height - insets.top - insets.bottom - ESTIMATED_CHROME_HEIGHT);

  // Same object every render as long as the underlying numbers haven't
  // actually changed — see the Round 5 comment above for why that matters
  // (TownScreen re-renders every game tick; a fresh object here every time
  // would silently reapply the scroll offset/content size mid-gesture).
  const contentContainerStyle = useMemo(() => ({ width: contentWidth, height: contentHeight }), [contentWidth, contentHeight]);

  const fitAndOffset = useMemo(() => {
    // The floor a pinch-out can reach — computed so the *entire* canvas
    // becomes visible at that scale, regardless of aspect ratio, with a
    // little breathing room (FIT_MARGIN) at the edges.
    const fitScale = Math.min(
      1,
      Math.max(MINIMUM_ZOOM_FLOOR, Math.min(viewportWidth / contentWidth, viewportHeight / contentHeight) * FIT_MARGIN)
    );
    // contentOffset is computed against the coordinate space the view's
    // *actual* starting zoomScale implies (see the Round 8 comment above —
    // that's `fitScale`/`minimumZoomScale`, not the unscaled content size).
    const scaledWidth = contentWidth * fitScale;
    const scaledHeight = contentHeight * fitScale;
    const maxOffsetX = Math.max(0, scaledWidth - viewportWidth);
    const maxOffsetY = Math.max(0, scaledHeight - viewportHeight);
    if (maxOffsetX === 0 && maxOffsetY === 0) {
      // Scaled content fits entirely within the viewport on both axes —
      // omit contentOffset and let `centerContent` center it natively (see
      // the Round 8 comment above for why supplying an explicit offset here,
      // even (0,0), was observed to suppress that centering on-device).
      return { fitScale, contentOffset: undefined as { x: number; y: number } | undefined };
    }
    const offsetX = Math.min(maxOffsetX, Math.max(0, focusX * scaledWidth - viewportWidth / 2));
    const offsetY = Math.min(maxOffsetY, Math.max(0, focusY * scaledHeight - viewportHeight / 2));
    return { fitScale, contentOffset: { x: offsetX, y: offsetY } };
  }, [viewportWidth, viewportHeight, contentWidth, contentHeight, focusX, focusY]);

  return (
    <View style={styles.viewport}>
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
