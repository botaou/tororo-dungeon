import React from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';

import { getTownLevelDef } from '../data/townGrid';
import { TOWN_QUESTS } from '../data/townQuests';
import { AnimatedPressable } from './AnimatedPressable';
import { theme } from '../theme';

interface Props {
  visible: boolean;
  townLevel: number;
  townQuestIndex: number;
  developmentPoints: number;
  onClose: () => void;
  // Phase 15①: the mayor's room lives inside the town hall — this modal is
  // still what tapping the town hall opens first (unchanged), with a button
  // through to the room itself, rather than replacing this screen outright.
  onOpenMayorRoom: () => void;
  // トロロタイムズ(item 84) — same "button through to another screen"
  // pattern as onOpenMayorRoom above.
  onOpenNews: () => void;
}

// Tapping the town hall opens this — shows the current tier plus, Phase
// 12②, the currently-active town-development quest as the "next goal"
// instead of a developmentPoints progress bar. Level no longer derives from
// developmentPoints at all (see useTownStore's townLevel/data/townQuests.ts)
// — developmentPoints is shown purely as a flavor/reputation-adjacent
// readout of "how much this town has done," same idea as reputation.
export function TownStatusModal({ visible, townLevel, townQuestIndex, developmentPoints, onClose, onOpenMayorRoom, onOpenNews }: Props) {
  const def = getTownLevelDef(townLevel);
  const activeQuest = TOWN_QUESTS[townQuestIndex] ?? null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.emoji}>{def.emoji}</Text>
          <Text style={styles.name}>{def.name}</Text>
          <Text style={styles.pointsText}>発展ポイント {developmentPoints}pt(累計の目安)</Text>

          {activeQuest ? (
            <View style={styles.questBox}>
              <Text style={styles.questLabel}>次の街の発展クエスト</Text>
              <Text style={styles.questName}>{activeQuest.name}</Text>
              <Text style={styles.questDescription}>{activeQuest.description}</Text>
            </View>
          ) : (
            <Text style={styles.nextText}>すべての発展クエストを達成しました。最終段階です。</Text>
          )}

          <Text style={styles.hintText}>
            土地の開拓・建物の建設・依頼の達成をこなして、街の発展クエストを進めましょう。
          </Text>
          <Text style={styles.hintText}>
            地図上の色付きエリアは街の雰囲気を示す演出です。建物は解放済みの土地ならどこでも建てられます。
          </Text>

          <AnimatedPressable style={styles.mayorRoomButton} onPress={onOpenMayorRoom}>
            <Text style={styles.mayorRoomButtonText}>🛋️ 町長室を見る</Text>
          </AnimatedPressable>

          <AnimatedPressable style={styles.newsButton} onPress={onOpenNews}>
            <Text style={styles.newsButtonText}>📰 トロロタイムズを読む</Text>
          </AnimatedPressable>

          <AnimatedPressable style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>とじる</Text>
          </AnimatedPressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: theme.overlay, justifyContent: 'center', alignItems: 'center', padding: 20 },
  sheet: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: theme.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    padding: 20,
    alignItems: 'center',
  },
  emoji: { fontSize: 48, marginTop: 4 },
  name: { fontSize: 18, fontWeight: '800', color: theme.textPrimary, marginTop: 6 },
  pointsText: { fontSize: 13, color: theme.textSecondary, marginTop: 8 },
  questBox: {
    width: '100%',
    marginTop: 14,
    padding: 12,
    borderRadius: 14,
    backgroundColor: theme.cardAlt,
    borderWidth: 1,
    borderColor: theme.pink,
    alignItems: 'center',
  },
  questLabel: { fontSize: 10, fontWeight: '700', color: theme.textMuted },
  questName: { fontSize: 14, fontWeight: '800', color: theme.textPrimary, marginTop: 4 },
  questDescription: { fontSize: 11, color: theme.textSecondary, marginTop: 4, textAlign: 'center' },
  nextText: { fontSize: 12, color: theme.textSecondary, marginTop: 14, textAlign: 'center' },
  hintText: { fontSize: 11, color: theme.textMuted, marginTop: 14, textAlign: 'center' },
  mayorRoomButton: {
    marginTop: 16,
    borderRadius: 999,
    paddingHorizontal: 24,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: theme.gold,
    alignSelf: 'stretch',
  },
  mayorRoomButtonText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  newsButton: {
    marginTop: 10,
    borderRadius: 999,
    paddingHorizontal: 24,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: theme.cardAlt,
    borderWidth: 1.5,
    borderColor: theme.gold,
    alignSelf: 'stretch',
  },
  newsButtonText: { color: theme.gold, fontWeight: '800', fontSize: 13 },
  closeButton: {
    marginTop: 16,
    borderRadius: 999,
    paddingHorizontal: 24,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: theme.cardAlt,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    alignSelf: 'stretch',
  },
  closeButtonText: { color: theme.textSecondary, fontWeight: '700', fontSize: 13 },
});
