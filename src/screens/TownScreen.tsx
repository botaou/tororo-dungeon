import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { usePlayerStore } from '../store/usePlayerStore';
import { useWorldStore } from '../store/useWorldStore';
import { useTownStore } from '../store/useTownStore';
import { TOWN_PLOT_DEFS } from '../data/townGrid';
import { WorldMap, WORLD_CANVAS_HEIGHT, WORLD_CANVAS_WIDTH } from '../components/WorldMap';
import { PannableMap } from '../components/PannableMap';
import { TOWN_X, TOWN_Y } from '../data/world';
import { AnimatedPressable } from '../components/AnimatedPressable';
import { RequestBoard } from '../components/RequestBoard';
import { ShopModal } from '../components/ShopModal';
import { CraftingModal } from '../components/CraftingModal';
import { PlayerInventoryModal } from '../components/PlayerInventoryModal';
import { BirdRosterModal } from '../components/BirdRosterModal';
import { MerchantModal } from '../components/MerchantModal';
import { RecruitmentModal } from '../components/RecruitmentModal';
import { TownLevelUpModal } from '../components/TownLevelUpModal';
import { ActivityLogPanel } from '../components/ActivityLogPanel';
import { JobPreset } from '../data/jobPresets';
import { ShopKind } from '../types';
import { cuteShadow, theme } from '../theme';

