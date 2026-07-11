import React, { useCallback, useRef } from 'react';
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

// Wraps the map in a plain, pan-only ScrollView — both axes scroll because
// contentContainerStyle is given the map's real (larger-than-viewport) size
// explicitly, which is enough for 2D dragging without the `horizontal` prop.
//
// This used to also offer pinch-zoom via the ScrollView's own
// minimumZoomScale/maximumZoomScale (an iOS-only, zero-extra-dependency
// UIScrollView feature — see git history). It had to come back out: on a
// real device, every tap on the map (birds, buildings, the town hall) and
// even plain dragging stopped responding, from the very first frame, the
// moment zoom was enabled. Two likely contributors, either of which would
// explain a same-device regression that a background-rendering fix (see
// WorldMap.tsx's TiledBackground) did not touch: (1) a zoomable
// UIScrollView on iOS is known to sometimes swallow touches meant for
// nested Pressable/TouchableWithoutFeedback children before they can
// register at all, and (2) this component used to update
// `minimumZoomScale` from state right after the first layout pass —
// mutating a zoom-affecting prop on an already-mounted native scroll view
// can leave its gesture recognizers stuck. Since basic tap-and-drag is the
// actual must-have and pinch-zoom was the nice-to-have, zoom is dropped for
// now; reintroducing it should go through a purpose-built gesture library
// (e.g. react-native-gesture-handler's PinchGestureHandler) rather than
// ScrollView's own zoom, which appears not to coexist safely with nested
// touchables here.
export function PannableMap({ contentWidth, contentHeight, initialFocus, children }: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const hasCenteredRef = useRef(false);

  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const { width, height } = e.nativeEvent.layout;
      if (width <= 0 || height <= 0 || hasCenteredRef.current) return;
      hasCenteredRef.current = true;
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
