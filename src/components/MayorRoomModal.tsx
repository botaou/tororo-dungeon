import React, { useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TouchableWithoutFeedback, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FURNITURE_DEF_MAP, FURNITURE_DEFS } from '../data/furniture';
import { ITEM_DEF_MAP } from '../data/items';
import { MAYOR_ROOM_GIFT_PILE_VISUAL_CAP } from '../game/config';
import { useMayorRoomStore } from '../store/useMayorRoomStore';
import { AnimatedPressable } from './AnimatedPressable';
import { GiftPileModal } from './GiftPileModal';
import { theme } from '../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
}

// A dedicated square canvas the room's own furniture x/y (0..1, see
// FurnitureInstance) is drawn against — deliberately its own fixed size, not
// tied to WorldMap's WORLD_CANVAS_WIDTH/HEIGHT, since this is a small closed
// room, not a scrollable outdoor map.
const ROOM_SIZE = 300;

// Item 85: where the gift pile visually sits in the room (0..1, same
// coordinate space as furniture) — a fixed spot rather than following any
// particular furniture layout, since the pile is meant to read as clutter
// dumped near the door, not a deliberately placed decoration.
const PILE_ANCHOR = { x: 0.5, y: 0.84 };
const PILE_HIT_SIZE = { width: 110, height: 80 };

