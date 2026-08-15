import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ITEM_DEF_MAP } from '../data/items';
import { useMayorRoomStore } from '../store/useMayorRoomStore';
import { AnimatedPressable } from './AnimatedPressable';
import { theme } from '../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  // "収納する" is fully self-contained here (just calls
  // useMayorRoomStore.storeGiftToWarehouse and the list shrinks by itself).
  // "飾る" needs to hand control back to MayorRoomModal, though — it enters
  // room-tap placement mode on the ROOM canvas, which lives in the parent,
  // not in this list. The parent's handler is responsible for closing this
  // modal itself (see MayorRoomModal's own onDecorate).
  onDecorate: (giftId: string) => void;
}

// 山積みになった贈り物をタップした先の一覧(item 85) — each pending gift
// gets its own 飾る/収納 choice, per the request's own "個別に...選べる".
export function GiftPileModal({ visible, onClose, onDecorate }: Props) {
  const gifts = useMayorRoomStore((s) => s.gifts);
  const storeGiftToWarehouse = useMayorRoomStore((s) => s.storeGiftToWarehouse);

  // Oldest-left-behind-first reads naturally as "work through the pile from
  // the bottom" — newest gifts (the top of a real pile) shown last.
  const ordered = [...gifts].sort((a, b) => a.at - b.at);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>🎁 山積みの贈り物({gifts.length})</Text>
            <AnimatedPressable onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>閉じる</Text>
            </AnimatedPressable>
          </View>
          <Text style={styles.subtitle}>それぞれ「飾る」か「収納する」かを選んでください。</Text>

          <ScrollView style={styles.list}>
            {ordered.length === 0 ? (
              <Text style={styles.emptyText}>山は片付きました!</Text>
            ) : (
              ordered.map((gift) => {
                const def = ITEM_DEF_MAP[gift.itemId];
                return (
                  <View key={gift.id} style={styles.card}>
                    <Text style={styles.cardEmoji}>{def?.emoji ?? '🎁'}</Text>
                    <View style={styles.cardTextWrap}>
                      <Text style={styles.cardName}>{def?.name ?? '何か'}</Text>
                      <Text style={styles.cardSub}>{gift.birdName}が置いていった</Text>
                    </View>
                    <View style={styles.cardButtons}>
                      <AnimatedPressable style={styles.decorateButton} onPress={() => onDecorate(gift.id)}>
                        <Text style={styles.decorateButtonText}>🖼️ 飾る</Text>
                      </AnimatedPressable>
                      <AnimatedPressable style={styles.storeButton} onPress={() => storeGiftToWarehouse(gift.id)}>
                        <Text style={styles.storeButtonText}>📦 収納する</Text>
                      </AnimatedPressable>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
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
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 16, fontWeight: '800', color: theme.gold, flexShrink: 1, marginRight: 8 },
  closeButton: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: theme.cardAlt, borderRadius: 999 },
  closeButtonText: { color: theme.blue, fontWeight: '700', fontSize: 13 },
  subtitle: { fontSize: 12, color: theme.textSecondary, marginBottom: 12 },
  list: { maxHeight: 420 },
  emptyText: { fontSize: 12, color: theme.textMuted, paddingVertical: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.cardAlt,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: theme.cardBorder,
    padding: 10,
    marginBottom: 10,
    gap: 10,
  },
  cardEmoji: { fontSize: 26 },
  cardTextWrap: { flex: 1 },
  cardName: { fontSize: 13, fontWeight: '800', color: theme.textPrimary },
  cardSub: { fontSize: 10, color: theme.textMuted, marginTop: 1 },
  cardButtons: { gap: 6 },
  decorateButton: { backgroundColor: theme.gold, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  decorateButtonText: { color: '#fff', fontWeight: '700', fontSize: 11 },
  storeButton: {
    backgroundColor: theme.card,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  storeButtonText: { color: theme.textSecondary, fontWeight: '700', fontSize: 11 },
});
