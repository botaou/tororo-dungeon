import React, { useEffect, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SHOW_ISOMETRIC_DEBUG_BUTTON } from '../game/config';
import { IsometricPrototypeScreen } from '../prototypes/isometric/IsometricPrototypeScreen';

import { usePlayerStore } from '../store/usePlayerStore';
import { useWorldStore } from '../store/useWorldStore';
import { useCosmeticStore } from '../store/useCosmeticStore';
import { useMayorRoomStore } from '../store/useMayorRoomStore';
import { isBuildingPlacementBlocked, useTownStore } from '../store/useTownStore';
import { getTownBuildingCap } from '../data/townGrid';
import { getBuildingOption } from '../data/buildingOptions';
import {
  TownMap,
  DungeonMap,
  TOWN_ISO_CANVAS_HEIGHT,
  TOWN_ISO_CANVAS_WIDTH,
  WORLD_CANVAS_HEIGHT,
  WORLD_CANVAS_WIDTH,
} from '../components/WorldMap';
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
import { HouseState, ItemId, ShopKind } from '../types';
import { cuteShadow, theme } from '../theme';

// Stable module-level reference (not `{ x: TOWN_X, y: TOWN_Y }` written
// inline at the call site) — TownScreen re-renders on every game tick, and
// a fresh object literal there would still be a new reference each time.
// PannableMap's own memoization keys off the primitive x/y instead of this
// object's identity, but keeping this stable too removes any doubt.
const TOWN_FOCUS = { x: TOWN_X, y: TOWN_Y };

// UX改善: building placement/relocation used to only support "tap
// somewhere, that's the new spot" — no way to nudge a spot that's *almost*
// right. A grid-space step of 0.01 (TOWN_BUILDING_CLEARANCE is 0.06, so this
// is roughly 1/6 of the minimum gap between buildings) gives fine enough
// control to slide a preview out from under a blocked overlap without
// forcing a fresh, hard-to-land tap.
const PLACEMENT_NUDGE_STEP = 0.01;

