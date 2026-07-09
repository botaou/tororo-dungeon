import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { usePlayerStore } from '../store/usePlayerStore';
import { useWorldStore } from '../store/useWorldStore';
import { useTownStore } from '../store/useTownStore';
import { TOWN_PLOT_DEFS } from '../data/townGrid';
import { getMoodDef } from '../data/moods';
import { getBirdThought } from '../game/thoughts';
import { WorldMap } from '../components/WorldMap';
import { MaterialsRow } from '../components/MaterialsRow';
import { BirdStatusRow } from '../components/BirdStatusRow';
import { AnimatedPressable } from '../components/AnimatedPressable';
import { RequestBoard } from '../components/RequestBoard';
import { ShopModal } from '../components/ShopModal';
import { MaterialId } from '../types';
import { cuteShadow, theme } from '../theme';

export function TownScreen() {
  const gold = usePlayerStore((s) => s.gold);
  const materials = usePlayerStore((s) => s.materials);
  const world = useWorldStore((s) => s.world);
  const initWorld = useWorldStore((s) => s.initWorld);
  const postRequest = useWorldStore((s) => s.postRequest);
  const plots = useTownStore((s) => s.plots);
  const tryUnlockPlot = useTownStore((s) => s.tryUnlockPlot);
  const cycleBuilding = useTownStore((s) => s.cycleBuilding);

  const [selectedBirdId, setSelectedBirdId] = useState<string | null>(null);
  const [boardVisible, setBoardVisible] = useState(false);
  const [shopVisible, setShopVisible] = useState(false);

  useEffect(() => {
    if (world.birds.length === 0) initWorld();
  }, [world.birds.length, initWorld]);

  const selectedBird = world.birds.find((b) => b.defId === selectedBirdId) ?? null;

  const handlePost = (materialId: MaterialId, amount: number, reward: number) => {
    postRequest(materialId, amount, reward);
  };

  const handlePlotPress = (plotId: string) => {
    const def = TOWN_PLOT_DEFS.find((p) => p.id === plotId);
    if (!def) return;
    const state = plots[plotId] ?? { id: plotId, unlocked: def.unlockedByDefault, building: null };
    if (!state.unlocked) {
      if (def.unlockCost) tryUnlockPlot(plotId, def.unlockCost);
      return;
    }
    cycleBuilding(plotId);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.title}>🏡 トロロの街</Text>
        <MaterialsRow gold={gold} materials={materials} />
        <BirdStatusRow birds={world.birds} />
      </View>

      <View style={styles.mapWrap}>
        <WorldMap
          enemies={world.enemies}
          miningNodes={world.miningNodes}
          treasures={world.treasures}
          leisureSpots={world.leisureSpots}
          birds={world.birds}
          plotStates={plots}
          onBirdPress={(defId) => setSelectedBirdId((prev) => (prev === defId ? null : defId))}
          onPlotPress={handlePlotPress}
          onShopPress={() => setShopVisible(true)}
        />
      </View>

      <View style={styles.bottomBar}>
        {selectedBird ? (
          <View style={styles.thoughtBubble}>
            <Text style={styles.thoughtName}>
              {selectedBird.name}
              {getMoodDef(selectedBird.mood).label ? `・${getMoodDef(selectedBird.mood).label}` : ''}
            </Text>
            <Text style={styles.thoughtText}>
              「{getBirdThought(selectedBird.defId, selectedBird.mood, selectedBird.activity, !!selectedBird.currentJobId)}」
            </Text>
          </View>
        ) : (
          <Text style={styles.hintText}>🐣 鳥をタップすると今の気分がわかります</Text>
        )}
        <AnimatedPressable style={styles.boardButton} onPress={() => setBoardVisible(true)}>
          <Text style={styles.boardButtonText}>📋 依頼</Text>
        </AnimatedPressable>
      </View>

      <RequestBoard
        visible={boardVisible}
        onClose={() => setBoardVisible(false)}
        requests={world.requests}
        onPost={handlePost}
      />

      <ShopModal visible={shopVisible} onClose={() => setShopVisible(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bgBottom },
  topBar: { paddingHorizontal: 14, paddingTop: 6, gap: 6 },
  title: { fontSize: 20, fontWeight: '800', color: theme.textPrimary, letterSpacing: 0.3 },
  mapWrap: { flex: 1, paddingHorizontal: 12, marginTop: 8 },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  hintText: { flex: 1, fontSize: 12, color: theme.textMuted },
  thoughtBubble: {
    flex: 1,
    backgroundColor: theme.card,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: theme.pink,
    paddingHorizontal: 12,
    paddingVertical: 6,
    ...cuteShadow,
  },
  thoughtName: { fontSize: 11, fontWeight: '700', color: theme.textMuted },
  thoughtText: { fontSize: 13, fontWeight: '600', color: theme.textPrimary, marginTop: 1 },
  boardButton: {
    backgroundColor: theme.gold,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 11,
    ...cuteShadow,
  },
  boardButtonText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
