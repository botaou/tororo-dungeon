import React from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';

import { getTownLevel, getTownLevelDef, TOWN_LEVEL_DEFS } from '../data/townGrid';
import { AnimatedPressable } from './AnimatedPressable';
import { theme } from '../theme';

interface Props {
  visible: boolean;
  developmentPoints: number;
  onClose: () => void;
}

// Tapping the town hall opens this — shows the current tier plus a plain
// progress readout toward the next one, since developmentPoints itself
// (unlocking land, constructing buildings, completing job-board requests)
// was previously invisible anywhere in the UI. TownLevelUpModal announces
// each tier crossing as it happens; this is the always-available "where do
// I stand right now" view the crossing-announcement alone can't give.
export function TownStatusModal({ visible, developmentPoints, onClose }: Props) {
  const level = getTownLevel(developmentPoints);
  const def = getTownLevelDef(level);
  const nextDef = TOWN_LEVEL_DEFS.find((d) => d.level === level + 1) ?? null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.emoji}>{def.emoji}</Text>
          <Text style={styles.name}>{def.name}</Text>
          <Text style={styles.pointsText}>発展ポイント {developmentPoints}pt</Text>

          {nextDef ? (
            <>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${Math.min(100, Math.round(((developmentPoints - def.threshold) / (nextDef.threshold - def.threshold)) * 100))}%` },
                  ]}
                />
              </View>
              <Text style={styles.nextText}>
                次の段階「{nextDef.emoji} {nextDef.name}」まであと{Math.max(0, nextDef.threshold - developmentPoints)}pt
              </Text>
            </>
          ) : (
            <Text style={styles.nextText}>最終段階まで到達しました</Text>
          )}

          <Text style={styles.hintText}>土地の解放・建物の建設・依頼の達成でポイントが貯まります。</Text>

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
  progressTrack: {
    width: '100%',
    height: 10,
    borderRadius: 999,
    backgroundColor: theme.cardAlt,
    marginTop: 14,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: theme.gold },
  nextText: { fontSize: 12, color: theme.textSecondary, marginTop: 8, textAlign: 'center' },
  hintText: { fontSize: 11, color: theme.textMuted, marginTop: 14, textAlign: 'center' },
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