export function TownScreen() {
  const gold = usePlayerStore((s) => s.gold);
  const materials = usePlayerStore((s) => s.materials);
  const items = usePlayerStore((s) => s.items);
  const shopStock = usePlayerStore((s) => s.shopStock);
  const sellMaterialToMerchant = usePlayerStore((s) => s.sellMaterialToMerchant);
  const cosmeticShelfCounts = useCosmeticStore((s) => s.shelfCounts);
  const furnitureCraftedStock = useMayorRoomStore((s) => s.craftedStock);
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
  const buildings = useTownStore((s) => s.buildings);
  const houses = useTownStore((s) => s.houses);
  const developmentPoints = useTownStore((s) => s.developmentPoints);
  const townLevel = useTownStore((s) => s.townLevel);
  const townQuestIndex = useTownStore((s) => s.townQuestIndex);
  const levelUpEvents = useTownStore((s) => s.levelUpEvents);
  const constructBuilding = useTownStore((s) => s.constructBuilding);
  const moveBuilding = useTownStore((s) => s.moveBuilding);
  const buildHouse = useTownStore((s) => s.buildHouse);
  const assignHouseResident = useTownStore((s) => s.assignHouseResident);

  const [boardVisible, setBoardVisible] = useState(false);
  const [openShop, setOpenShop] = useState<ShopKind | null>(null);
  const [inventoryVisible, setInventoryVisible] = useState(false);
  const [rosterVisible, setRosterVisible] = useState(false);
  // UX改善: null shows the full roster (unchanged default); a defId shows
  // just that one bird's card (see BirdRosterModal's own focusDefId prop) —
  // set when a bird's own map sprite is tapped directly, or via
  // HouseInventoryModal's "📊 ステータスを見る" shortcut.
  const [rosterFocusDefId, setRosterFocusDefId] = useState<string | null>(null);
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
  // Step B (building free placement): whether the building-type picker (see
  // ConstructionModal) is currently open.
  const [buildMenuVisible, setBuildMenuVisible] = useState(false);
  // Which BuildingOption the player picked from that menu — non-null means
  // the map is in building-placement mode (see placingHouse's own
  // established pattern below). Unlike a house, tapping doesn't build
  // immediately: it just drops/moves a preview (see previewPosition) that
  // still needs an explicit confirm.
  const [placingBuildingOptionId, setPlacingBuildingOptionId] = useState<string | null>(null);
  // Where the semi-transparent placement preview currently sits (see
  // WorldMap's PlacementPreviewSprite) — null until the player taps
  // somewhere at least once. Re-tapping anywhere just moves this, same spot
  // as before; only handleConfirmBuild actually spends anything.
  const [previewPosition, setPreviewPosition] = useState<{ x: number; y: number } | null>(null);
  // Non-null while relocating an already-built building (see
  // handleStartMoveBuilding) — shares the exact same placement-mode/
  // previewPosition/confirm-button UI as fresh construction above, except
  // the confirm calls moveBuilding instead of constructBuilding, and this
  // building itself is hidden from the map (see visibleBuildings below) so
  // the ghost preview doesn't appear to be a second copy of it.
  const [movingBuildingId, setMovingBuildingId] = useState<string | null>(null);
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
  // Real-device report: after item 69's key={activeScreen} fix made
  // switching screens unmount the outgoing PannableMap/ScrollView and mount
  // a fresh one in the very same commit, a screen reached right after
  // actively pinching on the *other* one came back frozen (stuck offset,
  // dead gestures) — and once frozen, switching back and forth no longer
  // recovered it, even though each switch is a genuine fresh mount. That
  // points at the *native* gesture recognizer/touch-responder layer still
  // being mid-teardown from the just-used ScrollView at the exact moment
  // the new one claims the same screen space, not at anything in this
  // component's own JS state. `mapTransitioning` inserts a couple of empty
  // frames — nothing mounted in mapWrap at all — between the old
  // PannableMap unmounting and the new one mounting, giving iOS a clear
  // window to fully release the outgoing gesture recognizer first.
  const [mapTransitioning, setMapTransitioning] = useState(false);
  const switchScreen = (target: 'town' | 'dungeon') => {
    if (target === activeScreen) return;
    setMapTransitioning(true);
    setActiveScreen(target);
    requestAnimationFrame(() => requestAnimationFrame(() => setMapTransitioning(false)));
  };

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

  // UX改善(③): a small "営業中/品切れ中" badge over each shop building — a
  // quick, at-a-glance preview of whether it's currently worth a visit,
  // without having to open it. Each shop kind's own notion of "has stock"
  // differs (see the 3 separate systems documented in item 80/81/82's
  // README entries), so this normalizes them all into one boolean map:
  // the 6 category shops + clothing + mystery read their own shelf/
  // shopStock, and furniture reads craftedStock (unplaced-but-ready
  // pieces) as its closest equivalent, since it has no shelf of its own.
  const shopHasStock: Partial<Record<ShopKind, boolean>> = {
    general: Object.values(shopStock.general).some((n) => (n ?? 0) > 0),
    feed: Object.values(shopStock.feed).some((n) => (n ?? 0) > 0),
    weapon: Object.values(shopStock.weapon).some((n) => (n ?? 0) > 0),
    armor: Object.values(shopStock.armor).some((n) => (n ?? 0) > 0),
    restaurant: Object.values(shopStock.restaurant).some((n) => (n ?? 0) > 0),
    toy: Object.values(shopStock.toy).some((n) => (n ?? 0) > 0),
    clothing: Object.values(cosmeticShelfCounts).some((n) => (n ?? 0) > 0),
    mystery: Object.values(shopStock.mystery).some((n) => (n ?? 0) > 0),
    furniture: Object.values(furnitureCraftedStock).some((n) => (n ?? 0) > 0),
  };

  // While relocating a building (see movingBuildingId), hide it from the
  // map entirely — the ghost preview (see previewBuilding below) already
  // represents it at its candidate new spot, so leaving the real one
  // rendered at its old spot too would look like two copies of the same
  // building. This also means the dynamically-generated roads (see
  // WorldMap's TownMap) naturally skip it too, since they're derived from
  // this same filtered object.
  const visibleBuildings = movingBuildingId
    ? Object.fromEntries(Object.entries(buildings).filter(([id]) => id !== movingBuildingId))
    : buildings;

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
    buildMenuVisible ||
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

  // Step B (building free placement) + this round's relocation feature:
  // tapping an already-built building now shows a short menu instead of
  // going straight to its shop — "商品を見る" (shop-kind buildings only) and
  // "移動する" (every building). A decorative building (e.g. the garden) just
  // gets the move option, same as before it had nothing to show at all.
  const handleBuildingPress = (buildingId: string) => {
    const building = buildings[buildingId];
    if (!building) return;
    const option = getBuildingOption(building.constructedBuildingId);
    const buttons: { text: string; onPress?: () => void; style?: 'cancel' | 'destructive' }[] = [];
    if (option?.shopKind) buttons.push({ text: '商品を見る', onPress: () => handleShopPress(option.shopKind!) });
    buttons.push({ text: '移動する', onPress: () => handleStartMoveBuilding(buildingId) });
    buttons.push({ text: 'キャンセル', style: 'cancel' });
    Alert.alert(option?.name ?? '建物', undefined, buttons);
  };

  // Enters the exact same placement-mode/preview/confirm flow as fresh
  // construction (see placingBuildingOptionId above), except for relocating
  // this already-built building instead. Seeds previewPosition with the
  // building's own current spot so the ghost preview starts exactly where
  // it already stands — confirming without tapping anywhere else is a
  // (harmless) no-op move back to the same place.
  const handleStartMoveBuilding = (buildingId: string) => {
    const building = buildings[buildingId];
    if (!building) return;
    setMovingBuildingId(buildingId);
    setPreviewPosition({ x: building.x, y: building.y });
  };

  // Picking an option from ConstructionModal doesn't build immediately
  // anymore — it closes the picker and enters placement mode, same shape as
  // Phase 14's house placement (see placingHouse below), except a building
  // gets a preview-then-confirm step (see previewPosition) rather than
  // building the instant the player taps.
  const handleSelectBuildingOption = (optionId: string) => {
    setBuildMenuVisible(false);
    setPlacingBuildingOptionId(optionId);
    setPreviewPosition(null);
  };

  // Tapping the map while placing a building never builds directly — it
  // just drops (or moves) the preview sprite there, so the player can see
  // exactly where it'll land, and whether that spot is currently blocked
  // (see WorldMap's PlacementPreviewSprite), before committing.
  const handleBuildMapTap = (x: number, y: number) => {
    setPreviewPosition({ x, y });
  };

  // Fine-adjust an already-dropped preview by a small fixed step, instead
  // of needing to land a fresh tap exactly where the last one fell short.
  // Clamped to the canvas's own 0..1 normalized range — isBuildingPlacementBlocked
  // (already checked by the confirm button's own disabled state) is what
  // actually decides whether a spot is usable, this just keeps the preview
  // from drifting off the map entirely.
  const handleNudgePreview = (dx: number, dy: number) => {
    setPreviewPosition((prev) => (prev ? { x: Math.min(1, Math.max(0, prev.x + dx)), y: Math.min(1, Math.max(0, prev.y + dy)) } : prev));
  };

  // The explicit "ここに建てる"/"ここに移動する" confirm — only this actually
  // spends gold/materials and creates the building (constructBuilding) or,
  // while relocating (movingBuildingId), moves the existing one instead
  // (moveBuilding) — both re-validate clearance themselves; the preview's
  // own green/red tint is just a read-only hint, not the source of truth.
  // Deliberately stays in placement mode (preview intact) on failure so the
  // player can just try again, with a quick alert.
  const handleConfirmBuild = () => {
    if (!previewPosition) return;
    if (movingBuildingId) {
      if (moveBuilding(movingBuildingId, previewPosition.x, previewPosition.y)) {
        setMovingBuildingId(null);
        setPreviewPosition(null);
      } else {
        Alert.alert('ここには移動できません', '何かに近すぎる可能性があります。');
      }
      return;
    }
    if (!placingBuildingOptionId) return;
    if (constructBuilding(placingBuildingOptionId, previewPosition.x, previewPosition.y)) {
      setPlacingBuildingOptionId(null);
      setPreviewPosition(null);
    } else {
      Alert.alert('ここには建てられません', '何かに近すぎるか、上限に達しているか、費用が足りない可能性があります。');
    }
  };

  const handleCancelBuildPlacement = () => {
    setPlacingBuildingOptionId(null);
    setMovingBuildingId(null);
    setPreviewPosition(null);
  };

  // Phase 14's house placement and Step B's building placement (+ this
  // round's building relocation) share the exact same "whole map becomes
  // one big tap target" mechanism (see WorldMap's placementMode/onMapTap)
  // — this dispatches to whichever one is actually active. Deliberately
  // stays in placement mode on failure so the player can just try another
  // spot, with a quick alert explaining why.
  const handleMapTap = (x: number, y: number) => {
    if (placingHouse) {
      if (buildHouse(x, y)) {
        setPlacingHouse(false);
      } else {
        Alert.alert('ここには建てられません', '街の外か、何かに近すぎるか、費用が足りない可能性があります。');
      }
    } else if (placingBuildingOptionId || movingBuildingId) {
      handleBuildMapTap(x, y);
    }
  };

  // UX改善: tapping a bird's own sprite now jumps straight to that one
  // bird's individual status card (see BirdRosterModal's focusDefId) rather
  // than opening the same full roster every time — WorldMap's onBirdPress
  // already passed the tapped bird's defId, it just wasn't being used.
  const handleBirdPress = (defId: string) => {
    setRosterFocusDefId(defId);
    setRosterVisible(true);
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
          <AnimatedPressable
            style={styles.inventoryButton}
            onPress={() => {
              setRosterFocusDefId(null);
              setRosterVisible(true);
            }}
          >
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
          <AnimatedPressable
            style={[styles.inventoryButton, placingBuildingOptionId !== null && styles.inventoryButtonActive]}
            onPress={() => setBuildMenuVisible(true)}
          >
            <Text style={styles.inventoryButtonText}>🏗️</Text>
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

      {(placingBuildingOptionId !== null || movingBuildingId !== null) &&
        (() => {
          // The building relocation feature reuses this exact banner/preview
          // flow — the only difference is which optionId's art to preview
          // (the freshly-picked one, or the moving building's own existing
          // one) and the wording ("建てる" vs "移動する").
          const activeOptionId = movingBuildingId
            ? buildings[movingBuildingId]?.constructedBuildingId ?? null
            : placingBuildingOptionId;
          const buildingName = activeOptionId ? getBuildingOption(activeOptionId)?.name ?? '建物' : '建物';
          const verb = movingBuildingId ? '移動' : '建設';
          return (
            <View style={[styles.placementBanner, styles.placementBannerColumn]}>
              <Text style={styles.placementBannerText}>
                {previewPosition
                  ? `${buildingName}をここに${verb}しますか?タップし直すか、矢印で微調整できます`
                  : `${buildingName}の${verb}先をタップしてください`}
              </Text>
              <View style={styles.placementControlsRow}>
                {previewPosition && (
                  <View style={styles.nudgePad}>
                    <AnimatedPressable style={styles.nudgeButton} onPress={() => handleNudgePreview(0, -PLACEMENT_NUDGE_STEP)}>
                      <Text style={styles.nudgeButtonText}>↑</Text>
                    </AnimatedPressable>
                    <View style={styles.nudgePadMidRow}>
                      <AnimatedPressable style={styles.nudgeButton} onPress={() => handleNudgePreview(-PLACEMENT_NUDGE_STEP, 0)}>
                        <Text style={styles.nudgeButtonText}>←</Text>
                      </AnimatedPressable>
                      <View style={styles.nudgeButtonSpacer} />
                      <AnimatedPressable style={styles.nudgeButton} onPress={() => handleNudgePreview(PLACEMENT_NUDGE_STEP, 0)}>
                        <Text style={styles.nudgeButtonText}>→</Text>
                      </AnimatedPressable>
                    </View>
                    <AnimatedPressable style={styles.nudgeButton} onPress={() => handleNudgePreview(0, PLACEMENT_NUDGE_STEP)}>
                      <Text style={styles.nudgeButtonText}>↓</Text>
                    </AnimatedPressable>
                  </View>
                )}
                <View style={styles.placementButtonRow}>
                  {previewPosition &&
                    (() => {
                      const blocked = isBuildingPlacementBlocked(
                        previewPosition.x,
                        previewPosition.y,
                        movingBuildingId ?? undefined
                      );
                      return (
                        <AnimatedPressable
                          style={[styles.placementConfirmButton, blocked && styles.placementConfirmButtonDisabled]}
                          onPress={blocked ? undefined : handleConfirmBuild}
                          disabled={blocked}
                        >
                          <Text style={styles.placementConfirmButtonText}>ここに{verb}する</Text>
                        </AnimatedPressable>
                      );
                    })()}
                  <AnimatedPressable style={styles.placementCancelButton} onPress={handleCancelBuildPlacement}>
                    <Text style={styles.placementCancelButtonText}>✕ やめる</Text>
                  </AnimatedPressable>
                </View>
              </View>
            </View>
          );
        })()}

      <View style={styles.screenTabRow}>
        <AnimatedPressable
          style={[styles.screenTab, activeScreen === 'town' && styles.screenTabActive]}
          onPress={() => switchScreen('town')}
        >
          <Text style={[styles.screenTabText, activeScreen === 'town' && styles.screenTabTextActive]}>🏡 街</Text>
        </AnimatedPressable>
        <AnimatedPressable
          style={[styles.screenTab, activeScreen === 'dungeon' && styles.screenTabActive]}
          onPress={() => switchScreen('dungeon')}
        >
          <Text style={[styles.screenTabText, activeScreen === 'dungeon' && styles.screenTabTextActive]}>🌲 ダンジョン</Text>
        </AnimatedPressable>
      </View>

      <View style={styles.mapWrap}>
        {/* Step C's iso-overlap bugfix: TownMap now has its own, bigger
            canvas (TOWN_ISO_CANVAS_WIDTH/HEIGHT) than DungeonMap's original
            WORLD_CANVAS_WIDTH/HEIGHT — see WorldMap.tsx's TOWN_ISO_TILE
            comment for why. Bugfix (real-device report: map froze solid
            after switching dungeon->town): `key={activeScreen}` forces a
            fresh PannableMap/ScrollView mount on every tab switch instead
            of trying to resize a live one — see PannableMap's own comment
            for why reusing one across a canvas-size change broke native
            zoom/gesture state. Further bugfix (see mapTransitioning's own
            comment above): nothing is mounted here at all for a couple of
            frames right after a switch, so a just-active gesture
            recognizer on the outgoing ScrollView has time to fully tear
            down before the new one appears. */}
        {!mapTransitioning && (
          <PannableMap
            key={activeScreen}
            contentWidth={activeScreen === 'town' ? TOWN_ISO_CANVAS_WIDTH : WORLD_CANVAS_WIDTH}
            contentHeight={activeScreen === 'town' ? TOWN_ISO_CANVAS_HEIGHT : WORLD_CANVAS_HEIGHT}
            initialFocus={TOWN_FOCUS}
          >
            {activeScreen === 'town' ? (
              <TownMap
                birds={townBirds}
                buildings={visibleBuildings}
                houses={houses}
                townLevel={townLevel}
                merchant={world.merchant}
                onBirdPress={handleBirdPress}
                onBuildingPress={handleBuildingPress}
                shopHasStock={shopHasStock}
                onMerchantPress={() => setMerchantVisible(true)}
                onTownHallPress={() => setTownStatusVisible(true)}
                onHousePress={handleHousePress}
                placementMode={placingHouse || placingBuildingOptionId !== null || movingBuildingId !== null}
                onMapTap={handleMapTap}
                previewBuilding={(() => {
                  if (!previewPosition) return null;
                  const optionId = movingBuildingId
                    ? buildings[movingBuildingId]?.constructedBuildingId ?? null
                    : placingBuildingOptionId;
                  if (!optionId) return null;
                  return {
                    x: previewPosition.x,
                    y: previewPosition.y,
                    optionId,
                    blocked: isBuildingPlacementBlocked(previewPosition.x, previewPosition.y, movingBuildingId ?? undefined),
                  };
                })()}
                onDungeonGatePress={() => switchScreen('dungeon')}
              />
            ) : (
              <DungeonMap
                enemies={world.enemies}
                miningNodes={world.miningNodes}
                treasures={world.treasures}
                leisureSpots={world.leisureSpots}
                birds={dungeonBirds}
                dormantDefIds={dormantDefIds}
                onBirdPress={handleBirdPress}
                onTownGatePress={() => switchScreen('town')}
              />
            )}
          </PannableMap>
        )}
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
        focusDefId={rosterFocusDefId}
        onShowAll={() => setRosterFocusDefId(null)}
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
        onViewStatus={(defId) => {
          // Same close-before-open pattern as onGiftBird above — avoids
          // stacking two native Modals at once.
          setHouseTarget(null);
          setRosterFocusDefId(defId);
          setRosterVisible(true);
        }}
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

      <ConstructionModal
        visible={buildMenuVisible}
        gold={gold}
        materials={materials}
        builtCount={Object.keys(buildings).length}
        cap={getTownBuildingCap(townLevel)}
        onSelect={handleSelectBuildingOption}
        onClose={() => setBuildMenuVisible(false)}
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
  // The building-placement banner (unlike the plain house-placement one)
  // needs a second row underneath its text for the nudge pad + confirm/
  // cancel buttons — a column layout instead of placementBanner's own row.
  placementBannerColumn: { flexDirection: 'column', alignItems: 'stretch' },
  placementControlsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  nudgePad: { alignItems: 'center', gap: 4 },
  nudgePadMidRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  nudgeButton: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: theme.card,
    borderWidth: 1.5,
    borderColor: theme.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nudgeButtonText: { fontSize: 14, fontWeight: '800', color: theme.textPrimary },
  nudgeButtonSpacer: { width: 30, height: 30 },
  placementButtonRow: { flexDirection: 'row', gap: 8 },
  placementConfirmButton: { backgroundColor: theme.gold, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  placementConfirmButtonDisabled: { backgroundColor: theme.disabled },
  placementConfirmButtonText: { fontSize: 11, fontWeight: '700', color: '#fff' },
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
