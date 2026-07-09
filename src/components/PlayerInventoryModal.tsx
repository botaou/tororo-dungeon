import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';

import { MaterialId } from '../types';
import { MATERIAL_ICON, MATERIAL_LABEL } from '../data/materials';
import { AnimatedPressable } from './AnimatedPressable';
import { theme } from '../theme';

// The player's own belongings — only what's actually been bought from a
// bird ends up here, so this is the town's shared stash, not a live view
// of what birds are personally carrying/holding.
interface Props {
  visible: boolean;
  onClose: () => void;
  gold: number;
  materials: Record<MaterialId, number>;
}

const ALL_MATERIALS = Object.keys(MATERIAL_ICON) as MaterialId[];

export function PlayerInventoryModal({ visible, onClose, gold, materials }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>🎒 街の倉庫</Text>
            <AnimatedPressable onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>閉じる</Text>
            </AnimatedPressable>
          </View>

          <View style={styles.goldRow}>
            <Text style={styles.goldIcon}>🪙</Text>
            <Text style={styles.goldText}>{gold} G</Text>
          </View>

          <ScrollView style={styles.list}>
            <View style={styles.grid}>
              {ALL_MATERIALS.map((key) => (
                <View style={styles.item} key={key}>
                  <Text style={styles.itemIcon}>{MATERIAL_ICON[key]}</Text>
                  <Text style={styles.itemLabel}>{MATERIAL_LABEL[key]}</Text>
                  <Text style={styles.itemValue}>{materials[key] ?? 0}</Text>
                </View>
              ))}
            </View>
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
    maxHeight: '75%',
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  title: { fontSize: 18, fontWeight: '800', color: theme.gold },
  closeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: theme.cardAlt,
    borderRadius: 999,
  },
  closeButtonText: { color: theme.blue, fontWeight: '700', fontSize: 13 },
  goldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.cardAlt,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.gold,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  goldIcon: { fontSize: 16 },
  goldText: { fontSize: 14, fontWeight: '800', color: theme.textPrimary },
  list: { maxHeight: 340 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  item: {
    width: '30%',
    backgroundColor: theme.cardAlt,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    gap: 2,
  },
  itemIcon: { fontSize: 20 },
  itemLabel: { fontSize: 10, color: theme.textSecondary },
  itemValue: { fontSize: 14, fontWeight: '800', color: theme.textPrimary },
});
