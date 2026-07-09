import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { MaterialId } from '../types';
import { theme } from '../theme';

const ICONS: Record<MaterialId, string> = { wood: '🪵', ore: '⛏️', mushroom: '🍄' };

interface Props {
  gold: number;
  materials: Record<MaterialId, number>;
}

export function MaterialsRow({ gold, materials }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.item}>
        <Text style={styles.icon}>🪙</Text>
        <Text style={styles.value}>{gold}</Text>
      </View>
      {(Object.keys(ICONS) as MaterialId[]).map((key) => (
        <View style={styles.item} key={key}>
          <Text style={styles.icon}>{ICONS[key]}</Text>
          <Text style={styles.value}>{materials[key] ?? 0}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
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
