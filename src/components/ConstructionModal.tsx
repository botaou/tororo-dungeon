import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';

import { MaterialId } from '../types';
import { BUILDING_OPTIONS, getScaledBuildingCost } from '../data/buildingOptions';
import { MATERIAL_ICON } from '../data/materials';
import { AnimatedPressable } from './AnimatedPressable';
import { theme } from '../theme';

interface Props {
  visible: boolean;
  gold: number;
  materials: Partial<Record<MaterialId, number>>;
  // Step B (building free placement): how many buildings already stand in
  // town, and the current cap (see data/townGrid.ts's getTownBuildingCap) —
  // used both to show "n/cap" and to scale each option's displayed cost
  // (see data/buildingOptions.ts's getScaledBuildingCost).
  builtCount: number;
  cap: number;
  // Picking an affordable option no longer builds immediately — it starts
  // placement mode (see TownScreen), closing this modal so the player can
  // tap wherever in town they want it to go.
  onSelect: (optionId: string) => void;
  onClose: () => void;
}

// Tapping the "🏗️ 建てる" button opens this — pick a building from the
// catalog (data/buildingOptions.ts), see its cost (scaled by how many
// buildings already stand in town) measured against what the player
// actually has, then tap anywhere in town to place it (see TownScreen's
// placingBuildingOptionId/handleBuildMapTap).
export function ConstructionModal({ visible, gold, materials, builtCount, cap, onSelect, onClose }: Props) {
  const atCap = builtCount >= cap;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>🏗️ 建設</Text>
            <AnimatedPressable onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>閉じる</Text>
            </AnimatedPressable>
          </View>
          <Text style={styles.bodySubText}>
            建てたい建物を選んでください({builtCount}/{cap})
          </Text>
          {atCap && (
            <Text style={styles.capNote}>この街ではこれ以上建てられません。街レベルが上がると上限が増えます。</Text>
          )}

          <ScrollView style={styles.list}>
            {BUILDING_OPTIONS.map((option) => {
              const cost = getScaledBuildingCost(option, builtCount);
              const goldOk = gold >= cost.gold;
              const have = materials[cost.materialId] ?? 0;
              const materialOk = have >= cost.materialAmount;
              const canBuild = !atCap && goldOk && materialOk;

              return (
                <View key={option.id} style={styles.optionCard}>
                  <View style={styles.optionHeader}>
                    <Text style={styles.optionEmoji}>{option.emoji}</Text>
                    <View style={styles.optionTextWrap}>
                      <Text style={styles.optionName}>{option.name}</Text>
                      <Text style={styles.optionDesc}>{option.description}</Text>
                    </View>
                  </View>

                  <View style={styles.costRow}>
                    <Text style={[styles.costText, !goldOk && styles.costTextShort]}>
                      🪙 {gold}/{cost.gold}
                    </Text>
                    <Text style={[styles.costText, !materialOk && styles.costTextShort]}>
                      {MATERIAL_ICON[cost.materialId]} {have}/{cost.materialAmount}
                    </Text>
                  </View>

                  <AnimatedPressable
                    style={[styles.buildButton, !canBuild && styles.buildButtonDisabled]}
                    onPress={canBuild ? () => onSelect(option.id) : undefined}
                    disabled={!canBuild}
                  >
                    <Text style={styles.buildButtonText}>建てる</Text>
                  </AnimatedPressable>
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 18, fontWeight: '800', color: theme.gold },
  closeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: theme.cardAlt,
    borderRadius: 999,
  },
  closeButtonText: { color: theme.blue, fontWeight: '700', fontSize: 13 },
  bodySubText: { fontSize: 12, color: theme.textSecondary, marginBottom: 4 },
  capNote: { fontSize: 11, color: theme.red, marginBottom: 8 },
  list: { maxHeight: 420 },
  optionCard: {
    backgroundColor: theme.cardAlt,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: theme.cardBorder,
    padding: 12,
    marginBottom: 10,
  },
  optionHeader: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  optionEmoji: { fontSize: 26 },
  optionTextWrap: { flex: 1 },
  optionName: { fontSize: 14, fontWeight: '800', color: theme.textPrimary },
  optionDesc: { fontSize: 11, color: theme.textSecondary, marginTop: 2 },
  costRow: { flexDirection: 'row', gap: 14, marginBottom: 10 },
  costText: { fontSize: 12, fontWeight: '700', color: theme.textPrimary },
  costTextShort: { color: theme.red },
  buildButton: {
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: theme.gold,
  },
  buildButtonDisabled: { backgroundColor: theme.disabled },
  buildButtonText: { color: '#fff', fontWeight: '800', fontSize: 13 },
});
