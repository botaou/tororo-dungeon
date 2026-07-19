import React from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';

import { getTownLevelDef } from '../data/townGrid';
import { TownLevelUpEvent } from '../store/useTownStore';
import { AnimatedPressable } from './AnimatedPressable';
import { theme } from '../theme';

interface Props {
  event: TownLevelUpEvent | null;
  onClose: () => void;
}

// Announces each town-development-quest clear — same queued-events pattern
// as RecruitmentModal (see TownScreen, which queues off useTownStore's
// levelUpEvents). Phase 12②: now shows which quest triggered it and what
// specifically that unlocked (event.questName/rewardText), not just the new
// bare level number — "何が解放されたか" per the request.
export function TownLevelUpModal({ event, onClose }: Props) {
  if (event === null) return null;
  const def = getTownLevelDef(event.level);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>🎉 街の発展クエスト達成!</Text>
          <Text style={styles.questName}>「{event.questName}」</Text>
          <Text style={styles.emoji}>{def.emoji}</Text>
          <Text style={styles.name}>{def.name}</Text>
          <Text style={styles.reasonText}>{event.rewardText}</Text>
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
  title: { fontSize: 18, fontWeight: '800', color: theme.gold, marginBottom: 4 },
  questName: { fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 8 },
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
