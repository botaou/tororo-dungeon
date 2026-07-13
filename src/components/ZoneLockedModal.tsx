import React from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable } from './AnimatedPressable';
import { theme } from '../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
}

// Tapping an unlocked-but-empty plot outside the town's current zone
// ellipse shows this instead of opening ConstructionModal — a real-device
// request to keep the town looking like one cohesive town rather than
// buildings scattered across the whole level-gated 48-plot grid. Land out
// there can still be unlocked ahead of time; it just can't be built on
// until the zone itself grows enough to include it (see getTownLevelDef's
// tiers — each one grows getTownZoneRadius a little further).
export function ZoneLockedModal({ visible, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.emoji}>🚧</Text>
          <Text style={styles.title}>まだ街の外です</Text>
          <Text style={styles.bodyText}>
            この土地は解放済みですが、街エリアがここまで広がるまでは建物を建てられません。街が発展してエリアが広がると建てられるようになります。
          </Text>
          <AnimatedPressable style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>とじる</Text>
          </AnimatedPressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: theme.overlay, justifyContent: 'center', alignItems: 'center', padding: 20 },
  sheet: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: theme.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    padding: 20,
    alignItems: 'center',
  },
  emoji: { fontSize: 40, marginTop: 4 },
  title: { fontSize: 16, fontWeight: '800', color: theme.textPrimary, marginTop: 8 },
  bodyText: { fontSize: 12, color: theme.textSecondary, textAlign: 'center', marginTop: 10, lineHeight: 18 },
  closeButton: {
    marginTop: 16,
    borderRadius: 999,
    paddingHorizontal: 24,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: theme.cardAlt,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    alignSelf: 'stretch',
  },
  closeButtonText: { color: theme.textSecondary, fontWeight: '700', fontSize: 13 },
});
