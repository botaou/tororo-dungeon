import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';

import { MerchantState } from '../types';
import { ITEM_DEF_MAP } from '../data/items';
import { CRAFTING_RECIPES } from '../data/recipes';
import { AnimatedPressable } from './AnimatedPressable';
import { theme } from '../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  merchant: MerchantState | null;
  gold: number;
  // Recipe-unlock route 1 ("商人が売りに来る") — the only merchant
  // interaction the player does directly rather than birds handling it
  // autonomously, since a recipe is player knowledge, not something a bird
  // carries. Returns false if the offer's gone or gold's insufficient.
  onBuyRecipe: () => boolean;
}

// View-only, like the rest of the game's shops from the player's side —
// birds decide for themselves whether to buy from the shelf or sell their
// convertible treasure here (see game/ai.ts's executeMerchantSellTrip /
// executeMerchantBuyTrip). This just shows what's on offer and how long
// the visit has left.
export function MerchantModal({ visible, onClose, merchant, gold, onBuyRecipe }: Props) {
  const minutesLeft = merchant ? Math.max(0, Math.ceil((merchant.departsAt - Date.now()) / 60_000)) : 0;
  const recipeOffer = merchant?.recipeOffer ?? null;
  const offerRecipe = recipeOffer ? CRAFTING_RECIPES.find((r) => r.id === recipeOffer.recipeId) : null;
  const offerItemDef = offerRecipe ? ITEM_DEF_MAP[offerRecipe.resultItemId] : null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>🏕️ 商人</Text>
            <AnimatedPressable onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>閉じる</Text>
            </AnimatedPressable>
          </View>

          {!merchant ? (
            <Text style={styles.emptyText}>今は商人が来ていません。またの来訪を待ちましょう。</Text>
          ) : (
            <>
              <Text style={styles.bodySubText}>
                あと{minutesLeft}分でこの街を去ります。鳥たちが自分の判断で品物を買ったり、宝物を売ったりします。
              </Text>
              <Text style={styles.sectionLabel}>📦 商人の商品</Text>
              <ScrollView style={styles.list}>
                <View style={styles.grid}>
                  {merchant.lineup.map((entry) => {
                    const def = ITEM_DEF_MAP[entry.itemId];
                    return (
                      <View style={styles.item} key={entry.itemId}>
                        <Text style={styles.itemIcon}>{def.emoji}</Text>
                        <Text style={styles.itemLabel}>{def.name}</Text>
                        <Text style={styles.itemValue}>
                          {def.buyPrice}G ×{entry.amount}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </ScrollView>

              {offerRecipe && offerItemDef && (
                <>
                  <Text style={styles.sectionLabel}>📜 レシピの提供</Text>
                  <View style={styles.recipeOfferCard}>
                    <Text style={styles.itemIcon}>{offerItemDef.emoji}</Text>
                    <View style={styles.recipeOfferTextWrap}>
                      <Text style={styles.itemLabel}>{offerItemDef.name}</Text>
                      <Text style={styles.recipeOfferSub}>まだ持っていないレシピを教えてくれます</Text>
                    </View>
                    <AnimatedPressable
                      style={[styles.recipeBuyButton, gold < recipeOffer!.price && styles.recipeBuyButtonDisabled]}
                      onPress={gold >= recipeOffer!.price ? onBuyRecipe : undefined}
                      disabled={gold < recipeOffer!.price}
                    >
                      <Text style={styles.recipeBuyButtonText}>{recipeOffer!.price}Gで購入</Text>
                    </AnimatedPressable>
                  </View>
                </>
              )}

              <Text style={styles.footNote}>
                💰 換金アイテム(宝石・金塊など)は、鳥がここに売ると代金の半分が街の資金になります。
              </Text>
            </>
          )}
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
  sectionLabel: { fontSize: 13, fontWeight: '800', color: theme.textPrimary, marginBottom: 8 },
  list: { maxHeight: 320 },
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
  itemValue: { fontSize: 12, fontWeight: '800', color: theme.textPrimary },
  emptyText: { fontSize: 12, color: theme.textMuted, paddingVertical: 12 },
  footNote: { fontSize: 11, color: theme.textMuted, marginTop: 12 },
  recipeOfferCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.cardAlt,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: theme.gold,
    padding: 10,
  },
  recipeOfferTextWrap: { flex: 1 },
  recipeOfferSub: { fontSize: 10, color: theme.textMuted, marginTop: 2 },
  recipeBuyButton: {
    backgroundColor: theme.gold,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  recipeBuyButtonDisabled: { backgroundColor: theme.disabled },
  recipeBuyButtonText: { color: '#fff', fontWeight: '700', fontSize: 12 },
});
