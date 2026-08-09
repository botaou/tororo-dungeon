import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';

import { ItemCategory, ItemId } from '../types';
import { ITEM_DEF_MAP } from '../data/items';
import { MYSTERY_GACHA_COST } from '../game/config';
import { usePlayerStore } from '../store/usePlayerStore';
import { AnimatedPressable } from './AnimatedPressable';
import { StockingPanel } from './StockingPanel';
import { theme } from '../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
}

type Mode = 'draw' | 'stock';

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

export function MysteryShopModal({ visible, onClose }: Props) {
  const gold = usePlayerStore((s) => s.gold);
  const drawMysteryItem = usePlayerStore((s) => s.drawMysteryItem);
  const [lastDrawn, setLastDrawn] = useState<ItemId | null>(null);
  const [mode, setMode] = useState<Mode>('draw');

  useEffect(() => {
    if (visible) setMode('draw');
  }, [visible]);

  const canAfford = gold >= MYSTERY_GACHA_COST;

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
              <Text style={[styles.tabButtonText, mode === 'stock' && styles.tabButtonTextActive]}>📦 品物を提供する</Text>
            </AnimatedPressable>
          </View>

          {mode === 'draw' ? (
            <>
              <Text style={styles.subtitle}>
                ゴールドを払うと、何が出るか分からない品物を1つ引き当てます。倉庫から品物を提供しておくと、その品物が出やすくなります。
              </Text>

              {lastDrawn && (
                <View style={styles.resultBox}>
                  <Text style={styles.resultEmoji}>{ITEM_DEF_MAP[lastDrawn].emoji}</Text>
                  <Text style={styles.resultName}>{ITEM_DEF_MAP[lastDrawn].name}が出た!</Text>
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
            </>
          ) : (
            <>
              <Text style={styles.subtitle}>倉庫の品物をこの店に提供すると、以後の抽選でその品物が出やすくなります。</Text>
              <StockingPanel shopKind="mystery" categoryFilter={ALL_ITEM_CATEGORIES} />
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
  resultEmoji: { fontSize: 36 },
  resultName: { fontSize: 14, fontWeight: '800', color: theme.textPrimary, marginTop: 6 },
  drawButton: { backgroundColor: theme.gold, borderRadius: 999, paddingVertical: 14, alignItems: 'center' },
  drawButtonDisabled: { backgroundColor: theme.cardBorder },
  drawButtonText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
