import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { TownScreen } from './src/screens/TownScreen';
import { CharacterSelectScreen } from './src/screens/CharacterSelectScreen';
import { usePlayerStore } from './src/store/usePlayerStore';
import { useBirdEconomyStore } from './src/store/useBirdEconomyStore';
import { useGameClock } from './src/game/useGameClock';
import { theme } from './src/theme';

export default function App() {
  const [playerHydrated, setPlayerHydrated] = useState(usePlayerStore.persist.hasHydrated());
  const [birdEconomyHydrated, setBirdEconomyHydrated] = useState(useBirdEconomyStore.persist.hasHydrated());

  useEffect(() => {
    const unsub = usePlayerStore.persist.onFinishHydration(() => setPlayerHydrated(true));
    return unsub;
  }, []);
  useEffect(() => {
    const unsub = useBirdEconomyStore.persist.onFinishHydration(() => setBirdEconomyHydrated(true));
    return unsub;
  }, []);

  // Reactive to wallet changes, so recruiting a starter flips straight
  // from the selection screen to the town without any manual navigation.
  const wallets = useBirdEconomyStore((s) => s.wallets);
  const hasStarter = Object.values(wallets).some((w) => w.isRecruited);

  useGameClock();

  if (!playerHydrated || !birdEconomyHydrated) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={theme.gold} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      {hasStarter ? <TownScreen /> : <CharacterSelectScreen />}
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.bgBottom },
});
