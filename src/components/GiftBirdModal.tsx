import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BirdState, ItemId } from '../types';
import { ITEM_DEF_MAP } from '../data/items';
import { AnimatedPressable } from './AnimatedPressable';
import { theme } from '../theme';

interface Props {
  bird: BirdState | null;
  playerItems: Partial<Record<ItemId, number>>;
  onGift: (defId: string, itemId: ItemId) => void;
  onClose: () => void;
}

// Phase 14: "なだめる" — hand a houseless-and-sulking bird 1 unit of any item
// the town warehouse currently holds (simple, not tied to a particular item —
// see useWorldStore's giveGiftToBird). Cheers the bird up and resets its
// houselessSinceMs clock, buying more time before the next warning/departure
// check — it doesn't give the bird a house, just calms it down for a while.
export function GiftBirdModal({ bird, playerItems, onGift, onClose }: Props) {
  if (!bird) return null;
  const candidates = (Object.keys(playerItems) as ItemId[]).filter((id) => (playerItems[id] ?? 0) > 0 && ITEM_DEF_MAP[id]);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>🎁 {bird.name}にプレゼント</Text>
            <AnimatedPressable onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>閉じる</Text>
            </AnimatedPressable>
          </View>
          <Text style={styles.subtitle}>倉庫の品物を1つ渡して、ご機嫌を直してあげましょう。</Text>
          {candidates.length === 0 ? (
            <Text style={styles.emptyText}>倉庫に渡せる品物がありません。まずは加工してみましょう。</Text>
          ) : (
            <ScrollView style={styles.list}>
              <View style={styles.grid}>
                {candidates.map((id) => {
                  const def = ITEM_DEF_MAP[id];
                  return (
                    <AnimatedPressable key={id} style={styles.item} onPress={() => onGift(bird.defId, id)}>
                      <Text style={styles.itemIcon}>{def.emoji}</Text>
                      <Text style={styles.itemLabel}>{def.name}</Text>
                      <Text style={styles.itemValue}>×{playerItems[id]}</Text>
                    </AnimatedPressable>
                  );
                })}
              </View>
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
    maxHeight: '75%',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 17, fontWeight: '800', color: theme.textPrimary },
  closeButton: { paddingHorizontal: 10, paddingVertical: 6 },
  closeButtonText: { fontSize: 13, fontWeight: '700', color: theme.textSecondary },
  subtitle: { fontSize: 12, color: theme.textSecondary, marginTop: 6, marginBottom: 10 },
  emptyText: { fontSize: 12, color: theme.textMuted, paddingVertical: 20, textAlign: 'center' },
  list: { marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  item: {
    width: 84,
    alignItems: 'center',
    backgroundColor: theme.cardAlt,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: theme.cardBorder,
    paddingVertical: 10,
  },
  itemIcon: { fontSize: 24 },
  itemLabel: { fontSize: 10, fontWeight: '700', color: theme.textPrimary, marginTop: 4, textAlign: 'center' },
  itemValue: { fontSize: 10, color: theme.textSecondary, marginTop: 2 },
});
