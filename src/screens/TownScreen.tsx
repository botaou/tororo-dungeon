import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { usePlayerStore } from '../store/usePlayerStore';
import { useWorldStore } from '../store/useWorldStore';
import { useTownStore } from '../store/useTownStore';
import { getTownLevel, TOWN_PLOT_DEFS } from '../data/townGrid';
import { getBuildingOption } from '../data/buildingOptions';
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
import { PlotUnlockModal } from '../components/PlotUnlockModal';
import { ConstructionModal } from '../components/ConstructionModal';
import { RecipeUnlockModal } from '../components/RecipeUnlockModal';
import { TownStatusModal } from '../components/TownStatusModal';
import { ActivityLogPanel } from '../components/ActivityLogPanel';
import { JobPreset } from '../data/jobPresets';
import { PlotUnlockCost, ShopKind } from '../types';
import { cuteShadow, theme } from '../theme';

export function TownScreen() {
  const gold = usePlayerStore((s) => s.gold);
  const materials = usePlayerStore((s) => s.materials);
  const items = usePlayerStore((s) => s.items);
  const sellMaterialToMerchant = usePlayerStore((s) => s.sellMaterialToMerchant);
  const world = useWorldStore((s) => s.world);
  const initWorld = useWorldStore((s) => s.initWorld);
  const postRequest = useWorldStore((s) => s.postRequest);
  const deliverToMerchant = useWorldStore((s) => s.deliverToMerchant);
  const buyMerchantRecipe = useWorldStore((s) => s.buyMerchantRecipe);
  const plots = useTownStore((s) => s.plots);
  const developmentPoints = useTownStore((s) => s.developmentPoints);
  const levelUpEvents = useTownStore((s) => s.levelUpEvents);
  const tryUnlockPlot = useTownStore((s) => s.tryUnlockPlot);
  const constructBuilding = useTownStore((s) => s.constructBuilding);

  const [boardVisible, setBoardVisible] = useState(false);
  const [openShop, setOpenShop] = useState<ShopKind | null>(null);
  const [inventoryVisible, setInventoryVisible] = useState(false);
  const [rosterVisible, setRosterVisible] = useState(false);
  const [craftingVisible, setCraftingVisible] = useState(false);
  const [merchantVisible, setMerchantVisible] = useState(false);
  const [townStatusVisible, setTownStatusVisible] = useState(false);
  // Locked-but-affordable plot currently showing its cost breakdown (see
  // PlotUnlockModal) — null when closed.
  const [unlockTarget, setUnlockTarget] = useState<{ plotId: string; cost: PlotUnlockCost } | null>(null);
  // Unlocked, still-empty plot currently showing the construction menu (see
  // ConstructionModal) — null when closed.
  const [constructionTarget, setConstructionTarget] = useState<string | null>(null);
  // How many of world.recruitmentEvents we've already shown a modal for —
  // the array only ever grows, so anything past this index is new (see
  // useWorldStore's recruitment-trigger checks). world itself isn't
  // persisted (initWorld() rebuilds it fresh each launch), so starting at 0
  // is correct here — there's never a stale backlog to skip.
  const [shownRecruitCount, setShownRecruitCount] = useState(0);
  // Same queued-event pattern for useTownStore's ever-growing levelUpEvents
  // — but that store IS persisted across app restarts, so starting this at
  // 0 would replay every town level-up the player already saw in a past
  // session, one "やった!" tap at a time, before the map underneath ever
  // becomes reachable again. Seeding from the current length treats
  // anything already on disk at mount time as already-seen; only level-ups
  // reached during *this* session (after mount) still queue a fresh popup.
  const [shownLevelUpCount, setShownLevelUpCount] = useState(() => useTownStore.getState().levelUpEvents.length);
  // Same safe pattern as shownRecruitCount (not levelUpEvents' buggy one) —
  // world.recipeUnlockEvents isn't persisted either, so starting at 0 never
  // replays a stale backlog.
  const [shownRecipeUnlockCount, setShownRecipeUnlockCount] = useState(0);

  useEffect(() => {
    if (world.birds.length === 0) initWorld();
  }, [world.birds.length, initWorld]);

  // Dormant (not-yet-recruited) birds are still tracked in world.birds
  // (see useWorldStore) but never shown on the map or in the roster.
  const activeBirds = world.birds.filter((b) => b.isRecruited);
  const dormantDefIds = world.birds.filter((b) => !b.isRecruited).map((b) => b.defId);

  // RecruitmentModal/TownLevelUpModal/RecipeUnlockModal each render their own
  // <Modal> the instant their queued event is non-null, completely
  // independent of whatever the player currently has open — a request-board
  // check, a shop, a construction menu, etc. A background world tick can
  // queue one of these at any moment, so without this guard it could pop
  // open *while* another <Modal> is already visible, presenting two native
  // iOS modals at once. That's a known react-native/iOS fragility (real-
  // device report: taps go dead after navigating between screens, fixed
  // only by a full app restart) — so these three are only allowed to
  // actually show once nothing else is open, in a fixed priority order.
  // Nothing is lost by delaying them: the underlying arrays/counters are
  // untouched, so each still shows exactly once, just possibly a beat later.
  const anyOtherModalOpen =
    boardVisible ||
    openShop !== null ||
    inventoryVisible ||
    rosterVisible ||
    craftingVisible ||
    merchantVisible ||
    townStatusVisible ||
    unlockTarget !== null ||
    constructionTarget !== null;
  const pendingRecruit = anyOtherModalOpen ? null : world.recruitmentEvents[shownRecruitCount] ?? null;
  const pendingLevelUp = anyOtherModalOpen || pendingRecruit ? null : levelUpEvents[shownLevelUpCount] ?? null;
  const pendingRecipeUnlock =
    anyOtherModalOpen || pendingRecruit || pendingLevelUp ? null : world.recipeUnlockEvents[shownRecipeUnlockCount] ?? null;

  const handlePost = (preset: JobPreset) => {
    postRequest(preset);
  };

  const handlePlotPress = (plotId: string) => {
    const def = TOWN_PLOT_DEFS.find((p) => p.id === plotId);
    if (!def) return;
    const state = plots[plotId] ?? { id: plotId, unlocked: def.unlockedByDefault, building: null, constructedBuildingId: null };
    if (!state.unlocked) {
      // Level-gated plots already show a "Lv.X" badge right on the map —
      // nothing to tap into yet, since attempting is pointless until the
      // town's actually reached that level.
      if (def.minTownLevel && getTownLevel(developmentPoints) < def.minTownLevel) return;
      if (def.unlockCost) setUnlockTarget({ plotId, cost: def.unlockCost });
      return;
    }
    if (state.building) {
      // Already built — a shop-kind building reopens its (shared-stock)
      // shop modal; a decorative building (e.g. the garden) has nothing
      // further to show.
      const option = getBuildingOption(state.constructedBuildingId);
      if (option?.shopKind) setOpenShop(option.shopKind);
      return;
    }
    setConstructionTarget(plotId);
  };

  const handleUnlock = () => {
    if (!unlockTarget) return;
    const def = TOWN_PLOT_DEFS.find((p) => p.id === unlockTarget.plotId);
    if (tryUnlockPlot(unlockTarget.plotId, unlockTarget.cost, def?.minTownLevel)) {
      setUnlockTarget(null);
    }
  };

  const handleBuild = (optionId: string) => {
    if (!constructionTarget) return;
    if (constructBuilding(constructionTarget, optionId)) {
      setConstructionTarget(null);
    }
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
            onTownHallPress={() => setTownStatusVisible(true)}
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

      <TownStatusModal
        visible={townStatusVisible}
        developmentPoints={developmentPoints}
        onClose={() => setTownStatusVisible(false)}
      />

      <MerchantModal
        visible={merchantVisible}
        onClose={() => setMerchantVisible(false)}
        merchant={world.merchant}
        gold={gold}
        materials={materials}
        onBuyRecipe={buyMerchantRecipe}
        onSellMaterial={sellMaterialToMerchant}
      />

      <RecruitmentModal defId={pendingRecruit} onClose={() => setShownRecruitCount((c) => c + 1)} />

      <TownLevelUpModal level={pendingLevelUp} onClose={() => setShownLevelUpCount((c) => c + 1)} />

      <PlotUnlockModal
        visible={unlockTarget !== null}
        cost={unlockTarget?.cost ?? null}
        gold={gold}
        materials={materials}
        onUnlock={handleUnlock}
        onClose={() => setUnlockTarget(null)}
      />

      <ConstructionModal
        visible={constructionTarget !== null}
        gold={gold}
        materials={materials}
        onBuild={handleBuild}
        onClose={() => setConstructionTarget(null)}
      />

      <RecipeUnlockModal event={pendingRecipeUnlock} onClose={() => setShownRecipeUnlockCount((c) => c + 1)} />
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
