import React from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';

import { CraftingPanel } from './CraftingPanel';
import { AnimatedPressable } from './AnimatedPressable';
import { theme } from '../theme';

// Dev shortcut: every recipe, unfiltered, reachable straight from the top
// bar without walking to a shop. The "real" flow is tapping a shop and
// choosing 加工する there (see ShopModal), which uses the same CraftingPanel
// filtered to that shop's own categories.
interface Props {
  visible: boolean;
  onClose: () => void;
}

export function CraftingModal({ visible, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>🛠️ 加工(開発用・全レシピ)</Text>
            <AnimatedPressable onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>閉じる</Text>
            </AnimatedPressable>
          </View>
          <Text style={styles.bodySubText}>買い取った素材を加工して、店に並べるアイテムを作れます。</Text>
          <CraftingPanel />
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
  title: { fontSize: 16, fontWeight: '800', color: theme.gold },
  closeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: theme.cardAlt,
    borderRadius: 999,
  },
  closeButtonText: { color: theme.blue, fontWeight: '700', fontSize: 13 },
  bodySubText: { fontSize: 12, color: theme.textSecondary, marginBottom: 12 },
});
