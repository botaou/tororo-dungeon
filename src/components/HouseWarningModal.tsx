import React from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';

import { BirdHouseEvent } from '../types';
import { AnimatedPressable } from './AnimatedPressable';
import { theme } from '../theme';

interface Props {
  event: BirdHouseEvent | null;
  onGift: (defId: string) => void;
  onClose: () => void;
}

// Phase 14: fires once a houseless bird's sulking has gone on long enough
// that it risks leaving town (see config.ts's HOUSELESS_WARNING_MS) —
// same queued-event pattern as TownLevelUpModal/RecruitmentModal. "プレゼント
// を渡す" hands off to GiftBirdModal (see TownScreen, which closes this one
// first rather than stacking two Modals at once).
export function HouseWarningModal({ event, onGift, onClose }: Props) {
  if (event === null) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.emoji}>⚠️</Text>
          <Text style={styles.title}>{event.name}のようすが心配です</Text>
          <Text style={styles.body}>
            ずっと家がないまま拗ねてしまっていて、このままだと街を出ていってしまうかもしれません。プレゼントを渡して、ご機嫌を直してあげましょう。
          </Text>
          <AnimatedPressable style={styles.giftButton} onPress={() => onGift(event.defId)}>
            <Text style={styles.giftButtonText}>🎁 プレゼントを渡す</Text>
          </AnimatedPressable>
          <AnimatedPressable style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>あとで</Text>
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
    maxWidth: 340,
    backgroundColor: theme.card,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: theme.gold,
    padding: 20,
    alignItems: 'center',
  },
  emoji: { fontSize: 44 },
  title: { fontSize: 17, fontWeight: '800', color: theme.textPrimary, marginTop: 8, textAlign: 'center' },
  body: { fontSize: 12, color: theme.textSecondary, marginTop: 10, textAlign: 'center', lineHeight: 18 },
  giftButton: {
    marginTop: 18,
    borderRadius: 999,
    paddingHorizontal: 24,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: theme.gold,
  },
  giftButtonText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  closeButton: { marginTop: 10, paddingHorizontal: 16, paddingVertical: 8 },
  closeButtonText: { fontSize: 12, fontWeight: '700', color: theme.textSecondary },
});
