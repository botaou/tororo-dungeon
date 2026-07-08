import React, { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { usePlayerStore } from '../store/usePlayerStore';
import { useStageStore } from '../store/useStageStore';
import { getStageDef } from '../data/stages';
import { CHARACTERS } from '../data/characters';
import { rollSkillOffer } from '../data/skills';
import { ResourceBar } from '../components/ResourceBar';
import { SkillDef } from '../types';

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
  const materials = usePlayerStore((s) => s.materials);

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
        <TouchableOpacity onPress={handleExit}>
          <Text style={styles.exitLink}>{session.status === 'cleared' ? '戻る' : '撤退する'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statusPanel}>
        <ResourceBar label="エナジー" current={session.energy} max={session.energyMax} color="#3f7fd1" />
      </View>

      <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 24 }}>
        <Section title="敵">
          {session.enemies.map((e) => (
            <View key={e.uid} style={styles.entityRow}>
              <Text style={[styles.entityName, e.hp <= 0 && styles.entityDead]}>
                {e.name} {e.hp <= 0 ? '(撃破)' : ''}
              </Text>
              {e.hp > 0 && <ResourceBar label="" current={e.hp} max={e.maxHp} color="#d1483f" />}
            </View>
          ))}
        </Section>

        <Section title="召喚中のキャラ">
          {session.summonedUnits.length === 0 && (
            <Text style={styles.emptyText}>召喚中のキャラはいません</Text>
          )}
          {session.summonedUnits.map((u) => (
            <View key={u.uid} style={styles.entityRow}>
              <Text style={styles.entityName}>{u.name}</Text>
              <ResourceBar label="" current={u.hp} max={u.maxHp} color="#4caf7d" />
            </View>
          ))}
        </Section>

        <Section title="召喚">
          <View style={styles.summonRow}>
            {CHARACTERS.map((c) => {
              const disabled = session.energy < c.summonCost || session.status !== 'playing';
              return (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.summonButton, disabled && styles.buttonDisabled]}
                  disabled={disabled}
                  onPress={() => summon(c.id)}
                >
                  <Text style={styles.summonButtonText}>{c.name}</Text>
                  <Text style={styles.summonCostText}>消費 {c.summonCost}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Section>

        <Section title="採掘オブジェクト">
          <View style={styles.nodeRow}>
            {session.miningNodes.map((m) => (
              <TouchableOpacity
                key={m.uid}
                style={[styles.nodeButton, m.collected && styles.buttonDisabled]}
                disabled={m.collected}
                onPress={() => collectMiningNode(m.uid)}
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
          <Section title="お宝">
            <TouchableOpacity
              style={[styles.treasureButton, session.treasure.collected && styles.buttonDisabled]}
              disabled={session.treasure.collected}
              onPress={collectTreasureNode}
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

        <Section title="ログ">
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
          <Text style={styles.clearBannerText}>ステージクリア！ +{stage.clearRewardAmount} {stage.clearRewardMaterial}</Text>
          <TouchableOpacity style={styles.clearBannerButton} onPress={handleExit}>
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
  container: { flex: 1, backgroundColor: '#f7f5ef' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  title: { fontSize: 20, fontWeight: '700', color: '#2d2a26' },
  exitLink: { color: '#3f7fd1', fontWeight: '600' },
  statusPanel: { paddingHorizontal: 16, marginTop: 8 },
  body: { flex: 1, paddingHorizontal: 16, marginTop: 8 },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#888', marginBottom: 8 },
  entityRow: { marginBottom: 8 },
  entityName: { fontSize: 14, fontWeight: '600', color: '#2d2a26', marginBottom: 2 },
  entityDead: { color: '#aaa', textDecorationLine: 'line-through' },
  emptyText: { fontSize: 13, color: '#999' },
  summonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  summonButton: {
    backgroundColor: '#3f7fd1',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    minWidth: 100,
    alignItems: 'center',
  },
  summonButtonText: { color: '#fff', fontWeight: '700' },
  summonCostText: { color: '#e0eaff', fontSize: 11, marginTop: 2 },
  nodeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  nodeButton: {
    backgroundColor: '#c98a3f',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    minWidth: 110,
    alignItems: 'center',
  },
  nodeButtonText: { color: '#fff', fontWeight: '700' },
  nodeButtonSub: { color: '#fff5e6', fontSize: 11, marginTop: 2 },
  treasureButton: {
    backgroundColor: '#b8862c',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  treasureButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  buttonDisabled: { backgroundColor: '#c6c6c6' },
  logLine: { fontSize: 12, color: '#555', marginBottom: 4 },
  clearBanner: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#2d2a26',
    padding: 16,
    alignItems: 'center',
  },
  clearBannerText: { color: '#fff', fontWeight: '700', fontSize: 15, marginBottom: 10 },
  clearBannerButton: {
    backgroundColor: '#4caf7d',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  clearBannerButtonText: { color: '#fff', fontWeight: '700' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, width: '100%' },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 4, color: '#2d2a26' },
  modalSubtitle: { fontSize: 12, color: '#888', marginBottom: 16 },
  skillOption: {
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  skillOptionName: { fontSize: 15, fontWeight: '700', color: '#2d2a26' },
  skillOptionDesc: { fontSize: 12, color: '#666', marginTop: 2 },
});