export function TownScreen() {
  const gold = usePlayerStore((s) => s.gold);
  const materials = usePlayerStore((s) => s.materials);
  const items = usePlayerStore((s) => s.items);
  const world = useWorldStore((s) => s.world);
  const initWorld = useWorldStore((s) => s.initWorld);
  const postRequest = useWorldStore((s) => s.postRequest);
  const deliverToMerchant = useWorldStore((s) => s.deliverToMerchant);
  const plots = useTownStore((s) => s.plots);
  const developmentPoints = useTownStore((s) => s.developmentPoints);
  const levelUpEvents = useTownStore((s) => s.levelUpEvents);
  const tryUnlockPlot = useTownStore((s) => s.tryUnlockPlot);
  const cycleBuilding = useTownStore((s) => s.cycleBuilding);

  const [boardVisible, setBoardVisible] = useState(false);
  const [openShop, setOpenShop] = useState<ShopKind | null>(null);
  const [inventoryVisible, setInventoryVisible] = useState(false);
  const [rosterVisible, setRosterVisible] = useState(false);
  const [craftingVisible, setCraftingVisible] = useState(false);
  const [merchantVisible, setMerchantVisible] = useState(false);
  // How many of world.recruitmentEvents we've already shown a modal for —
  // the array only ever grows, so anything past this index is new (see
  // useWorldStore's recruitment-trigger checks).
  const [shownRecruitCount, setShownRecruitCount] = useState(0);
  // Same pattern for useTownStore's ever-growing levelUpEvents.
  const [shownLevelUpCount, setShownLevelUpCount] = useState(0);

  useEffect(() => {
    if (world.birds.length === 0) initWorld();
  }, [world.birds.length, initWorld]);

  // Dormant (not-yet-recruited) birds are still tracked in world.birds
  // (see useWorldStore) but never shown on the map or in the roster.
  const activeBirds = world.birds.filter((b) => b.isRecruited);
  const dormantDefIds = world.birds.filter((b) => !b.isRecruited).map((b) => b.defId);
  const pendingRecruit = world.recruitmentEvents[shownRecruitCount] ?? null;
  const pendingLevelUp = levelUpEvents[shownLevelUpCount] ?? null;

  const handlePost = (preset: JobPreset) => {
    postRequest(preset);
  };

  const handlePlotPress = (plotId: string) => {
    const def = TOWN_PLOT_DEFS.find((p) => p.id === plotId);
    if (!def) return;
    const state = plots[plotId] ?? { id: plotId, unlocked: def.unlockedByDefault, building: null };
    if (!state.unlocked) {
      if (def.unlockCost) tryUnlockPlot(plotId, def.unlockCost, def.minTownLevel);
      return;
    }
    cycleBuilding(plotId);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.title}>🏡 トロロの街</Text>
        <View style={styles.topBarRight}>
          <View style={styles.goldPill}>
            <Text style={styles.goldIcon}>🪙</Text>
            <Text style={styles.goldValue}>{gold}</Text>
          </View>
          <AnimatedPressable style={styles.inventoryButton} onPress={() => setRosterVisible(true)}>
            <Text style={styles.inventoryButtonText}>🐦</Text>
          </AnimatedPressable>
          <AnimatedPressable style={styles.inventoryButton} onPress={() => setCraftingVisible(true)}>
            <Text style={styles.inventoryButtonText}>🔨</Text>
          </AnimatedPressable>
          <AnimatedPressable style={styles.inventoryButton} onPress={() => setInventoryVisible(true)}>
            <Text style={styles.inventoryButtonText}>🎒</Text>
          </AnimatedPressable>
        </View>
      </View>

      <View style={styles.mapWrap}>
        <PannableMap contentWidth={WORLD_CANVAS_WIDTH} contentHeight={WORLD_CANVAS_HEIGHT} initialFocus={{ x: TOWN_X, y: TOWN_Y }}>
          <WorldMap
            enemies={world.enemies}
            miningNodes={world.miningNodes}
            treasures={world.treasures}
            leisureSpots={world.leisureSpots}
            birds={activeBirds}
            dormantDefIds={dormantDefIds}
            plotStates={plots}
            developmentPoints={developmentPoints}
            merchant={world.merchant}
            onBirdPress={() => setRosterVisible(true)}
            onPlotPress={handlePlotPress}
            onShopPress={(kind) => setOpenShop(kind)}
            onMerchantPress={() => setMerchantVisible(true)}
          />
        </PannableMap>
      </View>

      <View style={styles.bottomBar}>
        <View style={styles.logWrap}>
          <ActivityLogPanel entries={world.activityLog} />
        </View>
        <AnimatedPressable style={styles.boardButton} onPress={() => setBoardVisible(true)}>
          <Text style={styles.boardButtonText}>📋 依頼</Text>
        </AnimatedPressable>
      </View>

      <RequestBoard
        visible={boardVisible}
        onClose={() => setBoardVisible(false)}
        requests={world.requests}
        merchant={world.merchant}
        playerItems={items}
        onPost={handlePost}
        onDeliverToMerchant={deliverToMerchant}
      />

      <ShopModal visible={openShop !== null} onClose={() => setOpenShop(null)} shopKind={openShop} />

      <CraftingModal visible={craftingVisible} onClose={() => setCraftingVisible(false)} />

      <PlayerInventoryModal
        visible={inventoryVisible}
        onClose={() => setInventoryVisible(false)}
        gold={gold}
        materials={materials}
        items={items}
      />

      <BirdRosterModal visible={rosterVisible} onClose={() => setRosterVisible(false)} birds={activeBirds} />

      <MerchantModal visible={merchantVisible} onClose={() => setMerchantVisible(false)} merchant={world.merchant} />

      <RecruitmentModal defId={pendingRecruit} onClose={() => setShownRecruitCount((c) => c + 1)} />

      <TownLevelUpModal level={pendingLevelUp} onClose={() => setShownLevelUpCount((c) => c + 1)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bgBottom },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 6,
  },
  title: { fontSize: 20, fontWeight: '800', color: theme.textPrimary, letterSpacing: 0.3 },
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  goldPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.cardAlt,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: theme.gold,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  goldIcon: { fontSize: 14 },
  goldValue: { fontSize: 13, fontWeight: '700', color: theme.textPrimary },
  inventoryButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.card,
    borderWidth: 1.5,
    borderColor: theme.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inventoryButtonText: { fontSize: 16 },
  mapWrap: { flex: 1, paddingHorizontal: 12, marginTop: 8 },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  logWrap: { flex: 1 },
  boardButton: {
    backgroundColor: theme.gold,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 11,
    ...cuteShadow,
  },
  boardButtonText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
