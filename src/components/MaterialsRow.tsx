import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { MaterialId } from '../types';
import { MATERIAL_ICON } from '../data/materials';
import { theme } from '../theme';

// Only show materials the player actually has (plus gold) — with 14
// possible materials, a fixed full row would overwhelm the small top bar.
interface Props {
  gold: number;
  materials: Record<MaterialId, number>;
}

export function MaterialsRow({ gold, materials }: Props) {
  const owned = (Object.keys(MATERIAL_ICON) as MaterialId[]).filter((key) => (materials[key] ?? 0) > 0);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={styles.row}>
        <View style={styles.item}>
          <Text style={styles.icon}>🪙</Text>
          <Text style={styles.value}>{gold}</Text>
        </View>
        {owned.map((key) => (
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
  row: { flexDirection: 'row', gap: 10 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.bgBottom,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  icon: { fontSize: 15 },
  value: { fontSize: 13, fontWeight: '700', color: theme.textPrimary },
});
