import React, { useEffect, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SHOW_ISOMETRIC_DEBUG_BUTTON } from '../game/config';
import { IsometricPrototypeScreen } from '../prototypes/isometric/IsometricPrototypeScreen';

import { usePlayerStore } from '../store/usePlayerStore';
import { useWorldStore } from '../store/useWorldStore';
import { useTownStore } from '../store/useTownStore';
import { TOWN_PLOT_DEFS } from '../data/townGrid';
import { getBuildingOption } from '../data/buildingOptions';
import { TownMap, DungeonMap, WORLD_CANVAS_HEIGHT, WORLD_CANVAS_WIDTH } from '../components/WorldMap';
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
import { SkillUnlockModal } from '../components/SkillUnlockModal';
import { TownStatusModal } from '../components/TownStatusModal';
import { MayorRoomModal } from '../components/MayorRoomModal';
import { FurnitureShopModal } from '../components/FurnitureShopModal';
import { MysteryShopModal } from '../components/MysteryShopModal';
import { HouseInventoryModal } from '../components/HouseInventoryModal';
import { HouseAssignModal } from '../components/HouseAssignModal';
import { GiftBirdModal } from '../components/GiftBirdModal';
import { HouseWarningModal } from '../components/HouseWarningModal';
import { HouseDepartureModal } from '../components/HouseDepartureModal';
import { CostumeCollectionModal } from '../components/CostumeCollectionModal';
import { CosmeticTicketModal } from '../components/CosmeticTicketModal';
import { ActivityLogPanel } from '../components/ActivityLogPanel';
import { JobPreset } from '../data/jobPresets';
import { HouseState, ItemId, PlotUnlockCost, ShopKind } from '../types';
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
  const depositFoodToHouse = useWorldStore((s) => s.depositFoodToHouse);
  const withdrawFoodFromHouse = useWorldStore((s) => s.withdrawFoodFromHouse);
  const favoriteTreasure = useWorldStore((s) => s.favoriteTreasure);
  const unfavoriteTreasure = useWorldStore((s) => s.unfavoriteTreasure);
  const setCosmetic = useWorldStore((s) => s.setCosmetic);
  const giveGiftToBird = useWorldStore((s) => s.giveGiftToBird);
  const plots = useTownStore((s) => s.plots);
  const houses = useTownStore((s) => s.houses);
  const developmentPoints = useTownStore((s) => s.developmentPoints);
  const townLevel = useTownStore((s) => s.townLevel);
  const townQuestIndex = useTownStore((s) => s.townQuestIndex);
  const levelUpEvents = useTownStore((s) => s.levelUpEvents);
  const tryUnlockPlot = useTownStore((s) => s.tryUnlockPlot);
  const constructBuilding = useTownStore((s) => s.constructBuilding);
  const buildHouse = useTownStore((s) => s.buildHouse);
  const assignHouseResident = useTownStore((s) => s.assignHouseResident);

  const [boardVisible, setBoardVisible] = useState(false);
  const [openShop, setOpenShop] = useState<ShopKind | null>(null);
  const [inventoryVisible, setInventoryVisible] = useState(false);
  const [rosterVisible, setRosterVisible] = useState(false);
  const [craftingVisible, setCraftingVisible] = useState(false);
  const [costumeCollectionVisible, setCostumeCollectionVisible] = useState(false);
  const [merchantVisible, setMerchantVisible] = useState(false);
  const [townStatusVisible, setTownStatusVisible] = useState(false);
  const [mayorRoomVisible, setMayorRoomVisible] = useState(false);
  const [furnitureShopVisible, setFurnitureShopVisible] = useState(false);
  const [mysteryShopVisible, setMysteryShopVisible] = useState(false);
  // Which bird's house is currently open (see HouseInventoryModal) — null
  // when closed. Tracks defId rather than a bare boolean since the modal
  // needs to know *whose* house it's showing.
  const [houseTarget, setHouseTarget] = useState<string | null>(null);
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
  // Same pattern again for Phase 11's skillUnlockEvents (also not persisted).
  const [shownSkillUnlockCount, setShownSkillUnlockCount] = useState(0);
  // Same pattern again for cosmeticTicketEvents (also not persisted).
  const [shownCosmeticTicketCount, setShownCosmeticTicketCount] = useState(0);
  // Phase-13 feasibility prototype debug entry (see config.ts's
  // SHOW_ISOMETRIC_DEBUG_BUTTON) — purely a local UI toggle, no store
  // involved, since the prototype doesn't touch any real game state.
  const [isoPrototypeVisible, setIsoPrototypeVisible] = useState(false);
  // Phase 14: while true, WorldMap shows its full-canvas tap overlay
  // instead of its usual sprite-by-sprite Pressables — tapping anywhere
  // attempts to build a vacant house there (see handleMapTap).
  const [placingHouse, setPlacingHouse] = useState(false);
  // A vacant (residentDefId: null) house currently showing HouseAssignModal
  // — null when closed. Tracks houseId rather than defId, unlike
  // houseTarget above, since a vacant house has no defId of its own yet.
  const [assignHouseTarget, setAssignHouseTarget] = useState<string | null>(null);
  // A bird currently showing GiftBirdModal (see BirdRosterModal's "🎁 なだめる"
  // button and HouseWarningModal's "プレゼントを渡す") — null when closed.
  const [giftTarget, setGiftTarget] = useState<string | null>(null);
  // Same not-persisted queued-event pattern as shownRecipeUnlockCount —
  // world.houseWarningEvents/houseDepartureEvents aren't persisted either
  // (only the houselessSinceMs timestamp driving them is), so starting at 0
  // never replays a stale backlog.
  const [shownHouseWarningCount, setShownHouseWarningCount] = useState(0);
  const [shownHouseDepartureCount, setShownHouseDepartureCount] = useState(0);
  // Map-split step 2: which of the two now-independent screens is currently
  // shown. Purely a local UI toggle — has no effect on simulation, which
  // keeps running for every bird every tick regardless of this value (see
  // useWorldStore.tick()); this only decides which of TownMap/DungeonMap
  // gets rendered, and which birds each one is handed (filtered by
  // bird.location below).
  const [activeScreen, setActiveScreen] = useState<'town' | 'dungeon'>('town');

  useEffect(() => {
    if (world.birds.length === 0) initWorld();
  }, [world.birds.length, initWorld]);

  // Dormant (not-yet-recruited) birds are still tracked in world.birds
  // (see useWorldStore) but never shown on the map or in the roster.
  const activeBirds = world.birds.filter((b) => b.isRecruited);
  const dormantDefIds = world.birds.filter((b) => !b.isRecruited).map((b) => b.defId);
  // Map-split step 2: each screen only draws the birds "in" it — the
  // underlying simulation (ai.ts/useWorldStore.tick()) still runs every
  // bird every tick no matter which screen is active, this is purely a
  // render-time filter.
  const townBirds = activeBirds.filter((b) => b.location === 'town');
  const dungeonBirds = activeBirds.filter((b) => b.location === 'dungeon');

  // RecruitmentModal/TownLevelUpModal/RecipeUnlockModal/SkillUnlockModal each
  // render their own <Modal> the instant their queued event is non-null,
  // completely independent of whatever the player currently has open — a
  // request-board check, a shop, a construction menu, etc. A background
  // world tick can queue one of these at any moment, so without this guard
  // it could pop open *while* another <Modal> is already visible,
  // presenting two native iOS modals at once. That's a known react-native/
  // iOS fragility (real-device report: taps go dead after navigating
  // between screens, fixed only by a full app restart) — so these four are
  // only allowed to actually show once nothing else is open, in a fixed
  // priority order. Nothing is lost by delaying them: the underlying
  // arrays/counters are untouched, so each still shows exactly once, just
  // possibly a beat later.
  const anyOtherModalOpen =
    boardVisible ||
    openShop !== null ||
    inventoryVisible ||
    rosterVisible ||
    craftingVisible ||
    costumeCollectionVisible ||
    merchantVisible ||
    townStatusVisible ||
    mayorRoomVisible ||
    furnitureShopVisible ||
    mysteryShopVisible ||
    houseTarget !== null ||
    unlockTarget !== null ||
    constructionTarget !== null ||
    assignHouseTarget !== null ||
    giftTarget !== null;
  const pendingRecruit = anyOtherModalOpen ? null : world.recruitmentEvents[shownRecruitCount] ?? null;
  const pendingLevelUp = anyOtherModalOpen || pendingRecruit ? null : levelUpEvents[shownLevelUpCount] ?? null;
  const pendingRecipeUnlock =
    anyOtherModalOpen || pendingRecruit || pendingLevelUp ? null : world.recipeUnlockEvents[shownRecipeUnlockCount] ?? null;
  const pendingSkillUnlock =
    anyOtherModalOpen || pendingRecruit || pendingLevelUp || pendingRecipeUnlock
      ? null
      : world.skillUnlockEvents[shownSkillUnlockCount] ?? null;
  const pendingCosmeticTicket =
    anyOtherModalOpen || pendingRecruit || pendingLevelUp || pendingRecipeUnlock || pendingSkillUnlock
      ? null
      : world.cosmeticTicketEvents[shownCosmeticTicketCount] ?? null;
  const pendingHouseWarning =
    anyOtherModalOpen || pendingRecruit || pendingLevelUp || pendingRecipeUnlock || pendingSkillUnlock || pendingCosmeticTicket
      ? null
      : world.houseWarningEvents[shownHouseWarningCount] ?? null;
  const pendingHouseDeparture =
    anyOtherModalOpen ||
    pendingRecruit ||
    pendingLevelUp ||
    pendingRecipeUnlock ||
    pendingSkillUnlock ||
    pendingCosmeticTicket ||
    pendingHouseWarning
      ? null
      : world.houseDepartureEvents[shownHouseDepartureCount] ?? null;

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
      if (def.minTownLevel && townLevel < def.minTownLevel) return;
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
    // Construction eligibility is governed purely by unlock state + town
    // level (already checked above/below). Map-split step 2 removed the old
    // town-zone ellipse entirely — the town screen is now its own
    // independent space, so there's no separate "inside the zone" gate to
    // worry about here anymore.
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

  // Phase 14: houses are the first (and so far only) freely-placed building
  // — tapping the map while placingHouse is true attempts to build a vacant
  // house right there (see useTownStore's buildHouse for the zone/overlap/
  // cost checks). Deliberately stays in placement mode on failure so the
  // player can just try another spot, with a quick alert explaining why.
  const handleMapTap = (x: number, y: number) => {
    if (buildHouse(x, y)) {
      setPlacingHouse(false);
    } else {
      Alert.alert('ここには建てられません', '街の外か、何かに近すぎるか、費用が足りない可能性があります。');
    }
  };

  const handleHousePress = (house: HouseState) => {
    if (house.residentDefId) {
      setHouseTarget(house.residentDefId);
    } else {
      setAssignHouseTarget(house.id);
    }
  };

  const handleAssignResident = (defId: string) => {
    if (!assignHouseTarget) return;
    if (assignHouseResident(assignHouseTarget, defId)) {
      setAssignHouseTarget(null);
    }
  };

  const handleGiftBird = (defId: string, itemId: ItemId) => {
    if (giveGiftToBird(defId, itemId)) {
      setGiftTarget(null);
    }
  };

  // Phase 15③: 3 of the 5 new shop kinds don't fit ShopModal's plain
  // ItemDef-shelf model at all (see data/shops.ts's own comment) — each
  // opens its own dedicated screen instead. 'restaurant'/'toy' behave
  // exactly like the original 4 kinds, so they fall through to ShopModal.
  const handleShopPress = (kind: ShopKind) => {
    if (kind === 'clothing') {
      setCostumeCollectionVisible(true);
    } else if (kind === 'furniture') {
      setFurnitureShopVisible(true);
    } else if (kind === 'mystery') {
      setMysteryShopVisible(true);
    } else {
      setOpenShop(kind);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
          🏡 トロロの街
        </Text>
        {/* Real-device report: the 5th icon (📐) was invisible on narrower
            phones — this row had no wrap/scroll, so once gold pill + 5
            buttons stopped fitting next to the title, the rightmost
            (newest) button simply rendered past the screen's right edge
            instead of being clipped visibly or squeezed smaller. A
            horizontal ScrollView guarantees every button stays reachable
            (swipe right) regardless of screen width or how many more get
            added later, instead of silently overflowing off-screen. */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.topBarRightScroll}
          contentContainerStyle={styles.topBarRight}
        >
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
          <AnimatedPressable style={styles.inventoryButton} onPress={() => setCostumeCollectionVisible(true)}>
            <Text style={styles.inventoryButtonText}>🎁</Text>
          </AnimatedPressable>
          <AnimatedPressable style={styles.inventoryButton} onPress={() => setInventoryVisible(true)}>
            <Text style={styles.inventoryButtonText}>🎒</Text>
          </AnimatedPressable>
          <AnimatedPressable
            style={[styles.inventoryButton, placingHouse && styles.inventoryButtonActive]}
            onPress={() => setPlacingHouse((v) => !v)}
          >
            <Text style={styles.inventoryButtonText}>🏠+</Text>
          </AnimatedPressable>
          {SHOW_ISOMETRIC_DEBUG_BUTTON ? (
            <AnimatedPressable style={styles.inventoryButton} onPress={() => setIsoPrototypeVisible(true)}>
              <Text style={styles.inventoryButtonText}>📐</Text>
            </AnimatedPressable>
          ) : null}
        </ScrollView>
      </View>

      {placingHouse && (
        <View style={styles.placementBanner}>
          <Text style={styles.placementBannerText}>街エリア内をタップして、空き家を建てる場所を選んでください</Text>
          <AnimatedPressable style={styles.placementCancelButton} onPress={() => setPlacingHouse(false)}>
            <Text style={styles.placementCancelButtonText}>✕ やめる</Text>
          </AnimatedPressable>
        </View>
      )}

      <View style={styles.screenTabRow}>
        <AnimatedPressable
          style={[styles.screenTab, activeScreen === 'town' && styles.screenTabActive]}
          onPress={() => setActiveScreen('town')}
        >
          <Text style={[styles.screenTabText, activeScreen === 'town' && styles.screenTabTextActive]}>🏡 街</Text>
        </AnimatedPressable>
        <AnimatedPressable
          style={[styles.screenTab, activeScreen === 'dungeon' && styles.screenTabActive]}
          onPress={() => setActiveScreen('dungeon')}
        >
          <Text style={[styles.screenTabText, activeScreen === 'dungeon' && styles.screenTabTextActive]}>🌲 ダンジョン</Text>
        </AnimatedPressable>
      </View>

      <View style={styles.mapWrap}>
        <PannableMap contentWidth={WORLD_CANVAS_WIDTH} contentHeight={WORLD_CANVAS_HEIGHT} initialFocus={{ x: TOWN_X, y: TOWN_Y }}>
          {activeScreen === 'town' ? (
            <TownMap
              birds={townBirds}
              plotStates={plots}
              houses={houses}
              townLevel={townLevel}
              merchant={world.merchant}
              onBirdPress={() => setRosterVisible(true)}
              onPlotPress={handlePlotPress}
              onShopPress={handleShopPress}
              onMerchantPress={() => setMerchantVisible(true)}
              onTownHallPress={() => setTownStatusVisible(true)}
              onHousePress={handleHousePress}
              placementMode={placingHouse}
              onMapTap={handleMapTap}
              onDungeonGatePress={() => setActiveScreen('dungeon')}
            />
          ) : (
            <DungeonMap
              enemies={world.enemies}
              miningNodes={world.miningNodes}
              treasures={world.treasures}
              leisureSpots={world.leisureSpots}
              birds={dungeonBirds}
              dormantDefIds={dormantDefIds}
              onBirdPress={() => setRosterVisible(true)}
              onTownGatePress={() => setActiveScreen('town')}
            />
          )}
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

      <CostumeCollectionModal visible={costumeCollectionVisible} onClose={() => setCostumeCollectionVisible(false)} />

      <PlayerInventoryModal
        visible={inventoryVisible}
        onClose={() => setInventoryVisible(false)}
        gold={gold}
        materials={materials}
        items={items}
      />

      <BirdRosterModal
        visible={rosterVisible}
        onClose={() => setRosterVisible(false)}
        birds={activeBirds}
        onSetCosmetic={setCosmetic}
        onGiftBird={(defId) => {
          // Closes BirdRosterModal before opening GiftBirdModal rather than
          // stacking them — two native Modals visible at once has been a
          // real dead-taps bug in this app before (see anyOtherModalOpen's
          // own comment).
          setRosterVisible(false);
          setGiftTarget(defId);
        }}
      />

      <TownStatusModal
        visible={townStatusVisible}
        townLevel={townLevel}
        townQuestIndex={townQuestIndex}
        developmentPoints={developmentPoints}
        onClose={() => setTownStatusVisible(false)}
        onOpenMayorRoom={() => {
          setTownStatusVisible(false);
          setMayorRoomVisible(true);
        }}
      />

      <MayorRoomModal visible={mayorRoomVisible} onClose={() => setMayorRoomVisible(false)} />

      <FurnitureShopModal visible={furnitureShopVisible} onClose={() => setFurnitureShopVisible(false)} />

      <MysteryShopModal visible={mysteryShopVisible} onClose={() => setMysteryShopVisible(false)} />

      <HouseInventoryModal
        visible={houseTarget !== null}
        onClose={() => setHouseTarget(null)}
        bird={activeBirds.find((b) => b.defId === houseTarget) ?? null}
        playerItems={items}
        onDepositFood={depositFoodToHouse}
        onWithdrawFood={withdrawFoodFromHouse}
        onFavoriteTreasure={favoriteTreasure}
        onUnfavoriteTreasure={unfavoriteTreasure}
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

      <TownLevelUpModal event={pendingLevelUp} onClose={() => setShownLevelUpCount((c) => c + 1)} />

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

      <SkillUnlockModal event={pendingSkillUnlock} onClose={() => setShownSkillUnlockCount((c) => c + 1)} />

      <CosmeticTicketModal event={pendingCosmeticTicket} onClose={() => setShownCosmeticTicketCount((c) => c + 1)} />

      <HouseAssignModal
        visible={assignHouseTarget !== null}
        candidates={activeBirds.filter((b) => !Object.values(houses).some((h) => h.residentDefId === b.defId))}
        onAssign={handleAssignResident}
        onClose={() => setAssignHouseTarget(null)}
      />

      <GiftBirdModal
        bird={activeBirds.find((b) => b.defId === giftTarget) ?? null}
        playerItems={items}
        onGift={handleGiftBird}
        onClose={() => setGiftTarget(null)}
      />

      <HouseWarningModal
        event={pendingHouseWarning}
        onGift={(defId) => {
          setShownHouseWarningCount((c) => c + 1);
          setGiftTarget(defId);
        }}
        onClose={() => setShownHouseWarningCount((c) => c + 1)}
      />

      <HouseDepartureModal event={pendingHouseDeparture} onClose={() => setShownHouseDepartureCount((c) => c + 1)} />

      {SHOW_ISOMETRIC_DEBUG_BUTTON ? (
        <Modal visible={isoPrototypeVisible} animationType="slide" onRequestClose={() => setIsoPrototypeVisible(false)}>
          <IsometricPrototypeScreen onClose={() => setIsoPrototypeVisible(false)} />
        </Modal>
      ) : null}
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
  title: { fontSize: 20, fontWeight: '800', color: theme.textPrimary, letterSpacing: 0.3, flexShrink: 1, marginRight: 8 },
  // flexShrink: 0 keeps the icon row's own natural (un-squeezed) size — it's
  // the ScrollView around it that absorbs any leftover-space shortage by
  // becoming scrollable, rather than the buttons themselves shrinking.
  topBarRightScroll: { flexGrow: 0, flexShrink: 0, maxWidth: '62%' },
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
  inventoryButtonActive: { backgroundColor: theme.gold, borderColor: theme.gold },
  placementBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 12,
    marginTop: 8,
    backgroundColor: theme.cardAlt,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: theme.gold,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  placementBannerText: { flex: 1, fontSize: 12, fontWeight: '700', color: theme.textPrimary, marginRight: 8 },
  placementCancelButton: { backgroundColor: theme.card, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  placementCancelButtonText: { fontSize: 11, fontWeight: '700', color: theme.textSecondary },
  screenTabRow: { flexDirection: 'row', paddingHorizontal: 12, marginTop: 8, gap: 8 },
  screenTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: theme.card,
    borderWidth: 1.5,
    borderColor: theme.cardBorder,
  },
  screenTabActive: { backgroundColor: theme.gold, borderColor: theme.gold },
  screenTabText: { fontSize: 13, fontWeight: '700', color: theme.textSecondary },
  screenTabTextActive: { color: '#fff' },
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
