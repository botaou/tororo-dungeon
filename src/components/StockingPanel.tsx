import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ItemCategory, ItemId, ShopKind } from '../types';
import { ITEM_DEF_MAP } from '../data/items';
import { usePlayerStore } from '../store/usePlayerStore';
import { AnimatedPressable } from './AnimatedPressable';
import { theme } from '../theme';

// "商品を並べる" — move crafted items sitting in the town's back-room
// warehouse onto a specific shop's shelf, where birds can actually buy
// them. Only shows items that genre-match this shop and that the
// warehouse currently holds at least one of.
interface Props {
  shopKind: ShopKind;
  categoryFilter: ItemCategory[];
}

export function StockingPanel({ shopKind, categoryFilter }: Props) {
  const items = usePlayerStore((s) => s.items);
  const shopStock = usePlayerStore((s) => s.shopStock);
  const stockItem = usePlayerStore((s) => s.stockItem);

  // Player-chosen quantity per item, keyed by ItemId — defaults to "all of
  // it" (see `selectedQty` below) until the player taps -/+ to adjust it.
  // Kept as a local override map rather than always deriving from
  // warehouseQty so a partial choice survives the warehouse count changing
  // underneath it (e.g. crafting more while this panel is open) without
  // snapping back to "all".
  const [quantityOverrides, setQuantityOverrides] = useState<Partial<Record<ItemId, number>>>({});

  // `ITEM_DEF_MAP[id] &&` guards against a stale/corrupted save holding a
  // warehouse key with no matching data/items.ts entry — same crash class
  // as BirdRosterModal's real-device `ITEM_DEF_MAP[k].emoji` report.
  const candidates = (Object.keys(items) as ItemId[]).filter(
    (id) => (items[id] ?? 0) > 0 && ITEM_DEF_MAP[id] && categoryFilter.includes(ITEM_DEF_MAP[id].category)
  );

  const adjustQty = (id: ItemId, warehouseQty: number, delta: number) => {
    setQuantityOverrides((prev) => {
      const current = Math.min(prev[id] ?? warehouseQty, warehouseQty);
      const next = Math.max(1, Math.min(warehouseQty, current + delta));
      return { ...prev, [id]: next };
    });
  };

  return (
    <ScrollView style={styles.list}>
      {candidates.length === 0 ? (
        <Text style={styles.emptyText}>倉庫に並べられる加工品がありません。先に加工してみましょう。</Text>
      ) : (
        candidates.map((id) => {
          const def = ITEM_DEF_MAP[id];
          const warehouseQty = items[id] ?? 0;
          const shelfQty = shopStock[shopKind][id] ?? 0;
          // Clamp against the current warehouseQty every render (not just
          // on adjust) so a stale override from before a craft/sale never
          // exceeds what's actually available.
          const selectedQty = Math.min(quantityOverrides[id] ?? warehouseQty, warehouseQty);
          return (
            <View key={id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardEmoji}>{def.emoji}</Text>
                <View style={styles.cardHeaderText}>
                  <Text style={styles.cardName}>{def.name}</Text>
                  <Text style={styles.cardSub}>
                    倉庫に{warehouseQty}個・店頭に{shelfQty}個
                  </Text>
                </View>
              </View>
              <View style={styles.qtyRow}>
                <AnimatedPressable
                  style={[styles.qtyButton, selectedQty <= 1 && styles.qtyButtonDisabled]}
                  disabled={selectedQty <= 1}
                  onPress={() => adjustQty(id, warehouseQty, -1)}
                >
                  <Text style={styles.qtyButtonText}>−</Text>
                </AnimatedPressable>
                <Text style={styles.qtyValue}>{selectedQty}</Text>
                <AnimatedPressable
                  style={[styles.qtyButton, selectedQty >= warehouseQty && styles.qtyButtonDisabled]}
                  disabled={selectedQty >= warehouseQty}
                  onPress={() => adjustQty(id, warehouseQty, 1)}
                >
                  <Text style={styles.qtyButtonText}>+</Text>
                </AnimatedPressable>
                <AnimatedPressable
                  style={styles.qtyAllButton}
                  onPress={() => setQuantityOverrides((prev) => ({ ...prev, [id]: warehouseQty }))}
                >
                  <Text style={styles.qtyAllButtonText}>全部</Text>
                </AnimatedPressable>
              </View>
              <AnimatedPressable
                style={styles.stockButton}
                onPress={() => {
                  if (stockItem(shopKind, id, selectedQty)) {
                    setQuantityOverrides((prev) => {
                      const { [id]: _removed, ...rest } = prev;
                      return rest;
                    });
                  }
                }}
              >
                <Text style={styles.stockButtonText}>並べる({selectedQty}個)</Text>
              </AnimatedPressable>
            </View>
          );
        })
      )}
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
  cardSub: { fontSize: 11, color: theme.textMuted, marginTop: 1 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  qtyButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: theme.card,
    borderWidth: 1.5,
    borderColor: theme.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyButtonDisabled: { opacity: 0.4 },
  qtyButtonText: { fontSize: 16, fontWeight: '800', color: theme.textPrimary },
  qtyValue: { fontSize: 15, fontWeight: '800', color: theme.textPrimary, minWidth: 32, textAlign: 'center' },
  qtyAllButton: {
    marginLeft: 'auto',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: theme.card,
    borderWidth: 1.5,
    borderColor: theme.cardBorder,
  },
  qtyAllButtonText: { fontSize: 11, fontWeight: '700', color: theme.textSecondary },
  stockButton: {
    backgroundColor: theme.gold,
    borderRadius: 999,
    paddingVertical: 9,
    alignItems: 'center',
  },
  stockButtonText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  emptyText: { fontSize: 12, color: theme.textMuted, paddingVertical: 12 },
});
