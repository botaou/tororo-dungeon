import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BirdState, EquipSlot, ItemId, MaterialId } from '../types';
import { CHARACTERS } from '../data/characters';
import { MATERIAL_ICON } from '../data/materials';
import { ITEM_DEF_MAP, RARITY_COLORS } from '../data/items';
import { COSMETIC_ITEMS } from '../data/cosmetics';
import { useCosmeticStore } from '../store/useCosmeticStore';
import { getMoodDef } from '../data/moods';
import { getBirdGoalLabel, getBirdStatusLabel } from '../game/birdStatus';
import { getEffectiveStats } from '../game/birdStats';
import { BIRD_SKILL_DEF_MAP } from '../data/skills';
import { expToNextLevel, HOUSELESS_SULK_TICKS, HOUSELESS_WARNING_TICKS } from '../game/config';
import { AnimatedPressable } from './AnimatedPressable';
import { CharacterAvatar } from './CharacterAvatar';
import { theme } from '../theme';

const EQUIP_SLOT_ORDER: { slot: EquipSlot; emptyIcon: string }[] = [
  { slot: 'weapon', emptyIcon: '🗡️' },
  { slot: 'head', emptyIcon: '🧢' },
  { slot: 'body', emptyIcon: '🛡️' },
  { slot: 'hand', emptyIcon: '🧤' },
  { slot: 'foot', emptyIcon: '👟' },
];

interface Props {
  visible: boolean;
  onClose: () => void;
  birds: BirdState[];
  // Look-only costume change (see data/cosmetics.ts) — always available to
  // any bird, no cost/ownership check (out of scope for this pass), never
  // touches the stats shown in statsRow above.
  onSetCosmetic: (defId: string, cosmeticId: string | null) => void;
  // Phase 14: opens GiftBirdModal for this bird — TownScreen closes this
  // modal first rather than stacking GiftBirdModal on top of it (two native
  // Modals visible at once has been a real dead-taps bug in this app
  // before, see the README's own bugfix notes).
  onGiftBird: (defId: string) => void;
}

