import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { usePlayerStore } from '../store/usePlayerStore';
import { useStageStore } from '../store/useStageStore';
import { STAGES } from '../data/stages';
import { ResourceBar } from '../components/ResourceBar';
import { MaterialsRow } from '../components/MaterialsRow';
import { AnimatedPressable } from '../components/AnimatedPressable';
import { StageDef } from '../types';
import { theme } from '../theme';

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
        <View style={styles.stageAccent} />
        <View style={styles.stageInfo}>
          <Text style={styles.stageName}>
            {unlocked ? item.name : '？？？'} {cleared ? '✅' : ''}
          </Text>
          <Text style={styles.stageMeta}>
            スタミナ消費: {item.staminaCost}
            {item.treasure ? (treasureCollected ? '　お宝: 獲得済み' : '　💰お宝あり') : ''}
          </Text>
        </View>
        <AnimatedPressable
          style={[styles.challengeButton, !canChallenge && styles.challengeButtonDisabled]}
          disabled={!canChallenge}
          onPress={() => handleChallenge(item)}
        >
          <Text style={styles.challengeButtonText}>
            {!unlocked ? 'ロック中' : cleared ? '周回する' : '挑戦する'}
          </Text>
        </AnimatedPressable>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>🏰 トロロ・ダンジョン</Text>
      <View style={styles.statusPanel}>
        <ResourceBar label="スタミナ" current={stamina} max={staminaMax} color={theme.green} />
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
  container: { flex: 1, backgroundColor: theme.bgBottom, paddingHorizontal: 16 },
  title: {
    fontSize: 22,
    fontWeight: '800',
    marginTop: 12,
    marginBottom: 10,
    color: theme.gold,
    letterSpacing: 0.5,
  },
  statusPanel: {
    backgroundColor: theme.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  list: { paddingBottom: 24, gap: 10 },
  stageCard: {
    backgroundColor: theme.card,
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    overflow: 'hidden',
  },
  stageAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: theme.gold,
  },
  stageCardLocked: { opacity: 0.5 },
  stageInfo: { flex: 1, marginRight: 12, marginLeft: 6 },
  stageName: { fontSize: 16, fontWeight: '700', color: theme.textPrimary },
  stageMeta: { fontSize: 12, color: theme.textSecondary, marginTop: 4 },
  challengeButton: {
    backgroundColor: theme.blue,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  challengeButtonDisabled: { backgroundColor: theme.disabled },
  challengeButtonText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
