import React, { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ItemId, ShopKind } from '../types';
import { ITEM_DEF_MAP } from '../data/items';
import { SHOP_DEFS } from '../data/shops';
import { usePlayerStore } from '../store/usePlayerStore';
import { CraftingPanel } from './CraftingPanel';
import { StockingPanel } from './StockingPanel';
import { AnimatedPressable } from './AnimatedPressable';
import { theme } from '../theme';

type Mode = 'menu' | 'craft' | 'stock' | 'view';

interface Props {
  visible: boolean;
  onClose: () => void;
  shopKind: ShopKind | null;
}

// Tapping a shop opens this menu first — what kind of shop it is, and what
// the player can do here — rather than jumping straight to a feature. Both
// shop buildings share this component; only the shopKind (and therefore
// which categories/recipes apply) differs.
export function ShopModal({ visible, onClose, shopKind }: Props) {
  const [mode, setMode] = useState<Mode>('menu');
  const shopStock = usePlayerStore((s) => s.shopStock);

  // Reset back to the menu each time a different shop (or the same shop
  // again) is opened, rather than reopening on whatever sub-screen was
  // left open last time.
  useEffect(() => {
    if (visible) setMode('menu');
  }, [visible, shopKind]);

  if (!shopKind) return null;
  const shop = SHOP_DEFS[shopKind];

  // `&& ITEM_DEF_MAP[id]` guards against a stale/corrupted save holding a
  // shopStock key with no matching data/items.ts entry — same crash class
  // as BirdRosterModal's real-device `ITEM_DEF_MAP[k].emoji` report.
  const lineup = (Object.keys(shopStock[shopKind]) as ItemId[]).filter(
    (id) => (shopStock[shopKind][id] ?? 0) > 0 && ITEM_DEF_MAP[id]
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {shop.emoji} {shop.name}
            </Text>
            <AnimatedPressable onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>閉じる</Text>
            </AnimatedPressable>
          </View>

          {mode !== 'menu' && (
            <AnimatedPressable style={styles.backButton} onPress={() => setMode('menu')}>
              <Text style={styles.backButtonText}>← もどる</Text>
            </AnimatedPressable>
          )}

          {mode === 'menu' && (
            <View style={styles.menu}>
              <Text style={styles.bodySubText}>鳥たちが自分の判断でここを利用します。</Text>
              <AnimatedPressable style={styles.menuButton} onPress={() => setMode('craft')}>
                <Text style={styles.menuButtonText}>🛠️ 加工する</Text>
              </AnimatedPressable>
              <AnimatedPressable style={styles.menuButton} onPress={() => setMode('stock')}>
                <Text style={styles.menuButtonText}>📦 商品を並べる</Text>
              </AnimatedPressable>
              <AnimatedPressable style={styles.menuButton} onPress={() => setMode('view')}>
                <Text style={styles.menuButtonText}>👀 在庫を見る</Text>
              </AnimatedPressable>
            </View>
          )}

          {mode === 'craft' && <CraftingPanel categoryFilter={shop.categories} />}
          {mode === 'stock' && <StockingPanel shopKind={shopKind} categoryFilter={shop.categories} />}
          {mode === 'view' && (
            <ScrollView style={styles.list}>
              {lineup.length === 0 ? (
                <Text style={styles.emptyText}>まだ品揃えがありません。加工して商品を並べてみましょう。</Text>
              ) : (
                <View style={styles.grid}>
                  {lineup.map((id) => {
                    const def = ITEM_DEF_MAP[id];
                    return (
                      <View style={styles.item} key={id}>
                        <Text style={styles.itemIcon}>{def.emoji}</Text>
                        <Text style={styles.itemLabel}>{def.name}</Text>
                        <Text style={styles.itemValue}>×{shopStock[shopKind][id]}</Text>
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
  closeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: theme.cardAlt,
    borderRadius: 999,
  },
  closeButtonText: { color: theme.blue, fontWeight: '700', fontSize: 13 },
  backButton: { alignSelf: 'flex-start', marginBottom: 10 },
  backButtonText: { color: theme.blue, fontWeight: '700', fontSize: 13 },
  bodySubText: { fontSize: 12, color: theme.textSecondary, marginBottom: 12 },
  menu: { gap: 10 },
  menuButton: {
    backgroundColor: theme.cardAlt,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: theme.cardBorder,
    paddingVertical: 14,
    alignItems: 'center',
  },
  menuButtonText: { fontSize: 14, fontWeight: '800', color: theme.textPrimary },
  list: { maxHeight: 400 },
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
  emptyText: { fontSize: 12, color: theme.textMuted, paddingBottom: 12 },
});
