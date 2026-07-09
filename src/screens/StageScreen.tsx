import React, { useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useStageStore } from '../store/useStageStore';
import { getStageDef } from '../data/stages';
import { CHARACTERS } from '../data/characters';
import { rollSkillOffer } from '../data/skills';
import { CharacterAvatar } from '../components/CharacterAvatar';
import { AnimatedPressable } from '../components/AnimatedPressable';
import { BattleField } from '../components/BattleField';
import { SkillDef } from '../types';
import { theme } from '../theme';

interface Props {
  onExit: () => void;
}

export function StageScreen({ onExit }: Props) {
  const session = useStageStore((s) => s.session);
  const chooseSkill = useStageStore((s) => s.chooseSkill);
  const summon = useStageStore((s) => s.summon);
  const exitStage = useStageStore((s) => s.exitStage);

  const [skillOffer] = useState<SkillDef[]>(() => rollSkillOffer());

  if (!session) return null;
  const stage = getStageDef(session.stageId);

  const handleExit = () => {
    exitStage();
    onExit();
  };

  const enemiesLeft = session.enemies.filter((e) => !e.defeated && e.hp > 0).length;
  const energyRatio = session.energyMax > 0 ? session.energy / session.energyMax : 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <AnimatedPressable onPress={handleExit} style={styles.exitButton}>
          <Text style={styles.exitButtonText}>✕</Text>
        </AnimatedPressable>
        <View style={styles.enemyPill}>
          <Text style={styles.enemyPillText}>👹 残り {enemiesLeft}</Text>
        </View>
        <View style={styles.stageNamePill}>
          <Text style={styles.stageNameText}>{stage.name}</Text>
        </View>
      </View>

      <View style={styles.fieldWrap}>
        <BattleField
          enemies={session.enemies}
          miningNodes={session.miningNodes}
          treasure={session.treasure}
          summonedUnits={session.summonedUnits}
          status={session.status}
        />
      </View>

      <View style={styles.bottomBar}>
        <View style={styles.energyTrack}>
          <View style={[styles.energyFill, { width: `${Math.max(0, Math.min(1, energyRatio)) * 100}%` }]} />
          <Text style={styles.energyText}>
            ⚡ {Math.floor(session.energy)}/{session.energyMax}
          </Text>
        </View>
        <View style={styles.summonRow}>
          {CHARACTERS.map((c) => {
            const disabled = session.energy < c.summonCost || session.status !== 'playing';
            return (
              <AnimatedPressable
                key={c.id}
                style={[styles.summonButton, disabled && styles.summonButtonDisabled]}
                disabled={disabled}
                onPress={() => summon(c.id)}
              >
                <CharacterAvatar characterId={c.id} emoji={c.emoji} color={c.color} size={38} />
                <Text style={styles.summonCostText}>{c.summonCost}</Text>
              </AnimatedPressable>
            );
          })}
        </View>
      </View>

      {session.status === 'cleared' && (
        <View style={styles.clearBanner}>
          <Text style={styles.clearBannerText}>
            🎉 クリア！ +{stage.clearRewardAmount} {stage.clearRewardMaterial}
          </Text>
          <AnimatedPressable style={styles.clearBannerButton} onPress={handleExit}>
            <Text style={styles.clearBannerButtonText}>ホームに戻る</Text>
          </AnimatedPressable>
        </View>
      )}

      <Modal visible={session.status === 'selecting_skill'} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>スキルを選択</Text>
            {skillOffer.map((skill) => (
              <AnimatedPressable key={skill.id} style={styles.skillOption} onPress={() => chooseSkill(skill.id)}>
                <Text style={styles.skillOptionName}>{skill.name}</Text>
                <Text style={styles.skillOptionDesc}>{skill.description}</Text>
              </AnimatedPressable>
            ))}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bgBottom },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 6,
    gap: 8,
  },
  exitButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: theme.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  exitButtonText: { color: theme.textSecondary, fontWeight: '700', fontSize: 14 },
  enemyPill: {
    backgroundColor: theme.card,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  enemyPillText: { color: theme.textPrimary, fontSize: 12, fontWeight: '700' },
  stageNamePill: { marginLeft: 'auto' },
  stageNameText: { color: theme.gold, fontSize: 13, fontWeight: '700' },
  fieldWrap: { flex: 1, paddingHorizontal: 12, marginTop: 6 },
  bottomBar: { paddingHorizontal: 12, paddingBottom: 8, paddingTop: 8, gap: 8 },
  energyTrack: {
    height: 22,
    borderRadius: 11,
    backgroundColor: theme.bgTop,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  energyFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: theme.blue,
  },
  energyText: {
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  summonRow: { flexDirection: 'row', justifyContent: 'center', gap: 14 },
  summonButton: {
    alignItems: 'center',
    backgroundColor: theme.card,
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    gap: 2,
  },
  summonButtonDisabled: { opacity: 0.4 },
  summonCostText: { color: theme.gold, fontSize: 11, fontWeight: '700' },
  clearBanner: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.card,
    padding: 16,
    alignItems: 'center',
    borderTopWidth: 2,
    borderTopColor: theme.gold,
  },
  clearBannerText: { color: theme.gold, fontWeight: '700', fontSize: 15, marginBottom: 10 },
  clearBannerButton: {
    backgroundColor: theme.green,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  clearBannerButtonText: { color: '#fff', fontWeight: '700' },
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: 20,
    width: '100%',
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 12, color: theme.gold },
  skillOption: {
    backgroundColor: theme.cardAlt,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  skillOptionName: { fontSize: 15, fontWeight: '700', color: theme.textPrimary },
  skillOptionDesc: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
});
