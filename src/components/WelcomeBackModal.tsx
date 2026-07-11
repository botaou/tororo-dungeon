import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';

import { OfflineReport } from '../game/offlineProgress';
import { OFFLINE_PROGRESS_CAP_MS } from '../game/config';
import { AnimatedPressable } from './AnimatedPressable';
import { theme } from '../theme';

interface Props {
  report: OfflineReport | null;
  onClose: () => void;
}

function formatElapsed(ms: number): string {
  const totalMinutes = Math.max(1, Math.round(ms / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}分`;
  if (minutes === 0) return `${hours}時間`;
  return `${hours}時間${minutes}分`;
}

// Shown once, right after a meaningful gap since the app was last open —
// a summary of what the offline-catchup simulation (see
// game/offlineProgress.ts) decided happened while the player was away.
export function WelcomeBackModal({ report, onClose }: Props) {
  if (!report) return null;

  const wasCapped = report.cappedRealElapsedMs < report.realElapsedMs;
  const totalMaterialsGained = report.birdOutcomes.reduce(
    (sum, o) => sum + Object.values(o.materialsGained).reduce((s, n) => s + (n ?? 0), 0),
    0
  );

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>🌙 おかえりなさい</Text>
          <Text style={styles.subtitle}>{formatElapsed(report.realElapsedMs)}ぶりです</Text>
          {wasCapped && (
            <Text style={styles.capNote}>
              (長く離れていたため、進行は最大{Math.round(OFFLINE_PROGRESS_CAP_MS / 3_600_000)}時間分までの反映です)
            </Text>
          )}

          {!!report.highlight && (
            <View style={styles.highlightBox}>
              <Text style={styles.highlightText}>💬 {report.highlight}</Text>
            </View>
          )}

          <Text style={styles.sectionLabel}>🏡 街の収入</Text>
          <Text style={styles.bodyText}>
            討伐協力金 +{report.huntFeeIncome}G / 旅人の来訪 +{report.travelerIncome}G(合計 +{report.townGoldDelta}G)
          </Text>
          {totalMaterialsGained > 0 && (
            <Text style={styles.bodyText}>鳥たちが集めた素材: 合計{totalMaterialsGained}個</Text>
          )}

          <Text style={styles.sectionLabel}>🐦 鳥たちのようす</Text>
          <ScrollView style={styles.list}>
            {report.birdOutcomes.map((o) => {
              const materialCount = Object.values(o.materialsGained).reduce((s, n) => s + (n ?? 0), 0);
              return (
                <View style={styles.birdRow} key={o.defId}>
                  <Text style={styles.birdName}>{o.name}</Text>
                  <Text style={styles.birdDetail}>
                    +{o.goldGained}G ・ 素材{materialCount}個
                    {o.itemsFound.length > 0 ? ` ・ ドロップ${o.itemsFound.length}個` : ''}
                    {o.levelsGained > 0 ? ` ・ Lv${o.newLevel}に成長!` : ''}
                  </Text>
                </View>
              );
            })}
          </ScrollView>

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
    maxWidth: 380,
    maxHeight: '80%',
    backgroundColor: theme.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    padding: 20,
  },
  title: { fontSize: 20, fontWeight: '800', color: theme.gold, textAlign: 'center' },
  subtitle: { fontSize: 14, fontWeight: '700', color: theme.textPrimary, textAlign: 'center', marginTop: 4 },
  capNote: { fontSize: 10, color: theme.textMuted, textAlign: 'center', marginTop: 4 },
  highlightBox: {
    backgroundColor: theme.cardAlt,
    borderRadius: 14,
    padding: 12,
    marginTop: 14,
  },
  highlightText: { fontSize: 13, fontWeight: '700', color: theme.textPrimary },
  sectionLabel: { fontSize: 13, fontWeight: '800', color: theme.textPrimary, marginTop: 14, marginBottom: 6 },
  bodyText: { fontSize: 12, color: theme.textSecondary, marginBottom: 2 },
  list: { maxHeight: 180 },
  birdRow: { paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: theme.cardBorder },
  birdName: { fontSize: 13, fontWeight: '800', color: theme.textPrimary },
  birdDetail: { fontSize: 11, color: theme.textSecondary, marginTop: 1 },
  closeButton: {
    marginTop: 16,
    backgroundColor: theme.gold,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
  },
  closeButtonText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
