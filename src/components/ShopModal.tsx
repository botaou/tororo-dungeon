import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ItemId } from '../types';
import { ITEM_DEF_MAP } from '../data/items';
import { ACTIVE_SHOP, SHOP_DEFS } from '../data/shops';
import { AnimatedPressable } from './AnimatedPressable';
import { theme } from '../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  items: Partial<Record<ItemId, number>>;
}

// Birds already trade materials here on their own (selling surplus, buying
// a free basic ration when hungry) — this modal is the player-facing side:
// which shop this is, and what it's currently stocked with. The lineup is
// just the town's crafted-item warehouse filtered to this shop's genre —
// no separate "shop inventory" to maintain.
export function ShopModal({ visible, onClose, items }: Props) {
  const shop = SHOP_DEFS[ACTIVE_SHOP];
  const lineup = (Object.keys(items) as ItemId[])
    .filter((id) => (items[id] ?? 0) > 0 && shop.categories.includes(ITEM_DEF_MAP[id].category));

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
          <Text style={styles.bodySubText}>鳥たちが自分の判断で素材を売りに来ます。</Text>

          <Text style={styles.sectionLabel}>品揃え</Text>
          {lineup.length === 0 ? (
            <Text style={styles.emptyText}>まだ品揃えがありません。加工でアイテムを作ってみましょう。</Text>
          ) : (
            <ScrollView style={styles.list}>
              <View style={styles.grid}>
                {lineup.map((id) => {
                  const def = ITEM_DEF_MAP[id];
                  return (
                    <View style={styles.item} key={id}>
                      <Text style={styles.itemIcon}>{def.emoji}</Text>
                      <Text style={styles.itemLabel}>{def.name}</Text>
                      <Text style={styles.itemValue}>×{items[id]}</Text>
                    </View>
                  );
                })}
              </View>
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
    maxHeight: '75%',
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '800', color: theme.gold },
  closeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: theme.cardAlt,
    borderRadius: 999,
  },
  closeButtonText: { color: theme.blue, fontWeight: '700', fontSize: 13 },
  bodySubText: { fontSize: 12, color: theme.textSecondary, marginBottom: 4 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: theme.textSecondary, marginTop: 10, marginBottom: 8 },
  emptyText: { fontSize: 12, color: theme.textMuted, paddingBottom: 12 },
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
  itemValue: { fontSize: 14, fontWeight: '800', color: theme.textPrimary },
});
