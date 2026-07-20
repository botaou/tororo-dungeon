import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BirdState } from '../types';
import { getCharacterDef } from '../data/characters';
import { AnimatedPressable } from './AnimatedPressable';
import { theme } from '../theme';

interface Props {
  visible: boolean;
  // Recruited birds with no house of their own yet (see useTownStore's
  // houses) — the only birds a vacant house can be assigned to.
  candidates: BirdState[];
  onAssign: (defId: string) => void;
  onClose: () => void;
}

// Phase 14: tapping a vacant (residentDefId: null) house opens this — the
// "この家はハクの家、と自分で決める" moment the whole feature exists for.
export function HouseAssignModal({ visible, candidates, onAssign, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>🔑 この家に住まわせる鳥を選ぶ</Text>
            <AnimatedPressable onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>閉じる</Text>
            </AnimatedPressable>
          </View>
          {candidates.length === 0 ? (
            <Text style={styles.emptyText}>まだ家のない仲間はいません。新しい仲間が増えたら、ここで住まわせてあげましょう。</Text>
          ) : (
            <ScrollView style={styles.list}>
              {candidates.map((bird) => {
                const def = getCharacterDef(bird.defId);
                return (
                  <AnimatedPressable key={bird.defId} style={styles.row} onPress={() => onAssign(bird.defId)}>
                    <Text style={styles.rowEmoji}>{def.emoji}</Text>
                    <Text style={styles.rowName}>{bird.name}</Text>
                    <Text style={styles.rowCta}>ここに住む →</Text>
                  </AnimatedPressable>
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: theme.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: theme.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 18,
    maxHeight: '70%',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 16, fontWeight: '800', color: theme.textPrimary },
  closeButton: { paddingHorizontal: 10, paddingVertical: 6 },
  closeButtonText: { fontSize: 13, fontWeight: '700', color: theme.textSecondary },
  emptyText: { fontSize: 12, color: theme.textMuted, paddingVertical: 20, textAlign: 'center' },
  list: { marginTop: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.cardAlt,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  rowEmoji: { fontSize: 22, marginRight: 10 },
  rowName: { flex: 1, fontSize: 14, fontWeight: '700', color: theme.textPrimary },
  rowCta: { fontSize: 12, fontWeight: '700', color: theme.gold },
});
