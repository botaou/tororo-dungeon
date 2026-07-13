import React from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';

import { getTownLevelDef } from '../data/townGrid';
import { AnimatedPressable } from './AnimatedPressable';
import { theme } from '../theme';

interface Props {
  level: number | null;
  onClose: () => void;
}

// Announces each town-tier advancement — same queued-events pattern as
// RecruitmentModal (see TownScreen, which queues off useTownStore's
// levelUpEvents), just showing the new TownLevelDef instead of a character.
export function TownLevelUpModal({ level, onClose }: Props) {
  if (level === null) return null;
  const def = getTownLevelDef(level);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>🎊 街が発展した!</Text>
          <Text style={styles.emoji}>{def.emoji}</Text>
          <Text style={styles.name}>{def.name}</Text>
          <Text style={styles.reasonText}>発展ポイントが{def.threshold}に到達しました</Text>
          <AnimatedPressable style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>やった!</Text>
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
  title: { fontSize: 18, fontWeight: '800', color: theme.gold, marginBottom: 12 },
  emoji: { fontSize: 56, marginTop: 4 },
  name: { fontSize: 20, fontWeight: '800', color: theme.textPrimary, marginTop: 10 },
  reasonText: { fontSize: 12, color: theme.textSecondary, marginTop: 6 },
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
