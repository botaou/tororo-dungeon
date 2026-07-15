import React from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';

import { BIRD_SKILL_DEF_MAP } from '../data/skills';
import { AnimatedPressable } from './AnimatedPressable';
import { theme } from '../theme';

interface Props {
  event: { birdName: string; skillId: string } | null;
  onClose: () => void;
}

// Announces a bird's rare skill-acquiring "ひらめき" (see ai.ts's
// executePlay) — same queued-events pattern as RecipeUnlockModal (see
// TownScreen, which queues off useWorldStore's skillUnlockEvents). Not
// persisted (world itself isn't), so there's no backlog-replay risk.
export function SkillUnlockModal({ event, onClose }: Props) {
  if (!event) return null;
  const skill = BIRD_SKILL_DEF_MAP[event.skillId];
  if (!skill) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>💡 {event.birdName}がひらめいた!</Text>
          <Text style={styles.emoji}>✨</Text>
          <Text style={styles.name}>新しいスキル「{skill.name}」</Text>
          <Text style={styles.sourceText}>{skill.description}</Text>
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
  title: { fontSize: 16, fontWeight: '800', color: theme.gold, marginBottom: 12, textAlign: 'center' },
  emoji: { fontSize: 56, marginTop: 4 },
  name: { fontSize: 20, fontWeight: '800', color: theme.textPrimary, marginTop: 10, textAlign: 'center' },
  sourceText: { fontSize: 12, color: theme.textSecondary, marginTop: 6, textAlign: 'center' },
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
