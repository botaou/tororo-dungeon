import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CHARACTERS } from '../data/characters';
import { CharacterAvatar } from '../components/CharacterAvatar';
import { AnimatedPressable } from '../components/AnimatedPressable';
import { useBirdEconomyStore } from '../store/useBirdEconomyStore';
import { cuteShadow, theme } from '../theme';

// The very first thing a new player sees: pick one of the four birds to
// start the town with. The other three stay unrecruited (see BirdState.
// isRecruited) until a future phase adds a real way to invite them in.
export function CharacterSelectScreen() {
  const recruitBird = useBirdEconomyStore((s) => s.recruitBird);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>🏡 トロロの街</Text>
      <Text style={styles.subtitle}>一緒に街を始める鳥を選んでください</Text>
      <ScrollView contentContainerStyle={styles.list}>
        {CHARACTERS.map((c) => (
          <View key={c.id} style={[styles.card, { borderColor: c.color }]}>
            <CharacterAvatar characterId={c.id} emoji={c.emoji} color={c.color} size={64} />
            <View style={styles.cardText}>
              <Text style={styles.cardName}>{c.name}</Text>
              <Text style={[styles.cardRole, { color: c.color }]}>{c.roleLabel}</Text>
              <Text style={styles.cardDescription}>{c.description}</Text>
            </View>
            <AnimatedPressable style={styles.pickButton} onPress={() => recruitBird(c.id)}>
              <Text style={styles.pickButtonText}>この子で始める</Text>
            </AnimatedPressable>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bgBottom, paddingHorizontal: 16 },
  title: { fontSize: 22, fontWeight: '800', color: theme.textPrimary, textAlign: 'center', marginTop: 12 },
  subtitle: { fontSize: 13, color: theme.textSecondary, textAlign: 'center', marginTop: 4, marginBottom: 12 },
  list: { paddingBottom: 24, gap: 12 },
  card: {
    backgroundColor: theme.card,
    borderRadius: 18,
    borderWidth: 2,
    padding: 14,
    alignItems: 'center',
    ...cuteShadow,
  },
  cardText: { alignItems: 'center', marginTop: 8 },
  cardName: { fontSize: 17, fontWeight: '800', color: theme.textPrimary },
  cardRole: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  cardDescription: {
    fontSize: 12,
    color: theme.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 17,
  },
  pickButton: {
    backgroundColor: theme.gold,
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 12,
  },
  pickButtonText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
