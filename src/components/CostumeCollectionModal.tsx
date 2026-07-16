import React, { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';

import { MaterialId } from '../types';
import { CHARACTERS } from '../data/characters';
import { COSMETIC_ITEMS, COSMETIC_ITEM_MAP } from '../data/cosmetics';
import { COSTUME_RECIPES } from '../data/costumeRecipes';
import { MATERIAL_ICON, MATERIAL_LABEL } from '../data/materials';
import { useCosmeticStore } from '../store/useCosmeticStore';
import { useRecipeStore } from '../store/useRecipeStore';
import { usePlayerStore } from '../store/usePlayerStore';
import { AnimatedPressable } from './AnimatedPressable';
import { CharacterAvatar } from './CharacterAvatar';
import { theme } from '../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
}

// The "見つける・作る・贈る" side of the costume system (see
// data/cosmetics.ts, useCosmeticStore, game/cosmeticUnlocks.ts) — separate
// from BirdRosterModal's per-bird costume *picker*, which only ever shows
// already-unlocked costumes for actually wearing. This modal is where an
// obtained-but-unspent ticket gets gifted to unlock its costume, and where
// unlocked costume recipes get crafted into new tickets.
export function CostumeCollectionModal({ visible, onClose }: Props) {
  const unlockedCosmeticIds = useCosmeticStore((s) => s.unlockedCosmeticIds);
  const ticketCounts = useCosmeticStore((s) => s.ticketCounts);
  const giftCosmetic = useCosmeticStore((s) => s.giftCosmetic);
  const unlockedRecipeIds = useRecipeStore((s) => s.unlockedRecipeIds);
  const materials = usePlayerStore((s) => s.materials);
  const craftCosmetic = usePlayerStore((s) => s.craftCosmetic);

  // Which ticket's "贈る" row is currently showing its 4-bird picker.
  const [pickingFor, setPickingFor] = useState<string | null>(null);
  const [justGiftedTo, setJustGiftedTo] = useState<{ cosmeticId: string; birdName: string } | null>(null);

  const ticketedIds = COSMETIC_ITEMS.filter((c) => (ticketCounts[c.id] ?? 0) > 0);
  const lockedUnticketedCount = COSMETIC_ITEMS.length - unlockedCosmeticIds.length - ticketedIds.length;
  const craftableRecipes = COSTUME_RECIPES.filter((r) => unlockedRecipeIds.includes(r.id));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>🎁 コスチューム図鑑</Text>
            <AnimatedPressable onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>閉じる</Text>
            </AnimatedPressable>
          </View>
          <ScrollView style={styles.list}>
            <Text style={styles.sectionTitle}>所持中のチケット({ticketedIds.length})</Text>
            {ticketedIds.length === 0 ? (
              <Text style={styles.emptyText}>まだありません。採取・討伐・加工で見つけましょう。</Text>
            ) : (
              ticketedIds.map((cosmetic) => (
                <View key={cosmetic.id} style={styles.ticketCard}>
                  <View style={styles.ticketCardHeader}>
                    <Text style={styles.ticketName}>{cosmetic.name}</Text>
                    <Text style={styles.ticketCount}>×{ticketCounts[cosmetic.id]}</Text>
                  </View>
                  {pickingFor === cosmetic.id ? (
                    <View style={styles.birdPickRow}>
                      {CHARACTERS.map((c) => (
                        <AnimatedPressable
                          key={c.id}
                          style={styles.birdPickChip}
                          onPress={() => {
                            if (giftCosmetic(cosmetic.id)) {
                              setJustGiftedTo({ cosmeticId: cosmetic.id, birdName: c.name });
                            }
                            setPickingFor(null);
                          }}
                        >
                          <CharacterAvatar characterId={c.id} emoji={c.emoji} color={c.color} size={32} />
                          <Text style={styles.birdPickLabel}>{c.name}</Text>
                        </AnimatedPressable>
                      ))}
                    </View>
                  ) : (
                    <AnimatedPressable style={styles.giftButton} onPress={() => setPickingFor(cosmetic.id)}>
                      <Text style={styles.giftButtonText}>贈る</Text>
                    </AnimatedPressable>
                  )}
                  {justGiftedTo?.cosmeticId === cosmetic.id && (
                    <Text style={styles.giftedText}>{justGiftedTo.birdName}に贈った!これで皆が着られます。</Text>
                  )}
                </View>
              ))
            )}

            <Text style={styles.sectionTitle}>加工できるレシピ({craftableRecipes.length})</Text>
            {craftableRecipes.length === 0 ? (
              <Text style={styles.emptyText}>まだありません。レシピは討伐・採取・依頼報酬で見つかります。</Text>
            ) : (
              craftableRecipes.map((recipe) => {
                const cosmetic = COSMETIC_ITEM_MAP[recipe.cosmeticId];
                const costEntries = Object.entries(recipe.materialCost) as [MaterialId, number][];
                const canAfford = costEntries.every(([materialId, amount]) => (materials[materialId] ?? 0) >= amount);
                const alreadyHave = unlockedCosmeticIds.includes(recipe.cosmeticId) || (ticketCounts[recipe.cosmeticId] ?? 0) > 0;
                return (
                  <View key={recipe.id} style={styles.ticketCard}>
                    <View style={styles.ticketCardHeader}>
                      <Text style={styles.ticketName}>{cosmetic.name}</Text>
                      {alreadyHave && <Text style={styles.ticketCount}>入手済み</Text>}
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
                      style={[styles.giftButton, !canAfford && styles.giftButtonDisabled]}
                      disabled={!canAfford}
                      onPress={() => craftCosmetic(recipe.id)}
                    >
                      <Text style={styles.giftButtonText}>{canAfford ? '加工する' : '素材が足りません'}</Text>
                    </AnimatedPressable>
                  </View>
                );
              })
            )}

            <Text style={styles.sectionTitle}>解放済み({unlockedCosmeticIds.length}/{COSMETIC_ITEMS.length})</Text>
            <Text style={styles.emptyText}>
              {unlockedCosmeticIds.map((id) => COSMETIC_ITEM_MAP[id].name).join('・')}
            </Text>
            {lockedUnticketedCount > 0 && (
              <Text style={styles.footerHint}>🔒 あと{lockedUnticketedCount}点は採取・討伐・加工で発見できます</Text>
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
  title: { fontSize: 16, fontWeight: '800', color: theme.gold },
  closeButton: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: theme.cardAlt, borderRadius: 999 },
  closeButtonText: { color: theme.blue, fontWeight: '700', fontSize: 13 },
  list: { maxHeight: 460 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: theme.textPrimary, marginTop: 14, marginBottom: 6 },
  emptyText: { fontSize: 12, color: theme.textMuted, paddingVertical: 4 },
  footerHint: { fontSize: 11, color: theme.textMuted, marginTop: 10, marginBottom: 4 },
  ticketCard: {
    backgroundColor: theme.cardAlt,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: theme.cardBorder,
    padding: 12,
    marginBottom: 10,
  },
  ticketCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ticketName: { fontSize: 14, fontWeight: '800', color: theme.textPrimary },
  ticketCount: { fontSize: 12, fontWeight: '700', color: theme.gold },
  costRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, marginBottom: 4 },
  costItem: { fontSize: 12, fontWeight: '700', color: theme.textPrimary },
  costItemShort: { color: theme.textMuted },
  giftButton: {
    marginTop: 8,
    backgroundColor: theme.gold,
    borderRadius: 999,
    paddingVertical: 8,
    alignItems: 'center',
  },
  giftButtonDisabled: { backgroundColor: theme.cardBorder },
  giftButtonText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  giftedText: { fontSize: 11, color: theme.textSecondary, marginTop: 6 },
  birdPickRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  birdPickChip: { flex: 1, alignItems: 'center', backgroundColor: theme.card, borderRadius: 10, paddingVertical: 6 },
  birdPickLabel: { fontSize: 10, color: theme.textMuted, marginTop: 2 },
});
