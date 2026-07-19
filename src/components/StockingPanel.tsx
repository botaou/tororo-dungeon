import React from 'react';
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

  // `ITEM_DEF_MAP[id] &&` guards against a stale/corrupted save holding a
  // warehouse key with no matching data/items.ts entry — same crash class
  // as BirdRosterModal's real-device `ITEM_DEF_MAP[k].emoji` report.
  const candidates = (Object.keys(items) as ItemId[]).filter(
    (id) => (items[id] ?? 0) > 0 && ITEM_DEF_MAP[id] && categoryFilter.includes(ITEM_DEF_MAP[id].category)
  );

  return (
    <ScrollView style={styles.list}>
      {candidates.length === 0 ? (
        <Text style={styles.emptyText}>倉庫に並べられる加工品がありません。先に加工してみましょう。</Text>
      ) : (
        candidates.map((id) => {
          const def = ITEM_DEF_MAP[id];
          const warehouseQty = items[id] ?? 0;
          const shelfQty = shopStock[shopKind][id] ?? 0;
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
              <AnimatedPressable style={styles.stockButton} onPress={() => stockItem(shopKind, id, warehouseQty)}>
                <Text style={styles.stockButtonText}>並べる({warehouseQty}個)</Text>
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
  stockButton: {
    backgroundColor: theme.gold,
    borderRadius: 999,
    paddingVertical: 9,
    alignItems: 'center',
  },
  stockButtonText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  emptyText: { fontSize: 12, color: theme.textMuted, paddingVertical: 12 },
});
