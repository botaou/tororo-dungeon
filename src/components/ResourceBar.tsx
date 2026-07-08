import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { theme } from '../theme';

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
      {label ? (
        <View style={styles.labelRow}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.value}>
            {Math.floor(current)} / {max}
          </Text>
        </View>
      ) : (
        <Text style={styles.valueOnly}>
          {Math.floor(current)} / {max}
        </Text>
      )}
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginVertical: 4 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  label: { fontSize: 13, fontWeight: '700', color: theme.textPrimary },
  value: { fontSize: 12, color: theme.textSecondary },
  valueOnly: { fontSize: 11, color: theme.textSecondary, marginBottom: 3 },
  track: {
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.bgBottom,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  fill: { height: '100%', borderRadius: 5 },
});
