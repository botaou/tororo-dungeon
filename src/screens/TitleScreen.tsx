import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedPressable } from '../components/AnimatedPressable';
import { NewsModal } from '../components/NewsModal';
import { cuteShadow, theme } from '../theme';

interface Props {
  // Only ever shown when a starter's already been picked (see App.tsx —
  // a first-ever launch skips straight to CharacterSelectScreen instead,
  // per the request's own "セーブデータが無い場合は…そのまま進む"), so
  // there's no need for this screen to branch on that itself.
  onContinue: () => void;
}

// The app's new front door (item 84) — shown once per cold start, ahead of
// TownScreen, for any save that already has a starter recruited. Logo is a
// deliberate placeholder (plain text/emoji) per the request — real artwork
// is a separate follow-up.
export function TitleScreen({ onContinue }: Props) {
  const [newsVisible, setNewsVisible] = useState(false);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.logoWrap}>
        <Text style={styles.logoEmoji}>🏡</Text>
        <Text style={styles.logoTitle}>トロロの街</Text>
        <Text style={styles.logoSubtitle}>〜 のんびり鳥の町づくり 〜</Text>
      </View>

      <View style={styles.buttonWrap}>
        <AnimatedPressable style={styles.continueButton} onPress={onContinue}>
          <Text style={styles.continueButtonText}>つづきから</Text>
        </AnimatedPressable>
        <AnimatedPressable style={styles.newsButton} onPress={() => setNewsVisible(true)}>
          <Text style={styles.newsButtonText}>📰 ニュース</Text>
        </AnimatedPressable>
      </View>

      <NewsModal visible={newsVisible} onClose={() => setNewsVisible(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bgBottom, alignItems: 'center', justifyContent: 'space-between', paddingVertical: 60 },
  logoWrap: { alignItems: 'center', marginTop: 40 },
  logoEmoji: { fontSize: 72 },
  logoTitle: { fontSize: 34, fontWeight: '800', color: theme.textPrimary, marginTop: 8, letterSpacing: 1 },
  logoSubtitle: { fontSize: 13, color: theme.textSecondary, marginTop: 6 },
  buttonWrap: { width: '100%', paddingHorizontal: 40, gap: 14 },
  continueButton: {
    backgroundColor: theme.gold,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    ...cuteShadow,
  },
  continueButtonText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  newsButton: {
    backgroundColor: theme.card,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: theme.cardBorder,
    ...cuteShadow,
  },
  newsButtonText: { color: theme.textPrimary, fontWeight: '700', fontSize: 14 },
});
