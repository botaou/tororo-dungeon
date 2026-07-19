import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { TownScreen } from './src/screens/TownScreen';
import { CharacterSelectScreen } from './src/screens/CharacterSelectScreen';
import { WelcomeBackModal } from './src/components/WelcomeBackModal';
import { usePlayerStore } from './src/store/usePlayerStore';
import { useBirdEconomyStore } from './src/store/useBirdEconomyStore';
import { useGameTimeStore } from './src/store/useGameTimeStore';
import { OfflineReport } from './src/game/offlineProgress';
import { useGameClock } from './src/game/useGameClock';
import { theme } from './src/theme';
import { SHOW_ISOMETRIC_PROTOTYPE } from './src/game/config';
import { IsometricPrototypeScreen } from './src/prototypes/isometric/IsometricPrototypeScreen';

export default function App() {
  // Phase-13 feasibility prototype escape hatch — see config.ts's own
  // comment. Checked before any hydration-gated state so it's viewable
  // immediately, since the prototype doesn't touch (and doesn't need) any
  // of the real persisted stores. Flip the flag back to false (or delete
  // this block + the flag + src/prototypes/isometric/) to fully remove.
  if (SHOW_ISOMETRIC_PROTOTYPE) {
    return (
      <SafeAreaProvider>
        <IsometricPrototypeScreen />
      </SafeAreaProvider>
    );
  }
  const [playerHydrated, setPlayerHydrated] = useState(usePlayerStore.persist.hasHydrated());
  const [birdEconomyHydrated, setBirdEconomyHydrated] = useState(useBirdEconomyStore.persist.hasHydrated());
  const [gameTimeHydrated, setGameTimeHydrated] = useState(useGameTimeStore.persist.hasHydrated());

  useEffect(() => {
    const unsub = usePlayerStore.persist.onFinishHydration(() => setPlayerHydrated(true));
    return unsub;
  }, []);
  useEffect(() => {
    const unsub = useBirdEconomyStore.persist.onFinishHydration(() => setBirdEconomyHydrated(true));
    return unsub;
  }, []);
  useEffect(() => {
    const unsub = useGameTimeStore.persist.onFinishHydration(() => setGameTimeHydrated(true));
    return unsub;
  }, []);

  // Reactive to wallet changes, so recruiting a starter flips straight
  // from the selection screen to the town without any manual navigation.
  const wallets = useBirdEconomyStore((s) => s.wallets);
  const hasStarter = Object.values(wallets).some((w) => w.isRecruited);

  // Runs the offline-catchup calculation exactly once, after every
  // persisted store has hydrated, and before TownScreen/CharacterSelectScreen
  // ever mount — React fires child effects before parent effects, so this
  // has to gate what renders rather than run alongside it, otherwise
  // TownScreen's own initWorld() could read bird wallets before the
  // catch-up has finished updating them.
  const [caughtUp, setCaughtUp] = useState(false);
  const [offlineReport, setOfflineReport] = useState<OfflineReport | null>(null);
  useEffect(() => {
    if (playerHydrated && birdEconomyHydrated && gameTimeHydrated && !caughtUp) {
      setOfflineReport(useGameTimeStore.getState().catchUpOffline());
      setCaughtUp(true);
    }
  }, [playerHydrated, birdEconomyHydrated, gameTimeHydrated, caughtUp]);

  useGameClock();

  if (!playerHydrated || !birdEconomyHydrated || !gameTimeHydrated || !caughtUp) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={theme.gold} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      {hasStarter ? <TownScreen /> : <CharacterSelectScreen />}
      <WelcomeBackModal report={offlineReport} onClose={() => setOfflineReport(null)} />
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.bgBottom },
});
