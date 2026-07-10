import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BirdState, ItemId, MaterialId } from '../types';
import { CHARACTERS } from '../data/characters';
import { MATERIAL_ICON } from '../data/materials';
import { ITEM_DEF_MAP } from '../data/items';
import { getMoodDef } from '../data/moods';
import { getBirdGoalLabel, getBirdStatusLabel } from '../game/birdStatus';
import { expToNextLevel } from '../game/config';
import { AnimatedPressable } from './AnimatedPressable';
import { theme } from '../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  birds: BirdState[];
}

export function BirdRosterModal({ visible, onClose, birds }: Props) {
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
              const ownedItems = (Object.keys(bird.items) as ItemId[]).filter((k) => (bird.items[k] ?? 0) > 0);
              const moodLabel = getMoodDef(bird.mood).label;
              return (
                <View key={c.id} style={[styles.card, { borderColor: c.color }]}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardEmoji}>{c.emoji}</Text>
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
  cardEmoji: { fontSize: 24 },
  cardHeaderText: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: '800', color: theme.textPrimary },
  cardLevel: { fontSize: 12, fontWeight: '700', color: theme.textSecondary },
  cardExp: { fontSize: 10, color: theme.textMuted, marginTop: 1 },
  cardGold: { fontSize: 13, fontWeight: '800', color: theme.gold },
  cardStatus: { fontSize: 12, fontWeight: '700', color: theme.textPrimary, marginTop: 6 },
  cardGoal: { fontSize: 11, color: theme.textSecondary, marginTop: 1 },
  inventoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  emptyInventory: { fontSize: 10, color: theme.textMuted },
  inventoryItem: { fontSize: 11, fontWeight: '700', color: theme.textPrimary },
});
