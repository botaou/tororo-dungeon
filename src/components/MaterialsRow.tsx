import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { MaterialId } from '../types';

const ICONS: Record<MaterialId, string> = { gold: '🪙', ore: '⛏️', gem: '💎' };

interface Props {
  materials: Record<MaterialId, number>;
}

export function MaterialsRow({ materials }: Props) {
  return (
    <View style={styles.row}>
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
  row: { flexDirection: 'row', gap: 16 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  icon: { fontSize: 16 },
  value: { fontSize: 14, fontWeight: '600', color: '#333' },
});
