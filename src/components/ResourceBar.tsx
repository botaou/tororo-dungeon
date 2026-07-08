import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface Props {
  label: string;
  current: number;
  max: number;
  color: string;
}

export function ResourceBar({ label, current, max, color }: Props) {
  const ratio = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>
          {Math.floor(current)} / {max}
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginVertical: 4 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  label: { fontSize: 13, fontWeight: '600', color: '#333' },
  value: { fontSize: 12, color: '#666' },
  track: {
    height: 10,
    borderRadius: 5,
    backgroundColor: '#e2e2e2',
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 5 },
});
