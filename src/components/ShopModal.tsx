import React from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable } from './AnimatedPressable';
import { theme } from '../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
}

// Placeholder for the shop's real buy/sell system — for now, tapping the
// shop building just confirms it's there and gives a hint of what's coming.
export function ShopModal({ visible, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>🏪 お店</Text>
            <AnimatedPressable onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>閉じる</Text>
            </AnimatedPressable>
          </View>
          <Text style={styles.bodyText}>ただいま準備中です。</Text>
          <Text style={styles.bodySubText}>ここで素材を売ったり、道具や餌を買えるようになる予定です。</Text>
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '800', color: theme.gold },
  closeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: theme.cardAlt,
    borderRadius: 999,
  },
  closeButtonText: { color: theme.blue, fontWeight: '700', fontSize: 13 },
  bodyText: { fontSize: 14, fontWeight: '700', color: theme.textPrimary, marginBottom: 6 },
  bodySubText: { fontSize: 12, color: theme.textSecondary, paddingBottom: 12 },
});
