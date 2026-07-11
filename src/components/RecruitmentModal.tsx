import React from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';

import { getCharacterDef } from '../data/characters';
import { CharacterAvatar } from './CharacterAvatar';
import { AnimatedPressable } from './AnimatedPressable';
import { RECRUIT_LINES } from '../game/thoughts';
import { theme } from '../theme';

interface Props {
  defId: string | null;
  onClose: () => void;
}

// A light "仲間になった感" announcement — no dedicated cutscene, just a
// short modal with the character's own voice, shown once per recruitment
// event (see TownScreen, which queues off world.recruitmentEvents).
export function RecruitmentModal({ defId, onClose }: Props) {
  if (!defId) return null;
  const def = getCharacterDef(defId);
  const line = RECRUIT_LINES[defId] ?? '仲間になりました!';

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { borderColor: def.color }]}>
          <Text style={styles.title}>🎉 新しい仲間!</Text>
          <CharacterAvatar characterId={def.id} emoji={def.emoji} color={def.color} size={72} />
          <Text style={styles.name}>{def.name}</Text>
          <Text style={styles.roleLabel}>{def.roleLabel}</Text>
          <View style={styles.speechBubble}>
            <Text style={styles.speechText}>{line}</Text>
          </View>
          <AnimatedPressable style={[styles.closeButton, { backgroundColor: def.color }]} onPress={onClose}>
            <Text style={styles.closeButtonText}>一緒に街を歩く</Text>
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
    padding: 20,
    alignItems: 'center',
  },
  title: { fontSize: 18, fontWeight: '800', color: theme.gold, marginBottom: 12 },
  name: { fontSize: 20, fontWeight: '800', color: theme.textPrimary, marginTop: 10 },
  roleLabel: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
  speechBubble: {
    marginTop: 14,
    backgroundColor: theme.cardAlt,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  speechText: { fontSize: 13, fontWeight: '700', color: theme.textPrimary, textAlign: 'center' },
  closeButton: {
    marginTop: 18,
    borderRadius: 999,
    paddingHorizontal: 24,
    paddingVertical: 12,
    alignItems: 'center',
  },
  closeButtonText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
