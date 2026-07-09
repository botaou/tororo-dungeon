import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { MaterialId } from '../types';
import { MATERIAL_ICON } from '../data/materials';
import { theme } from '../theme';

// Always shows every material (even at 0) plus gold — this is the
// player's always-visible status readout, not just a "what I have" glance.
interface Props {
  gold: number;
  materials: Record<MaterialId, number>;
}

const ALL_MATERIALS = Object.keys(MATERIAL_ICON) as MaterialId[];

export function MaterialsRow({ gold, materials }: Props) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={styles.row}>
        <View style={[styles.item, styles.goldItem]}>
          <Text style={styles.icon}>🪙</Text>
          <Text style={styles.value}>{gold}</Text>
        </View>
        {ALL_MATERIALS.map((key) => (
          <View style={styles.item} key={key}>
            <Text style={styles.icon}>{MATERIAL_ICON[key]}</Text>
            <Text style={styles.value}>{materials[key] ?? 0}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.card,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1.5,
    borderColor: theme.cardBorder,
  },
  goldItem: { borderColor: theme.gold, backgroundColor: theme.cardAlt },
  icon: { fontSize: 15 },
  value: { fontSize: 13, fontWeight: '700', color: theme.textPrimary },
});
