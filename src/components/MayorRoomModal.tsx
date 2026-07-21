import React, { useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TouchableWithoutFeedback, View } from 'react-native';

import { FURNITURE_DEF_MAP, FURNITURE_DEFS } from '../data/furniture';
import { ITEM_DEF_MAP } from '../data/items';
import { useMayorRoomStore } from '../store/useMayorRoomStore';
import { AnimatedPressable } from './AnimatedPressable';
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

// Phase 15①: the town hall's own customization space — tap a furniture/
// mannequin type below, then tap the room to place it (reusing Phase 14's
// house-placement tap-to-place pattern, minus the "inside the town zone"
// check that only makes sense outdoors — see useMayorRoomStore's own
// comment). Visiting birds occasionally leave a small gift here or redress
// themselves (see ai.ts's executeVisitMayorRoom) — both shown below the room
// as a light flavor log, not a real reward system.
export function MayorRoomModal({ visible, onClose }: Props) {
  const placed = useMayorRoomStore((s) => s.placed);
  const craftedStock = useMayorRoomStore((s) => s.craftedStock);
  const gifts = useMayorRoomStore((s) => s.gifts);
  const placeFurniture = useMayorRoomStore((s) => s.placeFurniture);

  const [selectedDefId, setSelectedDefId] = useState<string | null>(null);

  const handleRoomTap = (x: number, y: number) => {
    if (!selectedDefId) return;
    if (placeFurniture(selectedDefId, x, y)) {
      setSelectedDefId(null);
    } else {
      Alert.alert('ここには置けません', '他の家具に近すぎるか、在庫がない可能性があります。');
    }
  };

  const ownedDefs = FURNITURE_DEFS.filter((def) => (craftedStock[def.id] ?? 0) > 0);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
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
            <TouchableWithoutFeedback
              onPress={(e) => handleRoomTap(e.nativeEvent.locationX / ROOM_SIZE, e.nativeEvent.locationY / ROOM_SIZE)}
            >
              <View style={styles.roomTapOverlay} />
            </TouchableWithoutFeedback>
          </View>
        </View>
        {selectedDefId && (
          <Text style={styles.placementHint}>
            {FURNITURE_DEF_MAP[selectedDefId].emoji} {FURNITURE_DEF_MAP[selectedDefId].name} を置く場所を部屋の中でタップしてください
          </Text>
        )}

        <Text style={styles.sectionTitle}>手持ちの家具・マネキン</Text>
        {ownedDefs.length === 0 ? (
          <Text style={styles.emptyText}>まだありません。家具屋で素材から仕立ててみましょう。</Text>
        ) : (
          <View style={styles.catalogGrid}>
            {ownedDefs.map((def) => (
              <AnimatedPressable
                key={def.id}
                style={[styles.catalogItem, selectedDefId === def.id && styles.catalogItemSelected]}
                onPress={() => setSelectedDefId(def.id)}
              >
                <Text style={styles.catalogEmoji}>{def.emoji}</Text>
                <Text style={styles.catalogName}>{def.name}</Text>
                <Text style={styles.catalogCost}>×{craftedStock[def.id]}</Text>
              </AnimatedPressable>
            ))}
          </View>
        )}

        <Text style={styles.sectionTitle}>訪れた鳥たちの贈り物</Text>
        {gifts.length === 0 ? (
          <Text style={styles.emptyText}>まだ誰も贈り物を置いていっていません。</Text>
        ) : (
          [...gifts]
            .slice(-6)
            .reverse()
            .map((g) => (
              <Text key={g.id} style={styles.giftLine}>
                {ITEM_DEF_MAP[g.itemId]?.emoji ?? '🎁'} {g.birdName}が{ITEM_DEF_MAP[g.itemId]?.name ?? '何か'}を置いていった
              </Text>
            ))
        )}
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { padding: 18, backgroundColor: theme.bgBottom, flexGrow: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
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
  placementHint: { fontSize: 12, fontWeight: '700', color: theme.gold, textAlign: 'center', marginTop: 10 },
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
  giftLine: { fontSize: 12, color: theme.textSecondary, marginBottom: 4 },
});
