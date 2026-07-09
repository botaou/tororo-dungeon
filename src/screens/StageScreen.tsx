import React, { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { usePlayerStore } from '../store/usePlayerStore';
import { useStageStore } from '../store/useStageStore';
import { getStageDef } from '../data/stages';
import { CHARACTERS } from '../data/characters';
import { rollSkillOffer } from '../data/skills';
import { ResourceBar } from '../components/ResourceBar';
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{stage.name}</Text>
        <AnimatedPressable onPress={handleExit}>
          <Text style={styles.exitLink}>{session.status === 'cleared' ? '戻る' : '撤退する'}</Text>
        </AnimatedPressable>
      </View>

      <View style={styles.statusPanel}>
        <ResourceBar label="エナジー" current={session.energy} max={session.energyMax} color={theme.blue} />
      </View>

      <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 24 }}>
        <BattleField
          enemies={session.enemies}
          miningNodes={session.miningNodes}
          treasure={session.treasure}
          summonedUnits={session.summonedUnits}
          encounters={session.encounters}
          encounterIndex={session.encounterIndex}
          status={session.status}
        />

        <Section title="✨ 召喚">
          <View style={styles.summonRow}>
            {CHARACTERS.map((c) => {
              const disabled = session.energy < c.summonCost || session.status !== 'playing';
              return (
                <AnimatedPressable
                  key={c.id}
                  style={[styles.summonButton, { borderColor: c.color }, disabled && styles.buttonDisabled]}
                  disabled={disabled}
                  onPress={() => summon(c.id)}
                >
                  <CharacterAvatar characterId={c.id} emoji={c.emoji} color={c.color} size={36} />
                  <Text style={styles.summonButtonText}>{c.name}</Text>
                  <Text style={styles.summonRoleText}>{c.description}</Text>
                  <Text style={styles.summonCostText}>消費 {c.summonCost}</Text>
                </AnimatedPressable>
              );
            })}
          </View>
        </Section>

        <Section title="📜 ログ">
          {session.log
            .slice()
            .reverse()
            .map((line, i) => (
              <Text key={i} style={styles.logLine}>
                {line}
              </Text>
            ))}
        </Section>
      </ScrollView>

      {session.status === 'cleared' && (
        <View style={styles.clearBanner}>
          <Text style={styles.clearBannerText}>
            🎉 ステージクリア！ +{stage.clearRewardAmount} {stage.clearRewardMaterial}
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
            <Text style={styles.modalSubtitle}>このステージ中だけ有効です</Text>
            {skillOffer.map((skill) => (
              <AnimatedPressable
                key={skill.id}
                style={styles.skillOption}
                onPress={() => chooseSkill(skill.id)}
              >
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bgBottom },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  title: { fontSize: 20, fontWeight: '800', color: theme.gold },
  exitLink: { color: theme.blue, fontWeight: '700' },
  statusPanel: { paddingHorizontal: 16, marginTop: 8 },
  body: { flex: 1, paddingHorizontal: 16, marginTop: 8 },
  section: {
    backgroundColor: theme.card,
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: theme.textMuted, marginBottom: 8 },
  summonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  summonButton: {
    backgroundColor: theme.cardAlt,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    minWidth: 104,
    alignItems: 'center',
    borderWidth: 2,
    gap: 3,
  },
  summonButtonText: { color: theme.textPrimary, fontWeight: '700', marginTop: 4 },
  summonRoleText: { color: theme.textSecondary, fontSize: 10, textAlign: 'center' },
  summonCostText: { color: theme.gold, fontSize: 11, fontWeight: '700', marginTop: 2 },
  buttonDisabled: { backgroundColor: theme.disabled, borderColor: theme.disabled },
  logLine: { fontSize: 12, color: theme.textSecondary, marginBottom: 4 },
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
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 4, color: theme.gold },
  modalSubtitle: { fontSize: 12, color: theme.textMuted, marginBottom: 16 },
  skillOption: {
    backgroundColor: theme.cardAlt,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  skillOptionName: { fontSize: 15, fontWeight: '700', color: theme.textPrimary },
  skillOptionDesc: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
});
