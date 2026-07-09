import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { usePlayerStore } from '../store/usePlayerStore';
import { useWorldStore } from '../store/useWorldStore';
import { getMoodDef } from '../data/moods';
import { getBirdThought } from '../game/thoughts';
import { WorldMap } from '../components/WorldMap';
import { MaterialsRow } from '../components/MaterialsRow';
import { AnimatedPressable } from '../components/AnimatedPressable';
import { RequestBoard } from '../components/RequestBoard';
import { MaterialId } from '../types';
import { theme } from '../theme';

export function TownScreen() {
  const gold = usePlayerStore((s) => s.gold);
  const materials = usePlayerStore((s) => s.materials);
  const world = useWorldStore((s) => s.world);
  const initWorld = useWorldStore((s) => s.initWorld);
  const postRequest = useWorldStore((s) => s.postRequest);

  const [selectedBirdId, setSelectedBirdId] = useState<string | null>(null);
  const [boardVisible, setBoardVisible] = useState(false);

  useEffect(() => {
    if (world.birds.length === 0) initWorld();
  }, [world.birds.length, initWorld]);

  const selectedBird = world.birds.find((b) => b.defId === selectedBirdId) ?? null;

  const handlePost = (materialId: MaterialId, amount: number, reward: number) => {
    postRequest(materialId, amount, reward);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <MaterialsRow gold={gold} materials={materials} />
      </View>

      <View style={styles.mapWrap}>
        <WorldMap
          enemies={world.enemies}
          miningNodes={world.miningNodes}
          treasures={world.treasures}
          leisureSpots={world.leisureSpots}
          birds={world.birds}
          onBirdPress={(defId) => setSelectedBirdId((prev) => (prev === defId ? null : defId))}
        />
      </View>

      <View style={styles.bottomBar}>
        {selectedBird ? (
          <View style={styles.thoughtBubble}>
            <Text style={styles.thoughtName}>
              {selectedBird.name}
              {getMoodDef(selectedBird.mood).label ? `(${getMoodDef(selectedBird.mood).label})` : ''}
            </Text>
            <Text style={styles.thoughtText}>
              「{getBirdThought(selectedBird.defId, selectedBird.mood, selectedBird.activity, !!selectedBird.currentJobId)}」
            </Text>
          </View>
        ) : (
          <Text style={styles.hintText}>鳥をタップすると今の気分がわかります</Text>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bgBottom },
  topBar: { paddingHorizontal: 12, paddingTop: 6 },
  mapWrap: { flex: 1, paddingHorizontal: 12, marginTop: 8 },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 10,
  },
  hintText: { flex: 1, fontSize: 11, color: theme.textMuted },
  thoughtBubble: { flex: 1 },
  thoughtName: { fontSize: 11, fontWeight: '700', color: theme.textMuted },
  thoughtText: { fontSize: 13, fontWeight: '600', color: theme.textPrimary, marginTop: 1 },
  boardButton: {
    backgroundColor: theme.card,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  boardButtonText: { color: theme.textPrimary, fontWeight: '700', fontSize: 13 },
});