// Cheap, deterministic (same input → same output every render, no useState/
// useMemo needed) pseudo-random hash — just enough to scatter the pile's
// gift emoji into a "messy heap" look instead of a perfect grid, without
// re-jittering on every re-render the way Math.random() would.
function hash01(n: number): number {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

// Phase 15①: the town hall's own customization space — tap a furniture/
// mannequin type below, then tap the room to place it (reusing Phase 14's
// house-placement tap-to-place pattern, minus the "inside the town zone"
// check that only makes sense outdoors — see useMayorRoomStore's own
// comment). Visiting birds occasionally leave a small gift here or redress
// themselves (see ai.ts's executeVisitMayorRoom). Item 85: gifts now pile up
// visibly in the room until the player taps the pile and, one at a time,
// chooses to 飾る (place it exactly like furniture) or 収納する (into the
// town warehouse) — see GiftPileModal/useMayorRoomStore's own comments.
export function MayorRoomModal({ visible, onClose }: Props) {
  const placed = useMayorRoomStore((s) => s.placed);
  const craftedStock = useMayorRoomStore((s) => s.craftedStock);
  const gifts = useMayorRoomStore((s) => s.gifts);
  const displayedGifts = useMayorRoomStore((s) => s.displayedGifts);
  const placeFurniture = useMayorRoomStore((s) => s.placeFurniture);
  const placeGiftFromPile = useMayorRoomStore((s) => s.placeGiftFromPile);

  const [selectedDefId, setSelectedDefId] = useState<string | null>(null);
  // Item 85: which pending pile gift (see GiftPileModal's onDecorate) is
  // waiting for a room tap to actually place it — the same shape as
  // selectedDefId above, kept as a separate piece of state since a
  // furniture defId and a gift's own id/ItemId are different namespaces
  // (see useMayorRoomStore's own comment on why displayedGifts is a
  // separate map from `placed`).
  const [selectedGiftId, setSelectedGiftId] = useState<string | null>(null);
  const [pileVisible, setPileVisible] = useState(false);

  const selectedGift = selectedGiftId ? gifts.find((g) => g.id === selectedGiftId) ?? null : null;

  const handleRoomTap = (x: number, y: number) => {
    if (selectedGiftId) {
      if (placeGiftFromPile(selectedGiftId, x, y)) {
        setSelectedGiftId(null);
      } else {
        Alert.alert('ここには置けません', '他の家具・贈り物に近すぎる可能性があります。');
      }
      return;
    }
    if (!selectedDefId) return;
    if (placeFurniture(selectedDefId, x, y)) {
      setSelectedDefId(null);
    } else {
      Alert.alert('ここには置けません', '他の家具に近すぎるか、在庫がない可能性があります。');
    }
  };

  const ownedDefs = FURNITURE_DEFS.filter((def) => (craftedStock[def.id] ?? 0) > 0);
  const pileCount = gifts.length;
  const pileVisualCount = Math.min(pileCount, MAYOR_ROOM_GIFT_PILE_VISUAL_CAP);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>🛋️ 町長室</Text>
            <AnimatedPressable onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>閉じる</Text>
            </AnimatedPressable>
          </View>
          <Text style={styles.subtitle}>
            好きな家具・マネキンを置いて、あなただけの部屋にしましょう。鳥たちが遊びに来ることもあります。
          </Text>

          <View style={styles.roomWrap}>
            <View style={[styles.room, { width: ROOM_SIZE, height: ROOM_SIZE }]}>
              {Object.values(placed).map((f) => {
                const def = FURNITURE_DEF_MAP[f.defId];
                if (!def) return null;
                return (
                  <Text
                    key={f.id}
                    style={[styles.furnitureEmoji, { left: f.x * ROOM_SIZE - 16, top: f.y * ROOM_SIZE - 16 }]}
                  >
                    {def.emoji}
                  </Text>
                );
              })}
              {Object.values(displayedGifts).map((g) => {
                const def = ITEM_DEF_MAP[g.itemId];
                return (
                  <Text
                    key={g.id}
                    style={[styles.furnitureEmoji, { left: g.x * ROOM_SIZE - 16, top: g.y * ROOM_SIZE - 16 }]}
                  >
                    {def?.emoji ?? '🎁'}
                  </Text>
                );
              })}
              <TouchableWithoutFeedback
                onPress={(e) => handleRoomTap(e.nativeEvent.locationX / ROOM_SIZE, e.nativeEvent.locationY / ROOM_SIZE)}
              >
                <View style={styles.roomTapOverlay} />
              </TouchableWithoutFeedback>

              {/* Item 85: the pile itself — rendered (and, importantly,
                  hit-tested) ABOVE the general room-tap overlay above, so a
                  tap landing on the pile opens GiftPileModal instead of
                  being treated as a furniture/gift placement tap. */}
              {pileCount > 0 && (
                <AnimatedPressable
                  style={[
                    styles.pileHitZone,
                    {
                      left: PILE_ANCHOR.x * ROOM_SIZE - PILE_HIT_SIZE.width / 2,
                      top: PILE_ANCHOR.y * ROOM_SIZE - PILE_HIT_SIZE.height / 2,
                      width: PILE_HIT_SIZE.width,
                      height: PILE_HIT_SIZE.height,
                    },
                  ]}
                  onPress={() => setPileVisible(true)}
                >
                  {Array.from({ length: pileVisualCount }, (_, i) => {
                    const def = ITEM_DEF_MAP[gifts[i].itemId];
                    const dx = (hash01(i * 2) - 0.5) * PILE_HIT_SIZE.width * 0.7;
                    const dy = (hash01(i * 2 + 1) - 0.5) * PILE_HIT_SIZE.height * 0.6;
                    return (
                      <Text
                        key={gifts[i].id}
                        style={[
                          styles.pileEmoji,
                          { left: PILE_HIT_SIZE.width / 2 + dx - 12, top: PILE_HIT_SIZE.height / 2 + dy - 12 },
                        ]}
                      >
                        {def?.emoji ?? '🎁'}
                      </Text>
                    );
                  })}
                  <View style={styles.pileBadge}>
                    <Text style={styles.pileBadgeText}>{pileCount}</Text>
                  </View>
                </AnimatedPressable>
              )}
            </View>
          </View>
          {selectedGift && (
            <Text style={styles.placementHint}>
              {ITEM_DEF_MAP[selectedGift.itemId]?.emoji ?? '🎁'} {ITEM_DEF_MAP[selectedGift.itemId]?.name ?? '贈り物'}
              を飾る場所を部屋の中でタップしてください
            </Text>
          )}
          {!selectedGift && selectedDefId && (
            <Text style={styles.placementHint}>
              {FURNITURE_DEF_MAP[selectedDefId].emoji} {FURNITURE_DEF_MAP[selectedDefId].name} を置く場所を部屋の中でタップしてください
            </Text>
          )}

          <AnimatedPressable
            style={[styles.pileButton, pileCount === 0 && styles.pileButtonDisabled]}
            disabled={pileCount === 0}
            onPress={() => setPileVisible(true)}
          >
            <Text style={styles.pileButtonText}>
              {pileCount > 0 ? `🎁 山積みの贈り物を見る(${pileCount})` : '🎁 まだ贈り物はありません'}
            </Text>
          </AnimatedPressable>

          <Text style={styles.sectionTitle}>手持ちの家具・マネキン</Text>
          {ownedDefs.length === 0 ? (
            <Text style={styles.emptyText}>まだありません。家具屋で素材から仕立ててみましょう。</Text>
          ) : (
            <View style={styles.catalogGrid}>
              {ownedDefs.map((def) => (
                <AnimatedPressable
                  key={def.id}
                  style={[styles.catalogItem, selectedDefId === def.id && styles.catalogItemSelected]}
                  onPress={() => {
                    setSelectedGiftId(null);
                    setSelectedDefId(def.id);
                  }}
                >
                  <Text style={styles.catalogEmoji}>{def.emoji}</Text>
                  <Text style={styles.catalogName}>{def.name}</Text>
                  <Text style={styles.catalogCost}>×{craftedStock[def.id]}</Text>
                </AnimatedPressable>
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>

      <GiftPileModal
        visible={pileVisible}
        onClose={() => setPileVisible(false)}
        onDecorate={(giftId) => {
          setSelectedDefId(null);
          setSelectedGiftId(giftId);
          setPileVisible(false);
        }}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.bgBottom },
  container: { padding: 18, backgroundColor: theme.bgBottom, flexGrow: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '800', color: theme.textPrimary },
  closeButton: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: theme.card, borderRadius: 999 },
  closeButtonText: { color: theme.textSecondary, fontWeight: '700', fontSize: 13 },
  subtitle: { fontSize: 12, color: theme.textSecondary, marginTop: 8, marginBottom: 14 },
  roomWrap: { alignItems: 'center' },
  room: {
    backgroundColor: theme.cardAlt,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: theme.cardBorder,
    overflow: 'hidden',
  },
  roomTapOverlay: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 },
  furnitureEmoji: { position: 'absolute', fontSize: 32 },
  pileHitZone: { position: 'absolute' },
  pileEmoji: { position: 'absolute', fontSize: 22 },
  pileBadge: {
    position: 'absolute',
    right: 0,
    top: 0,
    backgroundColor: theme.red,
    borderRadius: 999,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pileBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  placementHint: { fontSize: 12, fontWeight: '700', color: theme.gold, textAlign: 'center', marginTop: 10 },
  pileButton: {
    marginTop: 14,
    backgroundColor: theme.cardAlt,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: theme.gold,
    paddingVertical: 10,
    alignItems: 'center',
  },
  pileButtonDisabled: { borderColor: theme.cardBorder },
  pileButtonText: { fontSize: 13, fontWeight: '700', color: theme.textPrimary },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: theme.textPrimary, marginTop: 20, marginBottom: 10 },
  catalogGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  catalogItem: {
    width: 90,
    alignItems: 'center',
    backgroundColor: theme.card,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: theme.cardBorder,
    paddingVertical: 10,
  },
  catalogItemSelected: { borderColor: theme.gold, backgroundColor: theme.cardAlt },
  catalogEmoji: { fontSize: 26 },
  catalogName: { fontSize: 10, fontWeight: '700', color: theme.textPrimary, marginTop: 4, textAlign: 'center' },
  catalogCost: { fontSize: 9, color: theme.textSecondary, marginTop: 2 },
  emptyText: { fontSize: 12, color: theme.textMuted },
});
