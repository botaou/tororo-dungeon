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

// mapWrap's own horizontal padding (TownScreen.tsx: paddingHorizontal: 12
// on both sides).
const ESTIMATED_CHROME_WIDTH = 24;
// Generous fixed estimate of everything ABOVE and BELOW mapWrap that isn't
// safe-area inset — topBar (gold pill/icon row), the screen-tab row, and
// the bottom bar (activity log + request button).
const ESTIMATED_CHROME_HEIGHT = 230;

// STABILITY-FIRST ROLLBACK (explicit product decision): this component
// went through nine rounds chasing real-device freezes/blank-screens/
// non-determinism, every single one of them rooted in UIScrollView's pinch-
// zoom machinery (minimumZoomScale/maximumZoomScale clamping, contentOffset
// coordinate-space ambiguity once zoom is involved, gesture-recognizer
// corruption when that machinery interacts with screen switches or
// re-renders) — see this file's git history for the full account. Rather
// than attempt a tenth fix, zoom is removed entirely, reverting to the
// same "fixed real size + pan-only" approach this project used
// successfully before isometric TownMap existed (see README's own history
// around the original PannableMap: "ピンチズームは実機でタップ・ドラッグが
// 起動直後から無反応になる不具合の原因になったため撤去済み"). No
// minimumZoomScale/maximumZoomScale, `pinchGestureEnabled={false}` — the
// zoom-clamp machinery that was the common thread across every failure in
// this saga is removed altogether, not merely reconfigured differently.
//
// Content renders at its native (unscaled) size; the user pans by
// dragging. The initial `contentOffset` here is safe and unambiguous in a
// way none of the zoom-enabled versions ever managed to be: with zoom
// disabled, the ScrollView's zoomScale can never be anything other than 1,
// so there is no "which coordinate space does this apply in" question left
// to get wrong.
//
// Pinch-to-zoom is intentionally NOT reimplemented as a "safer" custom
// gesture in this pass — see README's 拡張候補 (今後の拡張候補) for the
// planned real fix (a react-native-gesture-handler/react-native-reanimated
// driven transform, avoiding UIScrollView's zoom machinery altogether),
// which is deliberately deferred to when the rest of the game is closer to
// feature-complete rather than attempted under time pressure here.
export function PannableMap({ contentWidth, contentHeight, initialFocus, children }: Props) {
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const focusX = initialFocus.x;
  const focusY = initialFocus.y;

  const viewportWidth = Math.max(200, window.width - insets.left - insets.right - ESTIMATED_CHROME_WIDTH);
  const viewportHeight = Math.max(200, window.height - insets.top - insets.bottom - ESTIMATED_CHROME_HEIGHT);

  // Same object every render as long as the underlying numbers haven't
  // actually changed — TownScreen re-renders every game tick, and a fresh
  // object here every time would silently reapply the content size mid-pan
  // (see this file's git history, Round 5, for why that matters even
  // without zoom in the picture).
  const contentContainerStyle = useMemo(() => ({ width: contentWidth, height: contentHeight }), [contentWidth, contentHeight]);

  const contentOffset = useMemo(() => {
    const maxOffsetX = Math.max(0, contentWidth - viewportWidth);
    const maxOffsetY = Math.max(0, contentHeight - viewportHeight);
    const offsetX = Math.min(maxOffsetX, Math.max(0, focusX * contentWidth - viewportWidth / 2));
    const offsetY = Math.min(maxOffsetY, Math.max(0, focusY * contentHeight - viewportHeight / 2));
    return { x: offsetX, y: offsetY };
  }, [viewportWidth, viewportHeight, contentWidth, contentHeight, focusX, focusY]);

  return (
    <View style={styles.viewport}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={contentContainerStyle}
        contentOffset={contentOffset}
        pinchGestureEnabled={false}
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
