import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { BirdState } from '../types';
import { CHARACTERS } from '../data/characters';
import { MATERIAL_ICON } from '../data/materials';
import { getMoodDef } from '../data/moods';
import { cuteShadow, theme } from '../theme';

// Always-visible readout of what each bird is currently carrying home from
// the field — separate from the tap-to-see-thought bubble, which is about
// mood/intent rather than "what's in their hands right now."
interface Props {
  birds: BirdState[];
}

export function BirdStatusRow({ birds }: Props) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={styles.row}>
        {CHARACTERS.map((c) => {
          const bird = birds.find((b) => b.defId === c.id);
          const carrying = bird?.carrying ?? null;
          const fainted = !!bird && bird.hp <= 0;
          return (
            <View key={c.id} style={[styles.item, { borderColor: c.color }]}>
              <Text style={styles.emoji}>{c.emoji}</Text>
              {carrying ? (
                <Text style={styles.carryText}>
                  {MATERIAL_ICON[carrying.materialId]}
                  {carrying.amount}
                </Text>
              ) : (
                <Text style={styles.emptyText}>{fainted ? '😵' : getMoodDef(bird?.mood ?? 'normal').label || '·'}</Text>
              )}
            </View>
          );
        })}
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
    ...cuteShadow,
  },
  emoji: { fontSize: 14 },
  carryText: { fontSize: 12, fontWeight: '700', color: theme.textPrimary },
  emptyText: { fontSize: 10, color: theme.textMuted },
});
