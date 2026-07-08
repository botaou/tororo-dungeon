import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { HomeScreen } from './src/screens/HomeScreen';
import { StageScreen } from './src/screens/StageScreen';
import { usePlayerStore } from './src/store/usePlayerStore';
import { useGameClock } from './src/game/useGameClock';
import { theme } from './src/theme';

type Screen = 'home' | 'stage';

export default function App() {
  const [hydrated, setHydrated] = useState(usePlayerStore.persist.hasHydrated());
  const [screen, setScreen] = useState<Screen>('home');

  useEffect(() => {
    const unsub = usePlayerStore.persist.onFinishHydration(() => setHydrated(true));
    return unsub;
  }, []);

  useGameClock();

  if (!hydrated) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={theme.gold} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      {screen === 'home' ? (
        <HomeScreen onEnterStage={() => setScreen('stage')} />
      ) : (
        <StageScreen onExit={() => setScreen('home')} />
      )}
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.bgBottom },
});
