import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';

import { MaterialId } from '../types';
import { CRAFTING_RECIPES } from '../data/recipes';
import { ITEM_DEF_MAP } from '../data/items';
import { MATERIAL_ICON, MATERIAL_LABEL } from '../data/materials';
import { usePlayerStore } from '../store/usePlayerStore';
import { AnimatedPressable } from './AnimatedPressable';
import { theme } from '../theme';

// The player's main hands-on action: turn bought materials into gear.
// Recipes are a small fixed catalog for now (see data/recipes.ts) — this
// modal just lists them against current warehouse stock and lets the
// player craft one unit at a time when they can afford the cost.
interface Props {
  visible: boolean;
  onClose: () => void;
}

export function CraftingModal({ visible, onClose }: Props) {
  const materials = usePlayerStore((s) => s.materials);
  const items = usePlayerStore((s) => s.items);
  const craftItem = usePlayerStore((s) => s.craftItem);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>🛠️ 加工</Text>
            <AnimatedPressable onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>閉じる</Text>
            </AnimatedPressable>
          </View>
          <Text style={styles.bodySubText}>買い取った素材を加工して、店に並べるアイテムを作れます。</Text>

          <ScrollView style={styles.list}>
            {CRAFTING_RECIPES.map((recipe) => {
              const itemDef = ITEM_DEF_MAP[recipe.resultItemId];
              const costEntries = Object.entries(recipe.materialCost) as [MaterialId, number][];
              const canAfford = costEntries.every(([materialId, amount]) => (materials[materialId] ?? 0) >= amount);
              const owned = items[recipe.resultItemId] ?? 0;

              return (
                <View key={recipe.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardEmoji}>{itemDef.emoji}</Text>
                    <View style={styles.cardHeaderText}>
                      <Text style={styles.cardName}>{itemDef.name}</Text>
                      <Text style={styles.cardOwned}>倉庫に{owned}個</Text>
                    </View>
                  </View>
                  <View style={styles.costRow}>
                    {costEntries.map(([materialId, amount]) => {
                      const have = materials[materialId] ?? 0;
                      const enough = have >= amount;
                      return (
                        <Text
                          key={materialId}
                          style={[styles.costItem, !enough && styles.costItemShort]}
                        >
                          {MATERIAL_ICON[materialId]}
                          {MATERIAL_LABEL[materialId]} {have}/{amount}
                        </Text>
                      );
                    })}
                  </View>
                  <AnimatedPressable
                    style={[styles.craftButton, !canAfford && styles.craftButtonDisabled]}
                    disabled={!canAfford}
                    onPress={() => craftItem(recipe.id)}
                  >
                    <Text style={styles.craftButtonText}>{canAfford ? '加工する' : '素材が足りません'}</Text>
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
  closeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: theme.cardAlt,
    borderRadius: 999,
  },
  closeButtonText: { color: theme.blue, fontWeight: '700', fontSize: 13 },
  bodySubText: { fontSize: 12, color: theme.textSecondary, marginBottom: 12 },
  list: { maxHeight: 440 },
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
  craftButton: {
    backgroundColor: theme.gold,
    borderRadius: 999,
    paddingVertical: 9,
    alignItems: 'center',
  },
  craftButtonDisabled: { backgroundColor: theme.cardBorder },
  craftButtonText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
