import React from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';

import { MaterialId, PlotUnlockCost } from '../types';
import { MATERIAL_ICON, MATERIAL_LABEL } from '../data/materials';
import { AnimatedPressable } from './AnimatedPressable';
import { theme } from '../theme';

interface Props {
  visible: boolean;
  cost: PlotUnlockCost | null;
  gold: number;
  materials: Partial<Record<MaterialId, number>>;
  onUnlock: () => void;
  onClose: () => void;
}

// Tapping a locked-but-affordable plot used to just silently try (and
// silently fail) the unlock. This shows the full cost breakdown first —
// gold and material, each compared against what the player actually has —
// so it's clear at a glance what's missing, with an unlock button that's
// only enabled once every requirement is met.
export function PlotUnlockModal({ visible, cost, gold, materials, onUnlock, onClose }: Props) {
  if (!cost) return null;

  const goldHave = gold;
  const goldNeed = cost.gold;
  const goldOk = goldHave >= goldNeed;

  const materialId = cost.materialId;
  const materialNeed = cost.materialAmount ?? 0;
  const materialHave = materialId ? materials[materialId] ?? 0 : 0;
  const materialOk = !materialId || materialHave >= materialNeed;

  const canUnlock = goldOk && materialOk;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>🔒 土地の解放</Text>
          <Text style={styles.subtitle}>解放に必要なもの</Text>

          <View style={styles.row}>
            <Text style={styles.rowIcon}>🪙</Text>
            <Text style={styles.rowLabel}>ゴールド</Text>
            <Text style={[styles.rowValue, !goldOk && styles.rowValueShort]}>
              {goldHave}/{goldNeed}
            </Text>
          </View>

          {materialId && (
            <View style={styles.row}>
              <Text style={styles.rowIcon}>{MATERIAL_ICON[materialId]}</Text>
              <Text style={styles.rowLabel}>{MATERIAL_LABEL[materialId]}</Text>
              <Text style={[styles.rowValue, !materialOk && styles.rowValueShort]}>
                {materialHave}/{materialNeed}
              </Text>
            </View>
          )}

          {!canUnlock && <Text style={styles.shortNote}>不足している分があります</Text>}

          <View style={styles.buttonRow}>
            {/* AnimatedPressable applies its `style` prop to an inner
                Animated.View, one layer below the (unstyled) Pressable it
                renders — so a bare `flex: 1` on that inner style has no
                real flex-row parent to resolve against, since the
                Pressable in between never gets a definite width of its
                own. This is the only place in the app with two such
                buttons side by side sharing a row, and real-device
                screenshots showed the button backgrounds sized/colored
                correctly (proof the row layout resolves *something*) while
                the Text labels inside rendered completely blank — a
                fully-deterministic width for every layer removes the
                ambiguity outright rather than relying on flex resolving
                through an extra unstyled layer. */}
            <View style={styles.buttonSlot}>
              <AnimatedPressable style={styles.closeButton} onPress={onClose}>
                <Text style={styles.closeButtonText}>とじる</Text>
              </AnimatedPressable>
            </View>
            <View style={styles.buttonSlot}>
              <AnimatedPressable
                style={[styles.unlockButton, !canUnlock && styles.unlockButtonDisabled]}
                onPress={canUnlock ? onUnlock : undefined}
                disabled={!canUnlock}
              >
                <Text style={styles.unlockButtonText}>解放する</Text>
              </AnimatedPressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: theme.overlay, justifyContent: 'center', alignItems: 'center', padding: 20 },
  sheet: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: theme.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    padding: 20,
  },
  title: { fontSize: 18, fontWeight: '800', color: theme.textPrimary, textAlign: 'center' },
  subtitle: { fontSize: 12, color: theme.textSecondary, textAlign: 'center', marginTop: 4, marginBottom: 14 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.cardAlt,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  rowIcon: { fontSize: 18, width: 28 },
  rowLabel: { flex: 1, fontSize: 13, fontWeight: '700', color: theme.textPrimary },
  rowValue: { fontSize: 14, fontWeight: '800', color: theme.textPrimary },
  rowValueShort: { color: theme.red },
  shortNote: { fontSize: 11, color: theme.red, textAlign: 'center', marginTop: 2, marginBottom: 6 },
  buttonRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  buttonSlot: { flex: 1 },
  closeButton: {
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: theme.cardAlt,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  closeButtonText: { color: theme.textSecondary, fontWeight: '700', fontSize: 13 },
  unlockButton: {
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: theme.gold,
  },
  unlockButtonDisabled: { backgroundColor: theme.disabled },
  unlockButtonText: { color: '#fff', fontWeight: '800', fontSize: 13 },
});
