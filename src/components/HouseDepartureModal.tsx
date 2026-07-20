import React from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';

import { BirdHouseEvent } from '../types';
import { AnimatedPressable } from './AnimatedPressable';
import { theme } from '../theme';

interface Props {
  event: BirdHouseEvent | null;
  onClose: () => void;
}

// Phase 14: fires once if a HouseWarningModal's warning went unanswered long
// enough (see config.ts's HOUSELESS_LEAVE_TICKS) — the bird has left town
// (isRecruited flipped back to false, see useWorldStore's tick). Framed
// gently ("旅立った", not anything heavier) per this project's own wording
// policy for negative outcomes (see the HP-0 retreat line precedent).
export function HouseDepartureModal({ event, onClose }: Props) {
  if (event === null) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.emoji}>🎒</Text>
          <Text style={styles.title}>{event.name}が旅立ってしまいました</Text>
          <Text style={styles.body}>ずっと家がなくて寂しかったみたい。またいつか、この街に戻ってきてくれるかもしれません。</Text>
          <AnimatedPressable style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>わかった</Text>
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
    borderColor: theme.cardBorder,
    padding: 20,
    alignItems: 'center',
  },
  emoji: { fontSize: 44 },
  title: { fontSize: 17, fontWeight: '800', color: theme.textPrimary, marginTop: 8, textAlign: 'center' },
  body: { fontSize: 12, color: theme.textSecondary, marginTop: 10, textAlign: 'center', lineHeight: 18 },
  closeButton: {
    marginTop: 18,
    borderRadius: 999,
    paddingHorizontal: 24,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: theme.gold,
  },
  closeButtonText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
