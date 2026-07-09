import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActivityLogEntry } from '../types';
import { cuteShadow, theme } from '../theme';

// Always-visible "life log" — the last few things birds/the town did, so
// the economy reads as active rather than just numbers changing off-screen.
interface Props {
  entries: ActivityLogEntry[];
}

export function ActivityLogPanel({ entries }: Props) {
  return (
    <View style={styles.panel}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {entries.length === 0 ? (
          <Text style={styles.emptyText}>まだ何も起きていません…</Text>
        ) : (
          entries.map((e) => (
            <Text key={e.id} style={styles.entryText} numberOfLines={1}>
              {e.detail}
            </Text>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: theme.card,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: theme.cardBorder,
    paddingHorizontal: 10,
    paddingVertical: 6,
    height: 92,
    ...cuteShadow,
  },
  emptyText: { fontSize: 11, color: theme.textMuted },
  entryText: { fontSize: 11, color: theme.textPrimary, paddingVertical: 2 },
});
