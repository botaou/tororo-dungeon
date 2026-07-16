import React from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';

import { RecipeSource } from '../types';
import { CRAFTING_RECIPES } from '../data/recipes';
import { COSTUME_RECIPES } from '../data/costumeRecipes';
import { ITEM_DEF_MAP } from '../data/items';
import { COSMETIC_ITEM_MAP } from '../data/cosmetics';
import { AnimatedPressable } from './AnimatedPressable';
import { theme } from '../theme';

interface Props {
  event: { recipeId: string; source: RecipeSource } | null;
  onClose: () => void;
}

const SOURCE_LABEL: Record<RecipeSource, string> = {
  merchant: '商人から購入した',
  gift: '鳥が採取中に見つけてプレゼントしてくれた',
  quest: '依頼の報酬で手に入れた',
  combat: '討伐の報酬で手に入れた',
};

// Announces each newly-unlocked recipe — same queued-events pattern as
// RecruitmentModal (see TownScreen, which queues off useWorldStore's
// recipeUnlockEvents). Not persisted (world itself isn't), so there's no
// backlog-replay risk the way there was with useTownStore's levelUpEvents.
export function RecipeUnlockModal({ event, onClose }: Props) {
  if (!event) return null;
  // A recipe-unlock event can now surface either an item recipe or a
  // costume recipe (see game/recipeUnlocks.ts's combined discovery pool) —
  // costumes have no emoji of their own, so a plain 👗 stands in for it.
  const itemRecipe = CRAFTING_RECIPES.find((r) => r.id === event.recipeId);
  const costumeRecipe = COSTUME_RECIPES.find((r) => r.id === event.recipeId);
  if (!itemRecipe && !costumeRecipe) return null;
  const emoji = itemRecipe ? ITEM_DEF_MAP[itemRecipe.resultItemId].emoji : '👗';
  const name = itemRecipe ? ITEM_DEF_MAP[itemRecipe.resultItemId].name : COSMETIC_ITEM_MAP[costumeRecipe!.cosmeticId].name;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>📜 新しいレシピを手に入れた!</Text>
          <Text style={styles.emoji}>{emoji}</Text>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.sourceText}>{SOURCE_LABEL[event.source]}</Text>
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
