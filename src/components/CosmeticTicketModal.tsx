import React from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';

import { CosmeticSource } from '../types';
import { COSMETIC_ITEM_MAP } from '../data/cosmetics';
import { AnimatedPressable } from './AnimatedPressable';
import { theme } from '../theme';

interface Props {
  event: { cosmeticId: string; source: CosmeticSource } | null;
  onClose: () => void;
}

const SOURCE_LABEL: Record<CosmeticSource, string> = {
  find: '鳥が採取中に見つけた',
  drop: '討伐の報酬で手に入れた',
  craft: '加工で作った',
};

// Announces a newly-*obtained* costume ticket (see game/cosmeticUnlocks.ts,
// useCosmeticStore) — same queued-events pattern as RecipeUnlockModal (see
// TownScreen, which queues off useWorldStore's cosmeticTicketEvents). This
// is only the "you found something!" moment; the costume still needs to be
// gifted (see CostumeCollectionModal) before any bird can actually wear it,
// which the closing button below reminds the player of.
export function CosmeticTicketModal({ event, onClose }: Props) {
  if (!event) return null;
  const cosmetic = COSMETIC_ITEM_MAP[event.cosmeticId];
  if (!cosmetic) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>🎁 新しいコスチュームを手に入れた!</Text>
          <Text style={styles.emoji}>👗</Text>
          <Text style={styles.name}>{cosmetic.name}</Text>
          <Text style={styles.sourceText}>{SOURCE_LABEL[event.source]}</Text>
          <Text style={styles.hintText}>🎁コスチューム図鑑から鳥に贈ると、皆が着られるようになります</Text>
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
  name: { fontSize: 20, fontWeight: '800', color: theme.textPrimary, marginTop: 10 },
  sourceText: { fontSize: 12, color: theme.textSecondary, marginTop: 6 },
  hintText: { fontSize: 11, color: theme.textMuted, marginTop: 10, textAlign: 'center' },
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
