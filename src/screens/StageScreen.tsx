import React, { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { usePlayerStore } from '../store/usePlayerStore';
import { useStageStore } from '../store/useStageStore';
import { getStageDef } from '../data/stages';
import { CHARACTERS, getCharacterDef } from '../data/characters';
import { rollSkillOffer } from '../data/skills';
import { ResourceBar } from '../components/ResourceBar';
import { CharacterAvatar } from '../components/CharacterAvatar';
import { SkillDef } from '../types';
import { theme } from '../theme';

interface Props {
  onExit: () => void;
}

export function StageScreen({ onExit }: Props) {
  const session = useStageStore((s) => s.session);
  const chooseSkill = useStageStore((s) => s.chooseSkill);
  const summon = useStageStore((s) => s.summon);
  const collectMiningNode = useStageStore((s) => s.collectMiningNode);
  const collectTreasureNode = useStageStore((s) => s.collectTreasureNode);
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
        <TouchableOpacity onPress={handleExit} activeOpacity={0.6}>
          <Text style={styles.exitLink}>{session.status === 'cleared' ? '戻る' : '撤退する'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statusPanel}>
        <ResourceBar label="エナジー" current={session.energy} max={session.energyMax} color={theme.blue} />
      </View>

      <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 24 }}>
        <Section title="👹 敵">
          {session.enemies.map((e) => (
            <View key={e.uid} style={styles.entityRow}>
              <Text style={[styles.entityName, e.hp <= 0 && styles.entityDead]}>
                {e.name} {e.hp <= 0 ? '(撃破)' : ''}
              </Text>
              {e.hp > 0 && <ResourceBar label="" current={e.hp} max={e.maxHp} color={theme.red} />}
            </View>
          ))}
        </Section>

        <Section title="🦜 召喚中のキャラ">
          {session.summonedUnits.length === 0 && (
            <Text style={styles.emptyText}>召喚中のキャラはいません</Text>
          )}
          {session.summonedUnits.map((u) => {
            const def = getCharacterDef(u.defId);
            return (
              <View key={u.uid} style={styles.unitRow}>
                <CharacterAvatar characterId={def.id} emoji={def.emoji} color={def.color} size={32} />
                <View style={styles.unitBarWrap}>
                  <Text style={styles.entityName}>{u.name}</Text>
                  <ResourceBar label="" current={u.hp} max={u.maxHp} color={def.color} />
                </View>
              </View>
            );
          })}
        </Section>

        <Section title="✨ 召喚">
          <View style={styles.summonRow}>
            {CHARACTERS.map((c) => {
              const disabled = session.energy < c.summonCost || session.status !== 'playing';
              return (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.summonButton, { borderColor: c.color }, disabled && styles.buttonDisabled]}
                  disabled={disabled}
                  onPress={() => summon(c.id)}
                  activeOpacity={0.7}
                >
                  <CharacterAvatar characterId={c.id} emoji={c.emoji} color={c.color} size={36} />
                  <Text style={styles.summonButtonText}>{c.name}</Text>
                  <Text style={styles.summonRoleText}>{c.description}</Text>
                  <Text style={styles.summonCostText}>消費 {c.summonCost}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Section>

        <Section title="⛏️ 採掘オブジェクト">
          <View style={styles.nodeRow}>
            {session.miningNodes.map((m) => (
              <TouchableOpacity
                key={m.uid}
                style={[styles.nodeButton, m.collected && styles.buttonDisabled]}
                disabled={m.collected}
                onPress={() => collectMiningNode(m.uid)}
                activeOpacity={0.7}
              >
                <Text style={styles.nodeButtonText}>{m.name}</Text>
                <Text style={styles.nodeButtonSub}>
                  {m.collected ? '採取済み' : `+${m.amount} ${m.resource}`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Section>

        {session.treasure && (
          <Section title="💰 お宝">
            <TouchableOpacity
              style={[styles.treasureButton, session.treasure.collected && styles.buttonDisabled]}
              disabled={session.treasure.collected}
              onPress={collectTreasureNode}
              activeOpacity={0.7}
            >
              <Text style={styles.treasureButtonText}>{session.treasure.name}</Text>
              <Text style={styles.nodeButtonSub}>
                {session.treasure.collected
                  ? '獲得済み'
                  : `+${session.treasure.rewardAmount} ${session.treasure.rewardMaterial}`}
              </Text>
            </TouchableOpacity>
          </Section>
        )}

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
          <TouchableOpacity style={styles.clearBannerButton} onPress={handleExit} activeOpacity={0.7}>
            <Text style={styles.clearBannerButtonText}>ホームに戻る</Text>
          </TouchableOpacity>
        </View>
      )}

      <Modal visible={session.status === 'selecting_skill'} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>スキルを選択</Text>
            <Text style={styles.modalSubtitle}>このステージ中だけ有効です</Text>
            {skillOffer.map((skill) => (
              <TouchableOpacity
                key={skill.id}
                style={styles.skillOption}
                onPress={() => chooseSkill(skill.id)}
                activeOpacity={0.7}
              >
                <Text style={styles.skillOptionName}>{skill.name}</Text>
                <Text style={styles.skillOptionDesc}>{skill.description}</Text>
              </TouchableOpacity>
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
  entityRow: { marginBottom: 8 },
  entityName: { fontSize: 14, fontWeight: '600', color: theme.textPrimary, marginBottom: 2 },
  entityDead: { color: theme.textMuted, textDecorationLine: 'line-through' },
  emptyText: { fontSize: 13, color: theme.textMuted },
  unitRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  unitBarWrap: { flex: 1 },
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
  nodeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  nodeButton: {
    backgroundColor: theme.orange,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    minWidth: 110,
    alignItems: 'center',
  },
  nodeButtonText: { color: '#fff', fontWeight: '700' },
  nodeButtonSub: { color: '#fff5e6', fontSize: 11, marginTop: 2 },
  treasureButton: {
    backgroundColor: '#8a6314',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.gold,
  },
  treasureButtonText: { color: theme.gold, fontWeight: '700', fontSize: 15 },
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
