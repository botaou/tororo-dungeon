import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';

import { JobRequest } from '../types';
import { MATERIAL_ICON, MATERIAL_LABEL } from '../data/materials';
import { getCharacterDef } from '../data/characters';
import { JOB_PRESETS, JobPreset } from '../data/jobPresets';
import { MAX_ACTIVE_REQUESTS } from '../game/config';
import { AnimatedPressable } from './AnimatedPressable';
import { theme } from '../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  requests: JobRequest[];
  onPost: (preset: JobPreset) => void;
}

export function RequestBoard({ visible, onClose, requests, onPost }: Props) {
  const activeRequests = requests.filter((r) => r.status !== 'done').slice().reverse();
  const isBoardFull = activeRequests.length >= MAX_ACTIVE_REQUESTS;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>📋 依頼掲示板</Text>
            <AnimatedPressable onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>閉じる</Text>
            </AnimatedPressable>
          </View>

          <Text style={styles.sectionLabel}>
            依頼を出す{isBoardFull ? `(満員 ${activeRequests.length}/${MAX_ACTIVE_REQUESTS})` : ''}
          </Text>
          {isBoardFull ? (
            <Text style={styles.fullText}>掲示板がいっぱいです。依頼が達成されるまでお待ちください。</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetScroll}>
              <View style={styles.presetRow}>
                {JOB_PRESETS.map((p) => (
                  <AnimatedPressable key={p.materialId} style={styles.presetButton} onPress={() => onPost(p)}>
                    <Text style={styles.presetIcon}>{MATERIAL_ICON[p.materialId]}</Text>
                    <Text style={styles.presetText}>
                      {MATERIAL_LABEL[p.materialId]} x{p.amount}
                    </Text>
                    <Text style={styles.presetReward}>報酬 {p.reward}G</Text>
                  </AnimatedPressable>
                ))}
              </View>
            </ScrollView>
          )}

          <Text style={styles.sectionLabel}>現在の依頼({activeRequests.length}/{MAX_ACTIVE_REQUESTS})</Text>
          <ScrollView style={styles.list}>
            {activeRequests.length === 0 && <Text style={styles.emptyText}>依頼はまだありません</Text>}
            {activeRequests.map((r) => (
              <View key={r.id} style={styles.requestRow}>
                <Text style={styles.requestIcon}>{MATERIAL_ICON[r.materialId]}</Text>
                <View style={styles.requestInfo}>
                  <Text style={styles.requestText}>
                    {MATERIAL_LABEL[r.materialId]} x{r.amount}(報酬{r.reward}G)
                  </Text>
                  <Text style={styles.requestStatus}>
                    {r.status === 'open'
                      ? '募集中…'
                      : `${r.acceptedBy ? getCharacterDef(r.acceptedBy).name : ''}が対応中(${r.delivered}/${r.amount})`}
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: theme.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: theme.card,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: 18,
    maxHeight: '75%',
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '800', color: theme.gold },
  closeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: theme.cardAlt,
    borderRadius: 999,
  },
  closeButtonText: { color: theme.blue, fontWeight: '700', fontSize: 13 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: theme.textMuted, marginBottom: 8, marginTop: 4 },
  presetScroll: { marginBottom: 12 },
  fullText: { color: theme.textMuted, fontSize: 12, marginBottom: 12 },
  presetRow: { flexDirection: 'row', gap: 8 },
  presetButton: {
    width: 92,
    backgroundColor: theme.cardAlt,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    gap: 2,
  },
  presetIcon: { fontSize: 18 },
  presetText: { color: theme.textPrimary, fontSize: 12, fontWeight: '700' },
  presetReward: { color: theme.gold, fontSize: 10, fontWeight: '700' },
  list: { maxHeight: 220 },
  emptyText: { color: theme.textMuted, fontSize: 13, paddingVertical: 8 },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.cardAlt,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  requestIcon: { fontSize: 20 },
  requestInfo: { flex: 1 },
  requestText: { color: theme.textPrimary, fontWeight: '700', fontSize: 13 },
  requestStatus: { color: theme.textSecondary, fontSize: 11, marginTop: 2 },
});
