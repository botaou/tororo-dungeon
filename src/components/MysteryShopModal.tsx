import React, { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ItemCategory, ItemId } from '../types';
import { ITEM_DEF_MAP, RARITY_COLORS, RARITY_LABELS } from '../data/items';
import { MYSTERY_GACHA_COST, MYSTERY_PITY_THRESHOLD } from '../game/config';
import { usePlayerStore } from '../store/usePlayerStore';
import { AnimatedPressable } from './AnimatedPressable';
import { StockingPanel } from './StockingPanel';
import { theme } from '../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
}

type Mode = 'draw' | 'stock' | 'view';

// 怪しいアイテム屋(mystery item shop) — Phase 15③'s gacha-style draw: pay a
// flat gold price for one random item, reusing the visiting merchant's own
// rare/common pool split (see usePlayerStore's drawMysteryItem).
//
// 経営要素①(続き): the player can also put warehouse items on this shop's
// shelf (via the same generic StockingPanel every other shop uses —
// shopStock is already typed over every ShopKind including 'mystery', so no
// new store scaffolding was needed here unlike the clothing-shop case).
// Stocked items don't turn this into a plain shelf sale, though — the
// shop's whole identity is "randomized lineup", so instead drawMysteryItem
// gives the shelf a chance to be drawn from instead of the baseline pool
// (see config.ts's MYSTERY_STOCKED_DRAW_CHANCE). No categoryFilter
// restriction to 'rare' items only: those (luckyCharm/ancientGem/etc.) flow
// bird-carried straight to the visiting merchant and essentially never sit
// in the town warehouse in normal play, which would leave the stocking list
// empty almost all the time — any warehouse item can be offered here.
const ALL_ITEM_CATEGORIES: ItemCategory[] = ['weapon', 'head', 'body', 'hand', 'foot', 'rare', 'food', 'toy'];