export function BirdRosterModal({ visible, onClose, birds, onSetCosmetic, onGiftBird }: Props) {
  const unlockedCosmeticIds = useCosmeticStore((s) => s.unlockedCosmeticIds);
  // Only ever offers already-unlocked costumes for wearing — the rest need
  // to be found/dropped/crafted then gifted first (see
  // CostumeCollectionModal, useCosmeticStore).
  const wearableCosmetics = COSMETIC_ITEMS.filter((c) => unlockedCosmeticIds.includes(c.id));
  const lockedCount = COSMETIC_ITEMS.length - wearableCosmetics.length;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>🐦 鳥たちのようす</Text>
            <AnimatedPressable onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>閉じる</Text>
            </AnimatedPressable>
          </View>
          <ScrollView style={styles.list}>
            {CHARACTERS.map((c) => {
              const bird = birds.find((b) => b.defId === c.id);
              if (!bird) return null;
              const owned = (Object.keys(bird.inventory) as MaterialId[]).filter((k) => bird.inventory[k] > 0);
              // The `&& ITEM_DEF_MAP[k]` guard is defense-in-depth: useBirdEconomyStore's
              // getWallet() already prunes any items key with no matching data/items.ts
              // entry (real-device crash — a stale/corrupted save had a key ITEM_DEF_MAP
              // didn't recognize, and `ITEM_DEF_MAP[k].emoji` below crashed the whole
              // roster screen), but this keeps the render itself safe even if that
              // healing step is ever bypassed or a future save path skips it.
              const ownedItems = (Object.keys(bird.items) as ItemId[]).filter((k) => (bird.items[k] ?? 0) > 0 && ITEM_DEF_MAP[k]);
              const moodLabel = getMoodDef(bird.mood).label;
              const stats = getEffectiveStats(bird);
              return (
                <View key={c.id} style={[styles.card, { borderColor: c.color }]}>
                  <View style={styles.cardHeader}>
                    <CharacterAvatar characterId={c.id} emoji={c.emoji} color={c.color} size={48} cosmeticId={bird.cosmeticId} />
                    <View style={styles.cardHeaderText}>
                      <Text style={styles.cardName}>
                        {bird.name} <Text style={styles.cardLevel}>Lv{bird.level}</Text>
                      </Text>
                      <Text style={styles.cardExp}>
                        EXP {bird.exp}/{expToNextLevel(bird.level)}
                      </Text>
                    </View>
                    <Text style={styles.cardGold}>🪙{bird.gold}</Text>
                  </View>
                  <Text style={styles.cardStatus}>
                    {getBirdStatusLabel(bird)}
                    {moodLabel ? `・${moodLabel}` : ''}
                  </Text>
                  <Text style={styles.cardGoal}>{getBirdGoalLabel(bird)}</Text>

                  <View style={styles.statsRow}>
                    <Text style={styles.statItem}>❤️{bird.hp}/{bird.maxHp}</Text>
                    <Text style={styles.statItem}>⚔️{stats.atk}</Text>
                    <Text style={styles.statItem}>🛡️{stats.defense}</Text>
                    <Text style={styles.statItem}>🏃{stats.speed}</Text>
                    <Text style={styles.statItem}>🍀{stats.luck}</Text>
                  </View>
                  {(stats.mp > 0 || stats.cri > 0 || stats.eva > 0) && (
                    <View style={styles.statsRow}>
                      {stats.mp > 0 && <Text style={styles.statItem}>💧MP{stats.mp}</Text>}
                      {stats.cri > 0 && <Text style={styles.statItem}>💥CRI{stats.cri}%</Text>}
                      {stats.eva > 0 && <Text style={styles.statItem}>💨EVA{stats.eva}%</Text>}
                    </View>
                  )}
                  {stats.activeSetBonusLabel && (
                    <Text style={styles.setBonusLabel}>✨ {stats.activeSetBonusLabel}</Text>
                  )}
                  <View style={styles.statsRow}>
                    <Text style={styles.meterItem}>🍚満腹度 {Math.round(bird.satiety)}</Text>
                    <Text style={styles.meterItem}>😊ご機嫌度 {Math.round(bird.happiness)}</Text>
                  </View>

                  {bird.houselessTicks > HOUSELESS_SULK_TICKS && (
                    <View style={styles.houselessRow}>
                      <Text style={styles.houselessBadge}>
                        {bird.houselessTicks > HOUSELESS_WARNING_TICKS
                          ? '⚠️ 家がなくて、旅立ちを考えているみたい…'
                          : '🥺 家がなくてちょっと拗ねている'}
                      </Text>
                      <AnimatedPressable style={styles.giftButton} onPress={() => onGiftBird(c.id)}>
                        <Text style={styles.giftButtonText}>🎁 なだめる</Text>
                      </AnimatedPressable>
                    </View>
                  )}

                  {bird.skills.length > 0 && (
                    <View style={styles.inventoryRow}>
                      {bird.skills.map((skillId) => {
                        const skill = BIRD_SKILL_DEF_MAP[skillId];
                        if (!skill) return null;
                        return (
                          <Text style={styles.skillBadge} key={skillId}>
                            💡{skill.name}
                          </Text>
                        );
                      })}
                    </View>
                  )}

                  <View style={styles.equipRow}>
                    {EQUIP_SLOT_ORDER.map(({ slot, emptyIcon }) => {
                      const equippedId = bird.equipment[slot];
                      const equipDef = equippedId ? ITEM_DEF_MAP[equippedId] : null;
                      return (
                        <View
                          style={[styles.equipSlot, equipDef && { borderColor: RARITY_COLORS[equipDef.rarity] }]}
                          key={slot}
                        >
                          <Text style={[styles.equipIcon, !equipDef && styles.equipIconEmpty]}>
                            {equipDef?.emoji ?? emptyIcon}
                          </Text>
                          <Text style={styles.equipLabel} numberOfLines={1}>
                            {equipDef?.name ?? '(空)'}
                          </Text>
                        </View>
                      );
                    })}
                  </View>

                  <Text style={styles.cosmeticSectionLabel}>
                    👗見た目装備(コスチューム) — ステータスには影響しません
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cosmeticRow}>
                    <AnimatedPressable
                      style={[styles.cosmeticChip, !bird.cosmeticId && styles.cosmeticChipActive]}
                      onPress={() => onSetCosmetic(bird.defId, null)}
                    >
                      <View style={styles.cosmeticChipEmptyIcon}>
                        <Text style={styles.cosmeticChipEmptyIconText}>🚫</Text>
                      </View>
                      <Text style={styles.cosmeticChipLabel} numberOfLines={1}>
                        なし
                      </Text>
                    </AnimatedPressable>
                    {wearableCosmetics.map((cosmetic) => {
                      const isActive = bird.cosmeticId === cosmetic.id;
                      return (
                        <AnimatedPressable
                          key={cosmetic.id}
                          style={[styles.cosmeticChip, isActive && styles.cosmeticChipActive]}
                          onPress={() => onSetCosmetic(bird.defId, isActive ? null : cosmetic.id)}
                        >
                          <CharacterAvatar
                            characterId={c.id}
                            emoji={c.emoji}
                            color={c.color}
                            size={40}
                            cosmeticId={cosmetic.id}
                          />
                          <Text style={styles.cosmeticChipLabel} numberOfLines={1}>
                            {cosmetic.name}
                          </Text>
                        </AnimatedPressable>
                      );
                    })}
                  </ScrollView>
                  {lockedCount > 0 && (
                    <Text style={styles.cosmeticLockedHint}>🔒 あと{lockedCount}点は🎁コスチューム図鑑から</Text>
                  )}

                  <View style={styles.inventoryRow}>
                    {owned.length === 0 && ownedItems.length === 0 ? (
                      <Text style={styles.emptyInventory}>持ち物なし</Text>
                    ) : (
                      <>
                        {owned.map((k) => (
                          <Text style={styles.inventoryItem} key={k}>
                            {MATERIAL_ICON[k]}
                            {bird.inventory[k]}
                          </Text>
                        ))}
                        {ownedItems.map((k) => (
                          <Text style={styles.inventoryItem} key={k}>
                            {ITEM_DEF_MAP[k].emoji}
                            {bird.items[k]}
                          </Text>
                        ))}
                      </>
                    )}
                  </View>
                </View>
              );
            })}
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '800', color: theme.gold },
  closeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: theme.cardAlt,
    borderRadius: 999,
  },
  closeButtonText: { color: theme.blue, fontWeight: '700', fontSize: 13 },
  list: { maxHeight: 460 },
  card: {
    backgroundColor: theme.cardAlt,
    borderRadius: 14,
    borderWidth: 2,
    padding: 12,
    marginBottom: 10,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardHeaderText: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: '800', color: theme.textPrimary },
  cardLevel: { fontSize: 12, fontWeight: '700', color: theme.textSecondary },
  cardExp: { fontSize: 10, color: theme.textMuted, marginTop: 1 },
  cardGold: { fontSize: 13, fontWeight: '800', color: theme.gold },
  cardStatus: { fontSize: 12, fontWeight: '700', color: theme.textPrimary, marginTop: 6 },
  cardGoal: { fontSize: 11, color: theme.textSecondary, marginTop: 1 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 6 },
  statItem: { fontSize: 12, fontWeight: '700', color: theme.textPrimary },
  meterItem: { fontSize: 11, fontWeight: '700', color: theme.textSecondary },
  setBonusLabel: { fontSize: 11, fontWeight: '700', color: theme.gold, marginTop: 4 },
  houselessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    backgroundColor: theme.cardAlt,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  houselessBadge: { fontSize: 11, fontWeight: '700', color: theme.textSecondary, flex: 1, marginRight: 6 },
  giftButton: { backgroundColor: theme.gold, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  giftButtonText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  equipRow: { flexDirection: 'row', gap: 6, marginTop: 8 },
  equipSlot: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: theme.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    paddingVertical: 6,
    gap: 1,
  },
  equipIcon: { fontSize: 16 },
  equipIconEmpty: { opacity: 0.3 },
  equipLabel: { fontSize: 9, color: theme.textMuted, maxWidth: 60 },
  cosmeticSectionLabel: { fontSize: 10, fontWeight: '700', color: theme.textMuted, marginTop: 8 },
  cosmeticLockedHint: { fontSize: 9, color: theme.textMuted, marginTop: 2 },
  cosmeticRow: { marginTop: 4 },
  cosmeticChip: {
    width: 56,
    alignItems: 'center',
    backgroundColor: theme.card,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: theme.cardBorder,
    paddingVertical: 4,
    marginRight: 6,
  },
  cosmeticChipActive: { borderColor: theme.gold, backgroundColor: theme.cardAlt },
  cosmeticChipEmptyIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  cosmeticChipEmptyIconText: { fontSize: 18, opacity: 0.5 },
  cosmeticChipLabel: { fontSize: 8, color: theme.textMuted, maxWidth: 52, textAlign: 'center' },
  inventoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  emptyInventory: { fontSize: 10, color: theme.textMuted },
  inventoryItem: { fontSize: 11, fontWeight: '700', color: theme.textPrimary },
  skillBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.gold,
    backgroundColor: theme.card,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.gold,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
});
