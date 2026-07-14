import React, { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';

import { MaterialId, MerchantState } from '../types';
import { ITEM_DEF_MAP } from '../data/items';
import { CRAFTING_RECIPES } from '../data/recipes';
import { MATERIAL_ICON, MATERIAL_LABEL } from '../data/materials';
import { MATERIAL_SELL_PRICE } from '../data/marketPrices';
import { AnimatedPressable } from './AnimatedPressable';
import { theme } from '../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  merchant: MerchantState | null;
  gold: number;
  materials: Partial<Record<MaterialId, number>>;
  // Recipe-unlock route 1 ("商人が売りに来る") — the only merchant
  // interaction the player does directly rather than birds handling it
  // autonomously, since a recipe is player knowledge, not something a bird
  // carries. Returns false if the offer's gone or gold's insufficient.
  onBuyRecipe: () => boolean;
  // Player-initiated sale of some of the town warehouse's stock of one
  // material — a real-device request for a way to offload warehouse
  // material that wasn't tied to the random traveler or to birds selling
  // their own gathered stock. `amount` is however much the player picked
  // in this modal's own quantity stepper (see SELL_STEP below).
  onSellMaterial: (materialId: MaterialId, amount: number) => void;
}

// Step size for the +/- quantity stepper below, and the starting amount
// each material row defaults to. A real-device follow-up report: selling a
// material's *entire* stack in one tap by default risked accidentally
// selling off material the player still needed for crafting/building, so
// this lets the player dial in an amount instead — stepping by 10 keeps a
// few taps enough to reach a meaningful amount even against a stack in the
// hundreds, while "全部売る" is still there for a genuine full dump.
const SELL_STEP = 10;

// Mostly view-only, like the rest of the game's shops from the player's
// side — birds decide for themselves whether to buy from the shelf or sell
// their convertible treasure here (see game/ai.ts's executeMerchantSellTrip
// / executeMerchantBuyTrip). The one exception besides the recipe offer is
// selling warehouse material, which is squarely the player's own call (it's
// the town's shared stock, not a bird's personal find).
export function MerchantModal({ visible, onClose, merchant, gold, materials, onBuyRecipe, onSellMaterial }: Props) {
  const minutesLeft = merchant ? Math.max(0, Math.ceil((merchant.departsAt - Date.now()) / 60_000)) : 0;
  const recipeOffer = merchant?.recipeOffer ?? null;
  const offerRecipe = recipeOffer ? CRAFTING_RECIPES.find((r) => r.id === recipeOffer.recipeId) : null;
  const offerItemDef = offerRecipe ? ITEM_DEF_MAP[offerRecipe.resultItemId] : null;
  const sellableMaterials = (Object.keys(materials) as MaterialId[]).filter((id) => (materials[id] ?? 0) > 0);

  // Per-material selected sell quantity — undefined until the player first
  // touches that material's stepper, at which point it defaults to
  // min(stock, SELL_STEP). Kept here (not in the store) since it's purely
  // this modal's own transient UI state.
  const [sellAmounts, setSellAmounts] = useState<Partial<Record<MaterialId, number>>>({});
  const getSellAmount = (materialId: MaterialId, stock: number) => {
    const stored = sellAmounts[materialId];
    return Math.max(1, Math.min(stored ?? Math.min(stock, SELL_STEP), stock));
  };
  const adjustSellAmount = (materialId: MaterialId, stock: number, delta: number) => {
    const current = getSellAmount(materialId, stock);
    setSellAmounts((prev) => ({ ...prev, [materialId]: Math.max(1, Math.min(stock, current + delta)) }));
  };

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

              {sellableMaterials.length > 0 && (
                <>
                  <Text style={styles.sectionLabel}>🎒 倉庫の素材を売る</Text>
                  <ScrollView style={styles.sellList}>
                    {sellableMaterials.map((materialId) => {
                      const stock = materials[materialId] ?? 0;
                      const amount = getSellAmount(materialId, stock);
                      const unitPrice = MATERIAL_SELL_PRICE[materialId];
                      return (
                        <View style={styles.sellRow} key={materialId}>
                          <Text style={styles.itemIcon}>{MATERIAL_ICON[materialId]}</Text>
                          <View style={styles.sellRowTextWrap}>
                            <Text style={styles.itemLabel}>{MATERIAL_LABEL[materialId]}</Text>
                            <Text style={styles.recipeOfferSub}>在庫 {stock}個 × {unitPrice}G</Text>
                            <View style={styles.stepperRow}>
                              <AnimatedPressable
                                style={[styles.stepperButton, amount <= 1 && styles.stepperButtonDisabled]}
                                onPress={() => adjustSellAmount(materialId, stock, -SELL_STEP)}
                                disabled={amount <= 1}
                              >
                                <Text style={styles.stepperButtonText}>−</Text>
                              </AnimatedPressable>
                              <Text style={styles.stepperValue}>{amount}</Text>
                              <AnimatedPressable
                                style={[styles.stepperButton, amount >= stock && styles.stepperButtonDisabled]}
                                onPress={() => adjustSellAmount(materialId, stock, SELL_STEP)}
                                disabled={amount >= stock}
                              >
                                <Text style={styles.stepperButtonText}>＋</Text>
                              </AnimatedPressable>
                            </View>
                          </View>
                          <View style={styles.sellButtonCol}>
                            <AnimatedPressable style={styles.sellButton} onPress={() => onSellMaterial(materialId, amount)}>
                              <Text style={styles.sellButtonText}>{amount * unitPrice}Gで売る</Text>
                            </AnimatedPressable>
                            <AnimatedPressable
                              style={styles.sellAllButton}
                              onPress={() => onSellMaterial(materialId, stock)}
                            >
                              <Text style={styles.sellAllButtonText}>全部売る</Text>
                            </AnimatedPressable>
                          </View>
                        </View>
                      );
                    })}
                  </ScrollView>
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
  sellList: { maxHeight: 180 },
  sellRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.cardAlt,
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
  },
  sellRowTextWrap: { flex: 1 },
  sellButton: {
    backgroundColor: theme.gold,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  sellButtonText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  stepperButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonDisabled: { opacity: 0.4 },
  stepperButtonText: { color: theme.textPrimary, fontWeight: '800', fontSize: 14, lineHeight: 16 },
  stepperValue: { fontSize: 13, fontWeight: '800', color: theme.textPrimary, minWidth: 34, textAlign: 'center' },
  sellButtonCol: { gap: 6, alignItems: 'stretch' },
  sellAllButton: {
    backgroundColor: theme.cardBorder,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  sellAllButtonText: { color: theme.textSecondary, fontWeight: '700', fontSize: 11, textAlign: 'center' },
});