// UX改善: real-device/player feedback was that the shelf-priority mechanic
// alone didn't make individual draws feel any more exciting — it only
// changed *which* item came out, not the moment-to-moment feel of pulling.
// Added on top of it: (a) a distinct celebratory result box per
// ItemDef.rarity tier (see usePlayerStore.drawMysteryItem, which now always
// returns something whose rarity the UI can react to), and (b) a visible
// pity-counter readout so there's a sense of anticipation building toward a
// guaranteed rare, not just blind luck every time.
export function MysteryShopModal({ visible, onClose }: Props) {
  const gold = usePlayerStore((s) => s.gold);
  const drawMysteryItem = usePlayerStore((s) => s.drawMysteryItem);
  const mysteryPityCount = usePlayerStore((s) => s.mysteryPityCount);
  const shopStock = usePlayerStore((s) => s.shopStock);
  const [lastDrawn, setLastDrawn] = useState<ItemId | null>(null);
  const [mode, setMode] = useState<Mode>('draw');

  useEffect(() => {
    if (visible) setMode('draw');
  }, [visible]);

  const canAfford = gold >= MYSTERY_GACHA_COST;
  const lastDrawnDef = lastDrawn ? ITEM_DEF_MAP[lastDrawn] : null;
  const pityRemaining = Math.max(0, MYSTERY_PITY_THRESHOLD - mysteryPityCount);

  const lineup = (Object.keys(shopStock.mystery) as ItemId[]).filter(
    (id) => (shopStock.mystery[id] ?? 0) > 0 && ITEM_DEF_MAP[id]
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>🔮 怪しいアイテム屋</Text>
            <AnimatedPressable onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>閉じる</Text>
            </AnimatedPressable>
          </View>

          <View style={styles.tabRow}>
            <AnimatedPressable style={[styles.tabButton, mode === 'draw' && styles.tabButtonActive]} onPress={() => setMode('draw')}>
              <Text style={[styles.tabButtonText, mode === 'draw' && styles.tabButtonTextActive]}>🔮 引く</Text>
            </AnimatedPressable>
            <AnimatedPressable style={[styles.tabButton, mode === 'stock' && styles.tabButtonActive]} onPress={() => setMode('stock')}>
              <Text style={[styles.tabButtonText, mode === 'stock' && styles.tabButtonTextActive]}>📦 提供する</Text>
            </AnimatedPressable>
            <AnimatedPressable style={[styles.tabButton, mode === 'view' && styles.tabButtonActive]} onPress={() => setMode('view')}>
              <Text style={[styles.tabButtonText, mode === 'view' && styles.tabButtonTextActive]}>👀 提供中</Text>
            </AnimatedPressable>
          </View>

          {mode === 'draw' && (
            <>
              <Text style={styles.subtitle}>
                ゴールドを払うと、何が出るか分からない品物を1つ引き当てます。倉庫から品物を提供しておくと、その品物が出やすくなります。
              </Text>

              {lastDrawnDef && (
                <View
                  style={[
                    styles.resultBox,
                    lastDrawnDef.rarity === 'rare' && styles.resultBoxRare,
                    lastDrawnDef.rarity === 'uncommon' && styles.resultBoxUncommon,
                  ]}
                >
                  {lastDrawnDef.rarity === 'rare' && <Text style={styles.resultBanner}>🌟激レア!🌟</Text>}
                  {lastDrawnDef.rarity === 'uncommon' && <Text style={styles.resultBannerUncommon}>✨掘り出し物!✨</Text>}
                  <Text style={[styles.resultEmoji, lastDrawnDef.rarity === 'rare' && styles.resultEmojiRare]}>
                    {lastDrawnDef.emoji}
                  </Text>
                  <Text style={styles.resultName}>{lastDrawnDef.name}が出た!</Text>
                  <Text style={[styles.resultRarity, { color: RARITY_COLORS[lastDrawnDef.rarity] }]}>
                    {RARITY_LABELS[lastDrawnDef.rarity]}
                  </Text>
                </View>
              )}

              <AnimatedPressable
                style={[styles.drawButton, !canAfford && styles.drawButtonDisabled]}
                disabled={!canAfford}
                onPress={() => {
                  const result = drawMysteryItem();
                  if (result) setLastDrawn(result);
                }}
              >
                <Text style={styles.drawButtonText}>{canAfford ? `🔮 引く(${MYSTERY_GACHA_COST}G)` : 'ゴールドが足りません'}</Text>
              </AnimatedPressable>
              <Text style={styles.pityHint}>
                {pityRemaining <= 0
                  ? '✨ 次はレア確定です!'
                  : `🎯 次のレア確定まであと${pityRemaining}回(ハズレが続くほど確定に近づきます)`}
              </Text>
            </>
          )}

          {mode === 'stock' && (
            <>
              <Text style={styles.subtitle}>倉庫の品物をこの店に提供すると、以後の抽選でその品物が出やすくなります。</Text>
              <StockingPanel shopKind="mystery" categoryFilter={ALL_ITEM_CATEGORIES} />
            </>
          )}

          {mode === 'view' && (
            <ScrollView style={styles.list}>
              {lineup.length === 0 ? (
                <Text style={styles.emptyText}>まだ何も提供していません。「提供する」タブから品物を並べてみましょう。</Text>
              ) : (
                <View style={styles.grid}>
                  {lineup.map((id) => {
                    const def = ITEM_DEF_MAP[id];
                    return (
                      <View style={styles.item} key={id}>
                        <Text style={styles.itemIcon}>{def.emoji}</Text>
                        <Text style={styles.itemLabel}>{def.name}</Text>
                        <Text style={styles.itemValue}>×{shopStock.mystery[id]}</Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </ScrollView>
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
  closeButton: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: theme.cardAlt, borderRadius: 999 },
  tabRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  tabButton: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: theme.cardAlt,
    borderWidth: 1.5,
    borderColor: theme.cardBorder,
    alignItems: 'center',
  },
  tabButtonActive: { backgroundColor: theme.gold, borderColor: theme.gold },
  tabButtonText: { fontSize: 12, fontWeight: '700', color: theme.textSecondary },
  tabButtonTextActive: { color: '#fff' },
  closeButtonText: { color: theme.blue, fontWeight: '700', fontSize: 13 },
  subtitle: { fontSize: 12, color: theme.textSecondary, marginBottom: 16 },
  resultBox: {
    alignItems: 'center',
    backgroundColor: theme.cardAlt,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: theme.gold,
    paddingVertical: 16,
    marginBottom: 16,
  },
  resultBoxUncommon: { borderColor: theme.green, borderWidth: 2, backgroundColor: '#eefaef' },
  resultBoxRare: { borderColor: theme.pink, borderWidth: 2.5, backgroundColor: '#fff0f5' },
  resultBanner: { fontSize: 14, fontWeight: '800', color: theme.pink, marginBottom: 4 },
  resultBannerUncommon: { fontSize: 12, fontWeight: '800', color: theme.green, marginBottom: 4 },
  resultEmoji: { fontSize: 36 },
  resultEmojiRare: { fontSize: 48 },
  resultName: { fontSize: 14, fontWeight: '800', color: theme.textPrimary, marginTop: 6 },
  resultRarity: { fontSize: 11, fontWeight: '800', marginTop: 4 },
  drawButton: { backgroundColor: theme.gold, borderRadius: 999, paddingVertical: 14, alignItems: 'center' },
  drawButtonDisabled: { backgroundColor: theme.cardBorder },
  drawButtonText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  pityHint: { fontSize: 11, color: theme.textMuted, textAlign: 'center', marginTop: 10 },
  list: { maxHeight: 400 },
  emptyText: { fontSize: 12, color: theme.textMuted, paddingBottom: 12 },
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
