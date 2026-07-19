import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BirdState, EquipSlot, ItemId } from '../types';
import { ITEM_DEF_MAP, ITEM_DEFS, CONVERTIBLE_ITEM_IDS } from '../data/items';
import { getCharacterDef } from '../data/characters';
import { HOUSE_FOOD_CAP, HOUSE_TREASURE_CAP } from '../game/config';
import { AnimatedPressable } from './AnimatedPressable';
import { theme } from '../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  bird: BirdState | null;
  // The town warehouse's items — food deposit candidates are drawn from
  // here (only food-category entries with stock > 0).
  playerItems: Partial<Record<ItemId, number>>;
  onDepositFood: (defId: string, itemId: ItemId, amount: number) => boolean;
  onWithdrawFood: (defId: string, itemId: ItemId, amount: number) => boolean;
  onFavoriteTreasure: (defId: string, itemId: ItemId) => boolean;
  onUnfavoriteTreasure: (defId: string, itemId: ItemId) => boolean;
}

const EQUIP_SLOTS: EquipSlot[] = ['weapon', 'head', 'body', 'hand', 'foot'];

// A bird's own house — tapped into from its map sprite. Three sections:
// spare equipment (read-only view of `items`, nothing to manage since
// there's no carry limit on gear), food stock (deposit from the warehouse/
// withdraw back, eaten before a shop trip — see ai.ts's stepBird), and
// favorite treasure (moved out of `items` entirely so autonomous merchant
// sales can never touch it — see useWorldStore's favoriteTreasure).
export function HouseInventoryModal({
  visible,
  onClose,
  bird,
  playerItems,
  onDepositFood,
  onWithdrawFood,
  onFavoriteTreasure,
  onUnfavoriteTreasure,
}: Props) {
  if (!bird) return null;
  const def = getCharacterDef(bird.defId);

  // Both filters below guard against a stale/corrupted save holding a key
  // with no matching data/items.ts entry — useBirdEconomyStore's getWallet()
  // already prunes those from `items`/`houseFood`, but this keeps the
  // render itself safe on its own (see BirdRosterModal's own comment on the
  // real-device `ITEM_DEF_MAP[k].emoji` crash this class of bug caused).
  const equipmentRows = EQUIP_SLOTS.flatMap((slot) => {
    const equippedId = bird.equipment[slot];
    return (Object.entries(bird.items) as [ItemId, number][])
      .filter(([itemId, amount]) => ITEM_DEF_MAP[itemId]?.category === slot && (amount ?? 0) > 0)
      .map(([itemId, amount]) => ({ itemId, amount: amount ?? 0, isEquipped: itemId === equippedId }));
  });

  const houseFoodTotal = Object.values(bird.houseFood).reduce((sum, a) => sum + (a ?? 0), 0);
  const houseFoodEntries = (Object.entries(bird.houseFood) as [ItemId, number][]).filter(
    ([itemId, a]) => (a ?? 0) > 0 && ITEM_DEF_MAP[itemId]
  );
  const warehouseFoodCandidates = ITEM_DEFS.filter((d) => d.category === 'food' && (playerItems[d.id] ?? 0) > 0);

  const favoriteCounts: Partial<Record<ItemId, number>> = {};
  for (const itemId of bird.houseTreasureIds) favoriteCounts[itemId] = (favoriteCounts[itemId] ?? 0) + 1;
  const treasureCandidates = CONVERTIBLE_ITEM_IDS.filter((id) => (bird.items[id] ?? 0) > 0);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {def.emoji} {bird.name}の家
            </Text>
            <AnimatedPressable onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>閉じる</Text>
            </AnimatedPressable>
          </View>

          <ScrollView style={styles.scroll}>
            <Text style={styles.sectionLabel}>⚔️ 装備品のストック</Text>
            {equipmentRows.length === 0 ? (
              <Text style={styles.emptyText}>予備の装備は持っていません。</Text>
            ) : (
              <View style={styles.grid}>
                {equipmentRows.map(({ itemId, amount, isEquipped }) => (
                  <View style={styles.equipCard} key={itemId}>
                    <Text style={styles.itemIcon}>{ITEM_DEF_MAP[itemId].emoji}</Text>
                    <Text style={styles.itemLabel}>{ITEM_DEF_MAP[itemId].name}</Text>
                    <Text style={styles.itemValue}>
                      {isEquipped ? `装備中${amount > 1 ? ` +予備${amount - 1}` : ''}` : `予備 ×${amount}`}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.divider} />

            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionLabel}>🌾 ご飯のストック</Text>
              <Text style={styles.capText}>
                {houseFoodTotal}/{HOUSE_FOOD_CAP}
              </Text>
            </View>
            {houseFoodEntries.length === 0 ? (
              <Text style={styles.emptyText}>備蓄はありません。お腹がすくとすぐ店へ行きます。</Text>
            ) : (
              houseFoodEntries.map(([itemId, amount]) => (
                <View style={styles.row} key={`stock-${itemId}`}>
                  <Text style={styles.itemIcon}>{ITEM_DEF_MAP[itemId].emoji}</Text>
                  <View style={styles.rowTextWrap}>
                    <Text style={styles.itemLabel}>{ITEM_DEF_MAP[itemId].name}</Text>
                    <Text style={styles.subText}>備蓄 {amount}個</Text>
                  </View>
                  <AnimatedPressable style={styles.smallButton} onPress={() => onWithdrawFood(bird.defId, itemId, 1)}>
                    <Text style={styles.smallButtonText}>戻す</Text>
                  </AnimatedPressable>
                </View>
              ))
            )}
            {warehouseFoodCandidates.length > 0 && (
              <>
                <Text style={styles.subSectionLabel}>倉庫から入れる</Text>
                {warehouseFoodCandidates.map((d) => {
                  const stock = playerItems[d.id] ?? 0;
                  const disabled = houseFoodTotal >= HOUSE_FOOD_CAP;
                  return (
                    <View style={styles.row} key={`deposit-${d.id}`}>
                      <Text style={styles.itemIcon}>{d.emoji}</Text>
                      <View style={styles.rowTextWrap}>
                        <Text style={styles.itemLabel}>{d.name}</Text>
                        <Text style={styles.subText}>倉庫の在庫 {stock}個</Text>
                      </View>
                      <AnimatedPressable
                        style={[styles.smallButton, disabled && styles.smallButtonDisabled]}
                        onPress={disabled ? undefined : () => onDepositFood(bird.defId, d.id, 1)}
                        disabled={disabled}
                      >
                        <Text style={styles.smallButtonText}>しまう</Text>
                      </AnimatedPressable>
                    </View>
                  );
                })}
              </>
            )}

            <View style={styles.divider} />

            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionLabel}>💎 お気に入りのお宝</Text>
              <Text style={styles.capText}>
                {bird.houseTreasureIds.length}/{HOUSE_TREASURE_CAP}
              </Text>
            </View>
            <Text style={styles.footNote}>ここに入れたお宝は、商人への自動売却の対象になりません。</Text>
            {bird.houseTreasureIds.length === 0 ? (
              <Text style={styles.emptyText}>お気に入りはまだありません。</Text>
            ) : (
              (Object.entries(favoriteCounts) as [ItemId, number][]).map(([itemId, count]) => (
                <View style={styles.row} key={`fav-${itemId}`}>
                  <Text style={styles.itemIcon}>{ITEM_DEF_MAP[itemId].emoji}</Text>
                  <View style={styles.rowTextWrap}>
                    <Text style={styles.itemLabel}>{ITEM_DEF_MAP[itemId].name}</Text>
                    <Text style={styles.subText}>{count}個</Text>
                  </View>
                  <AnimatedPressable style={styles.smallButton} onPress={() => onUnfavoriteTreasure(bird.defId, itemId)}>
                    <Text style={styles.smallButtonText}>手放す</Text>
                  </AnimatedPressable>
                </View>
              ))
            )}
            {treasureCandidates.length > 0 && (
              <>
                <Text style={styles.subSectionLabel}>持ち物から入れる</Text>
                {treasureCandidates.map((itemId) => {
                  const owned = bird.items[itemId] ?? 0;
                  const disabled = bird.houseTreasureIds.length >= HOUSE_TREASURE_CAP;
                  return (
                    <View style={styles.row} key={`candidate-${itemId}`}>
                      <Text style={styles.itemIcon}>{ITEM_DEF_MAP[itemId].emoji}</Text>
                      <View style={styles.rowTextWrap}>
                        <Text style={styles.itemLabel}>{ITEM_DEF_MAP[itemId].name}</Text>
                        <Text style={styles.subText}>持ち物 {owned}個</Text>
                      </View>
                      <AnimatedPressable
                        style={[styles.smallButton, disabled && styles.smallButtonDisabled]}
                        onPress={disabled ? undefined : () => onFavoriteTreasure(bird.defId, itemId)}
                        disabled={disabled}
                      >
                        <Text style={styles.smallButtonText}>入れる</Text>
                      </AnimatedPressable>
                    </View>
                  );
                })}
              </>
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
  title: { fontSize: 18, fontWeight: '800', color: theme.textPrimary },
  closeButton: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: theme.cardAlt, borderRadius: 999 },
  closeButtonText: { color: theme.blue, fontWeight: '700', fontSize: 13 },
  scroll: { maxHeight: 460 },
  sectionLabel: { fontSize: 13, fontWeight: '800', color: theme.textPrimary, marginBottom: 8 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  capText: { fontSize: 12, fontWeight: '700', color: theme.textMuted },
  subSectionLabel: { fontSize: 11, fontWeight: '700', color: theme.textMuted, marginTop: 8, marginBottom: 6 },
  divider: { height: 1, backgroundColor: theme.divider, marginVertical: 14 },
  emptyText: { fontSize: 12, color: theme.textMuted, paddingVertical: 6 },
  footNote: { fontSize: 11, color: theme.textMuted, marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  equipCard: {
    width: '30%',
    backgroundColor: theme.cardAlt,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    gap: 2,
  },
  itemIcon: { fontSize: 20 },
  itemLabel: { fontSize: 10, color: theme.textSecondary },
  itemValue: { fontSize: 11, fontWeight: '800', color: theme.textPrimary, textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.cardAlt,
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
  },
  rowTextWrap: { flex: 1 },
  subText: { fontSize: 10, color: theme.textMuted, marginTop: 2 },
  smallButton: { backgroundColor: theme.gold, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  smallButtonDisabled: { backgroundColor: theme.disabled },
  smallButtonText: { color: '#fff', fontWeight: '700', fontSize: 12 },
});
