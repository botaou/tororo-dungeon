import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ItemCategory, MaterialId } from '../types';
import { CRAFTING_RECIPES } from '../data/recipes';
import { ITEM_DEF_MAP } from '../data/items';
import { MATERIAL_ICON, MATERIAL_LABEL } from '../data/materials';
import { usePlayerStore } from '../store/usePlayerStore';
import { useWorldStore } from '../store/useWorldStore';
import { AnimatedPressable } from './AnimatedPressable';
import { theme } from '../theme';

// The player's main hands-on action: turn bought materials into gear (or,
// at the feed shop, into premium food). Recipes are a small fixed catalog
// (see data/recipes.ts) — this lists them against current warehouse stock
// and lets the player craft one unit at a time when they can afford it.
// Reused both standalone (dev shortcut, unfiltered) and inside a shop's
// own "加工する" flow (filtered to that shop's categories).
interface Props {
  categoryFilter?: ItemCategory[];
}

export function CraftingPanel({ categoryFilter }: Props) {
  const materials = usePlayerStore((s) => s.materials);
  const items = usePlayerStore((s) => s.items);
  const craftItem = usePlayerStore((s) => s.craftItem);
  const reportCraftCompleted = useWorldStore((s) => s.reportCraftCompleted);

  const recipes = categoryFilter
    ? CRAFTING_RECIPES.filter((r) => categoryFilter.includes(ITEM_DEF_MAP[r.resultItemId].category))
    : CRAFTING_RECIPES;

  return (
    <ScrollView style={styles.list}>
      {recipes.map((recipe) => {
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
                  <Text key={materialId} style={[styles.costItem, !enough && styles.costItemShort]}>
                    {MATERIAL_ICON[materialId]}
                    {MATERIAL_LABEL[materialId]} {have}/{amount}
                  </Text>
                );
              })}
            </View>
            <AnimatedPressable
              style={[styles.craftButton, !canAfford && styles.craftButtonDisabled]}
              disabled={!canAfford}
              onPress={() => {
                if (craftItem(recipe.id)) reportCraftCompleted(recipe.resultItemId);
              }}
            >
              <Text style={styles.craftButtonText}>{canAfford ? '加工する' : '素材が足りません'}</Text>
            </AnimatedPressable>
          </View>
        );
      })}
      {recipes.length === 0 && <Text style={styles.emptyText}>このお店で加工できるレシピはまだありません。</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: { maxHeight: 400 },
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
  emptyText: { fontSize: 12, color: theme.textMuted, paddingVertical: 12 },
});
