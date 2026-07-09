import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { TownScreen } from './src/screens/TownScreen';
import { usePlayerStore } from './src/store/usePlayerStore';
import { useGameClock } from './src/game/useGameClock';
import { theme } from './src/theme';

export default function App() {
  const [hydrated, setHydrated] = useState(usePlayerStore.persist.hasHydrated());

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
      <TownScreen />
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.bgBottom },
});
