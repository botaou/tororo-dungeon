import React, { useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';

import { ItemId } from '../types';
import { ITEM_DEF_MAP } from '../data/items';
import { MYSTERY_GACHA_COST } from '../game/config';
import { usePlayerStore } from '../store/usePlayerStore';
import { AnimatedPressable } from './AnimatedPressable';
import { theme } from '../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
}

// 怪しいアイテム屋(mystery item shop) — Phase 15③'s gacha-style draw: pay a
// flat gold price for one random item, reusing the visiting merchant's own
// rare/common pool split (see usePlayerStore's drawMysteryItem) rather than
// a shelf of specific, chosen stock like every other shop.
export function MysteryShopModal({ visible, onClose }: Props) {
  const gold = usePlayerStore((s) => s.gold);
  const drawMysteryItem = usePlayerStore((s) => s.drawMysteryItem);
  const [lastDrawn, setLastDrawn] = useState<ItemId | null>(null);

  const canAfford = gold >= MYSTERY_GACHA_COST;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>🔮 怪しいアイテム屋</Text>
            <AnimatedPressable onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>閉じる</Text>
            </AnimatedPressable>
          </View>
          <Text style={styles.subtitle}>ゴールドを払うと、何が出るか分からない品物を1つ引き当てます。</Text>

          {lastDrawn && (
            <View style={styles.resultBox}>
              <Text style={styles.resultEmoji}>{ITEM_DEF_MAP[lastDrawn].emoji}</Text>
              <Text style={styles.resultName}>{ITEM_DEF_MAP[lastDrawn].name}が出た!</Text>
            </View>
          )}

          <AnimatedPressable
            style={[styles.drawButton, !canAfford && styles.drawButtonDisabled]}
            disabled={!canAfford}
            onPress={() => {
              const result = drawMysteryItem();
              if (result) setLastDrawn(result);
            }}
          >
            <Text style={styles.drawButtonText}>{canAfford ? `🔮 引く(${MYSTERY_GACHA_COST}G)` : 'ゴールドが足りません'}</Text>
          </AnimatedPressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: theme.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: theme.card,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: 18,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 18, fontWeight: '800', color: theme.gold },
  closeButton: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: theme.cardAlt, borderRadius: 999 },
  closeButtonText: { color: theme.blue, fontWeight: '700', fontSize: 13 },
  subtitle: { fontSize: 12, color: theme.textSecondary, marginBottom: 16 },
  resultBox: {
    alignItems: 'center',
    backgroundColor: theme.cardAlt,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: theme.gold,
    paddingVertical: 16,
    marginBottom: 16,
  },
  resultEmoji: { fontSize: 36 },
  resultName: { fontSize: 14, fontWeight: '800', color: theme.textPrimary, marginTop: 6 },
  drawButton: { backgroundColor: theme.gold, borderRadius: 999, paddingVertical: 14, alignItems: 'center' },
  drawButtonDisabled: { backgroundColor: theme.cardBorder },
  drawButtonText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
