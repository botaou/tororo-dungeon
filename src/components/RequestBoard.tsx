import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ItemId, JobRequest, MerchantState } from '../types';
import { getCharacterDef } from '../data/characters';
import { describeJobTarget, JOB_KIND_UNIT_LABEL, JOB_PRESETS, JobPreset } from '../data/jobPresets';
import { MAX_ACTIVE_REQUESTS } from '../game/config';
import { AnimatedPressable } from './AnimatedPressable';
import { theme } from '../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  requests: JobRequest[];
  merchant: MerchantState | null;
  playerItems: Partial<Record<ItemId, number>>;
  onPost: (preset: JobPreset) => void;
  onDeliverToMerchant: (requestId: string) => void;
}

export function RequestBoard({ visible, onClose, requests, merchant, playerItems, onPost, onDeliverToMerchant }: Props) {
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
                {JOB_PRESETS.map((p, i) => {
                  const { icon, label } = describeJobTarget(p);
                  return (
                    <AnimatedPressable key={i} style={styles.presetButton} onPress={() => onPost(p)}>
                      <Text style={styles.presetIcon}>{icon}</Text>
                      <Text style={styles.presetText}>
                        {label} x{p.amount}
                      </Text>
                      <Text style={styles.presetReward}>報酬 {p.reward}G</Text>
                    </AnimatedPressable>
                  );
                })}
              </View>
            </ScrollView>
          )}

          <Text style={styles.sectionLabel}>現在の依頼({activeRequests.length}/{MAX_ACTIVE_REQUESTS})</Text>
          <ScrollView style={styles.list}>
            {activeRequests.length === 0 && <Text style={styles.emptyText}>依頼はまだありません</Text>}
            {activeRequests.map((r) => {
              const { icon, label } = describeJobTarget(r);
              const isMerchantDeliver = r.kind === 'merchantDeliver';
              const canDeliver =
                isMerchantDeliver && r.status === 'inProgress' && !!merchant && (playerItems[r.itemId!] ?? 0) > 0;
              return (
                <View key={r.id} style={styles.requestRow}>
                  <Text style={styles.requestIcon}>{icon}</Text>
                  <View style={styles.requestInfo}>
                    <Text style={styles.requestText}>
                      {label} x{r.amount}{JOB_KIND_UNIT_LABEL[r.kind]}(報酬{r.reward}G)
                    </Text>
                    <Text style={styles.requestStatus}>
                      {r.status === 'open'
                        ? '募集中…'
                        : `${r.acceptedBy ? getCharacterDef(r.acceptedBy).name : ''}が対応中(${r.delivered}/${r.amount})`}
                    </Text>
                    {isMerchantDeliver && r.status === 'inProgress' && !merchant && (
                      <Text style={styles.waitingText}>商人の来訪を待っています…</Text>
                    )}
                  </View>
                  {isMerchantDeliver && r.status === 'inProgress' && !!merchant && (
                    <AnimatedPressable
                      style={[styles.deliverButton, !canDeliver && styles.deliverButtonDisabled]}
                      disabled={!canDeliver}
                      onPress={() => onDeliverToMerchant(r.id)}
                    >
                      <Text style={styles.deliverButtonText}>{canDeliver ? '📦 納品する' : '在庫なし'}</Text>
                    </AnimatedPressable>
                  )}
                </View>
              );
            })}
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
  waitingText: { color: theme.gold, fontSize: 11, marginTop: 2, fontWeight: '700' },
  deliverButton: {
    backgroundColor: theme.gold,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  deliverButtonDisabled: { backgroundColor: theme.cardBorder },
  deliverButtonText: { color: '#fff', fontWeight: '700', fontSize: 11 },
});
