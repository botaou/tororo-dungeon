import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';

import { MaterialId } from '../types';
import { FURNITURE_DEF_MAP } from '../data/furniture';
import { FURNITURE_RECIPES } from '../data/furnitureRecipes';
import { MATERIAL_ICON, MATERIAL_LABEL } from '../data/materials';
import { usePlayerStore } from '../store/usePlayerStore';
import { useMayorRoomStore } from '../store/useMayorRoomStore';
import { AnimatedPressable } from './AnimatedPressable';
import { theme } from '../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
}

// 家具屋(furniture shop) — Phase 15③'s "仕立て屋 crafts 家具" requirement:
// spend materials here to craft a piece into craftedStock (see
// useMayorRoomStore), then place it for free inside MayorRoomModal. Same
// "craftable recipes" layout as CostumeCollectionModal's own section, just
// without that modal's ticket/gift half — furniture has no per-bird
// ownership to gift, it's just placed in the room.
export function FurnitureShopModal({ visible, onClose }: Props) {
  const materials = usePlayerStore((s) => s.materials);
  const craftedStock = useMayorRoomStore((s) => s.craftedStock);
  const craftFurniture = useMayorRoomStore((s) => s.craftFurniture);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>🪑 家具屋</Text>
            <AnimatedPressable onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>閉じる</Text>
            </AnimatedPressable>
          </View>
          <Text style={styles.subtitle}>素材から家具・マネキンを仕立てます。町長室で自由に置けます。</Text>
          <ScrollView style={styles.list}>
            {FURNITURE_RECIPES.filter((r) => r.unlockedByDefault).map((recipe) => {
              const def = FURNITURE_DEF_MAP[recipe.furnitureDefId];
              const costEntries = Object.entries(recipe.materialCost) as [MaterialId, number][];
              const canAfford = costEntries.every(([materialId, amount]) => (materials[materialId] ?? 0) >= amount);
              const owned = craftedStock[recipe.furnitureDefId] ?? 0;
              return (
                <View key={recipe.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardEmoji}>{def.emoji}</Text>
                    <View style={styles.cardHeaderText}>
                      <Text style={styles.cardName}>{def.name}</Text>
                      <Text style={styles.cardOwned}>手持ち{owned}個</Text>
                    </View>
                  </View>
                  <View style={styles.costRow}>
                    {costEntries.map(([materialId, amount]) => {
                      const have = materials[materialId] ?? 0;
                      return (
                        <Text key={materialId} style={[styles.costItem, have < amount && styles.costItemShort]}>
                          {MATERIAL_ICON[materialId]}
                          {MATERIAL_LABEL[materialId]} {have}/{amount}
                        </Text>
                      );
                    })}
                  </View>
                  <AnimatedPressable
                    style={[styles.craftButton, !canAfford && styles.craftButtonDisabled]}
                    disabled={!canAfford}
                    onPress={() => craftFurniture(recipe.id)}
                  >
                    <Text style={styles.craftButtonText}>{canAfford ? '仕立てる' : '素材が足りません'}</Text>
                  </AnimatedPressable>
                </View>
              );
            })}
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
  title: { fontSize: 18, fontWeight: '800', color: theme.gold },
  closeButton: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: theme.cardAlt, borderRadius: 999 },
  closeButtonText: { color: theme.blue, fontWeight: '700', fontSize: 13 },
  subtitle: { fontSize: 12, color: theme.textSecondary, marginBottom: 12 },
  list: { maxHeight: 420 },
  card: {
    backgroundColor: theme.cardAlt,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: theme.cardBorder,
    padding: 12,
    marginBottom: 10,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  cardEmoji: { fontSize: 24 },
  cardHeaderText: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: '800', color: theme.textPrimary },
  cardOwned: { fontSize: 11, color: theme.textMuted, marginTop: 1 },
  costRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  costItem: { fontSize: 12, fontWeight: '700', color: theme.textPrimary },
  costItemShort: { color: theme.textMuted },
  craftButton: { backgroundColor: theme.gold, borderRadius: 999, paddingVertical: 9, alignItems: 'center' },
  craftButtonDisabled: { backgroundColor: theme.cardBorder },
  craftButtonText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
