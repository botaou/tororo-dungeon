import React from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { usePlayerStore } from '../store/usePlayerStore';
import { useStageStore } from '../store/useStageStore';
import { STAGES } from '../data/stages';
import { ResourceBar } from '../components/ResourceBar';
import { MaterialsRow } from '../components/MaterialsRow';
import { StageDef } from '../types';

interface Props {
  onEnterStage: () => void;
}

export function HomeScreen({ onEnterStage }: Props) {
  const stamina = usePlayerStore((s) => s.stamina);
  const staminaMax = usePlayerStore((s) => s.staminaMax);
  const materials = usePlayerStore((s) => s.materials);
  const unlockedStageIds = usePlayerStore((s) => s.unlockedStageIds);
  const stageProgress = usePlayerStore((s) => s.stageProgress);
  const trySpendStamina = usePlayerStore((s) => s.trySpendStamina);
  const enterStage = useStageStore((s) => s.enterStage);

  const handleChallenge = (stage: StageDef) => {
    if (stamina < stage.staminaCost) return;
    if (!trySpendStamina(stage.staminaCost)) return;
    enterStage(stage.id);
    onEnterStage();
  };

  const renderStage = ({ item }: { item: StageDef }) => {
    const unlocked = unlockedStageIds.includes(item.id);
    const cleared = stageProgress[item.id]?.cleared ?? false;
    const treasureCollected = stageProgress[item.id]?.treasureCollected ?? false;
    const canChallenge = unlocked && stamina >= item.staminaCost;

    return (
      <View style={[styles.stageCard, !unlocked && styles.stageCardLocked]}>
        <View style={styles.stageInfo}>
          <Text style={styles.stageName}>
            {unlocked ? item.name : '？？？'} {cleared ? '✅' : ''}
          </Text>
          <Text style={styles.stageMeta}>
            スタミナ消費: {item.staminaCost}
            {item.treasure && (treasureCollected ? '　お宝: 獲得済み' : '　お宝あり')}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.challengeButton, !canChallenge && styles.challengeButtonDisabled]}
          disabled={!canChallenge}
          onPress={() => handleChallenge(item)}
        >
          <Text style={styles.challengeButtonText}>
            {!unlocked ? 'ロック中' : cleared ? '周回する' : '挑戦する'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>トロロ・ダンジョン</Text>
      <View style={styles.statusPanel}>
        <ResourceBar label="スタミナ" current={stamina} max={staminaMax} color="#4caf7d" />
        <MaterialsRow materials={materials} />
      </View>
      <FlatList
        data={STAGES}
        keyExtractor={(s) => s.id}
        renderItem={renderStage}
        contentContainerStyle={styles.list}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f5ef', paddingHorizontal: 16 },
  title: { fontSize: 22, fontWeight: '700', marginTop: 12, marginBottom: 8, color: '#2d2a26' },
  statusPanel: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    gap: 8,
  },
  list: { paddingBottom: 24, gap: 10 },
  stageCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  stageCardLocked: { opacity: 0.5 },
  stageInfo: { flex: 1, marginRight: 12 },
  stageName: { fontSize: 16, fontWeight: '700', color: '#2d2a26' },
  stageMeta: { fontSize: 12, color: '#777', marginTop: 4 },
  challengeButton: {
    backgroundColor: '#3f7fd1',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  challengeButtonDisabled: { backgroundColor: '#c6c6c6' },
  challengeButtonText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
