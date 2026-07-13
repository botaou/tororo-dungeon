import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';

import { MaterialId } from '../types';
import { BUILDING_OPTIONS } from '../data/buildingOptions';
import { MATERIAL_ICON } from '../data/materials';
import { AnimatedPressable } from './AnimatedPressable';
import { theme } from '../theme';

interface Props {
  visible: boolean;
  gold: number;
  materials: Partial<Record<MaterialId, number>>;
  onBuild: (optionId: string) => void;
  onClose: () => void;
}

// Tapping an unlocked, still-empty plot opens this — pick a building from
// the catalog (data/buildingOptions.ts), see its cost measured against what
// the player actually has, and build it on the spot if affordable. Replaces
// the old free instant building-cycle tap (cosmetic only, no cost).
export function ConstructionModal({ visible, gold, materials, onBuild, onClose }: Props) {
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
          <Text style={styles.bodySubText}>この土地に建てる建物を選んでください。</Text>

          <ScrollView style={styles.list}>
            {BUILDING_OPTIONS.map((option) => {
              const goldOk = gold >= option.cost.gold;
              const have = materials[option.cost.materialId] ?? 0;
              const materialOk = have >= option.cost.materialAmount;
              const canBuild = goldOk && materialOk;

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
                      🪙 {gold}/{option.cost.gold}
                    </Text>
                    <Text style={[styles.costText, !materialOk && styles.costTextShort]}>
                      {MATERIAL_ICON[option.cost.materialId]} {have}/{option.cost.materialAmount}
                    </Text>
                  </View>

                  <AnimatedPressable
                    style={[styles.buildButton, !canBuild && styles.buildButtonDisabled]}
                    onPress={canBuild ? () => onBuild(option.id) : undefined}
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
  bodySubText: { fontSize: 12, color: theme.textSecondary, marginBottom: 12 },
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
