import React, { useEffect, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CHARACTERS } from '../../data/characters';
import { TOWNHALL_IMAGES } from '../../data/buildingImages';
import { ENEMY_IMAGES } from '../../data/fieldImages';
import { STARTING_MATERIALS } from '../../game/config';
import { BirdWallet } from '../../store/useBirdEconomyStore';
import { OfflineReport, simulateOfflineProgress } from '../../game/offlineProgress';
import { theme } from '../../theme';

// Phase-16 feasibility prototype for the 街/ダンジョン screen split — a
// completely standalone in-memory sandbox, not wired to any real store
// (usePlayerStore/useWorldStore/useTownStore are never imported here), so
// nothing about the real save data can be touched no matter how this screen
// is poked at. See App.tsx's own comment for how this is reached, and
// config.ts's SHOW_ZONE_SPLIT_PROTOTYPE for the on/off switch.
//
// What this verifies:
//  1. That a plain two-screen toggle (no shared canvas, no zone ellipse) is
//     trivial to wire up — see the activeScreen state below.
//  2. Option (c) from the design report — reusing the existing offline-
//     catchup approximation (game/offlineProgress.ts) for "how long was the
//     player looking at the OTHER screen" instead of the app being fully
//     closed. Switching from ダンジョン back to 街 runs simulateOfflineProgress
//     over however many real seconds you spent on the dungeon screen and
//     shows the result inline (see handleReturnToTown/lastReport below).
//  3. Whether removing the town/field zone concept entirely (this dungeon
//     view has no ellipse, no isInsideTownZone check, no
//     randomPointNearTown/randomPointInField distinction — every point on
//     this screen is just "the dungeon") causes any visible problem. It
//     doesn't, because there's nothing here that needs to distinguish
//     "inside town" from "outside town" once they're not sharing one canvas.
function freshWallet(defId: string): BirdWallet {
  const def = CHARACTERS.find((c) => c.id === defId)!;
  return {
    gold: 0,
    inventory: { ...STARTING_MATERIALS },
    items: {},
    equipment: { weapon: null, head: null, body: null, hand: null, foot: null },
    cosmeticId: null,
    houseFood: {},
    houseTreasureIds: [],
    skills: [],
    level: 1,
    exp: 0,
    atk: def.baseAtk,
    maxHp: def.baseHp,
    defense: def.baseDefense,
    speed: def.baseSpeed,
    luck: def.baseLuck,
    satiety: 80,
    happiness: 80,
    isRecruited: true,
    houselessSinceMs: null,
    houselessSulkLogged: false,
    houselessWarningShown: false,
  };
}

function buildInitialWallets(): Record<string, BirdWallet> {
  const result: Record<string, BirdWallet> = {};
  for (const c of CHARACTERS) result[c.id] = freshWallet(c.id);
  return result;
}

type ActiveScreen = 'town' | 'dungeon';

export function ZoneSplitPrototypeScreen() {
  const [activeScreen, setActiveScreen] = useState<ActiveScreen>('town');
  const [wallets, setWallets] = useState<Record<string, BirdWallet>>(() => buildInitialWallets());
  const [dungeonEnteredAt, setDungeonEnteredAt] = useState<number | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [lastReport, setLastReport] = useState<OfflineReport | null>(null);
  const townGoldRef = useRef(0);
  const [townGold, setTownGold] = useState(0);

  // A live "how long have you been on the dungeon screen" ticker — purely so
  // the report you get back on returning to town has a number to compare
  // against what you actually experienced (does "I was gone 12 seconds" line
  // up with a report that feels like 12 seconds' worth of progress, or does
  // it feel like way more/less?).
  useEffect(() => {
    if (activeScreen !== 'dungeon' || dungeonEnteredAt === null) return;
    const id = setInterval(() => setElapsedSec(Math.floor((Date.now() - dungeonEnteredAt) / 1000)), 250);
    return () => clearInterval(id);
  }, [activeScreen, dungeonEnteredAt]);

  const handleEnterDungeon = () => {
    setLastReport(null);
    setDungeonEnteredAt(Date.now());
    setElapsedSec(0);
    setActiveScreen('dungeon');
  };

  // This is option (c): the dungeon side isn't simulated tick-by-tick while
  // the player is looking at the town screen (that would need a background
  // timer/interval running independently of which screen is mounted — see
  // the report's option (a)), and the dungeon's own clock isn't frozen
  // either (option (b)) — instead, the elapsed real time is handed straight
  // to the exact same approximation the real app already uses for "the app
  // was closed for N ms" (game/offlineProgress.ts), just with a much smaller
  // N. See the chat report for how this actually felt across a range of
  // durations.
  const handleReturnToTown = () => {
    if (dungeonEnteredAt === null) {
      setActiveScreen('town');
      return;
    }
    const elapsedMs = Date.now() - dungeonEnteredAt;
    const report = simulateOfflineProgress(elapsedMs, elapsedMs, wallets, { ...STARTING_MATERIALS }, 300);
    const nextWallets: Record<string, BirdWallet> = { ...wallets };
    for (const outcome of report.birdOutcomes) nextWallets[outcome.defId] = outcome.wallet;
    setWallets(nextWallets);
    townGoldRef.current += report.townGoldDelta - report.sellExpense;
    setTownGold(townGoldRef.current);
    setLastReport(report);
    setDungeonEnteredAt(null);
    setActiveScreen('town');
  };

  if (activeScreen === 'dungeon') {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>⚔️ ダンジョン(検証用)</Text>
        <Text style={styles.subtitle}>
          この画面には街ゾーンという概念が一切ありません——敵・鳥の座標に「街の内側/外側」の判定は無く、ただのダンジョン全体です。
        </Text>
        <View style={styles.dungeonIconsRow}>
          <Image source={ENEMY_IMAGES['スライム']} style={styles.dungeonIcon} resizeMode="contain" />
          <Image source={ENEMY_IMAGES['コウモリ']} style={styles.dungeonIcon} resizeMode="contain" />
          <Image source={ENEMY_IMAGES['オオカミ']} style={styles.dungeonIcon} resizeMode="contain" />
        </View>
        <Text style={styles.elapsedText}>この画面にいる時間: {elapsedSec}秒</Text>
        <Text style={styles.hintText}>
          街画面に戻ると、この経過秒数をそのままgame/offlineProgress.tsの近似シミュレーションに渡します(検証したい「案(c)」)。
        </Text>
        <View style={styles.buttonRow}>
          <Text style={styles.linkButton} onPress={handleReturnToTown}>
            🏡 街へ戻る
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>🏡 街(検証用)</Text>
      <Image source={TOWNHALL_IMAGES[1]} style={styles.townHallImage} resizeMode="contain" />
      <Text style={styles.subtitle}>累計ゴールド(街の取り分): {townGold}G</Text>

      {lastReport && (
        <View style={styles.reportBox}>
          <Text style={styles.reportTitle}>
            ダンジョンにいた{Math.round(lastReport.cappedRealElapsedMs / 1000)}秒間の出来事
          </Text>
          <Text style={styles.reportLine}>{lastReport.highlight || '特に目立った出来事はありませんでした'}</Text>
          {lastReport.birdOutcomes.map((b) => (
            <Text key={b.defId} style={styles.reportLine}>
              {b.name}: +{b.goldGained}G / +{b.expGained}exp
              {b.levelsGained > 0 ? ` / Lv${b.newLevel}まで成長` : ''}
              {b.itemsFound.length > 0 ? ` / 拾い物${b.itemsFound.length}件` : ''}
            </Text>
          ))}
        </View>
      )}

      <ScrollView style={styles.birdList}>
        {CHARACTERS.map((c) => {
          const w = wallets[c.id];
          return (
            <Text key={c.id} style={styles.birdLine}>
              {c.emoji} {c.name}: Lv{w.level} / {w.gold}G / exp {w.exp}
            </Text>
          );
        })}
      </ScrollView>

      <View style={styles.buttonRow}>
        <Text style={styles.linkButton} onPress={handleEnterDungeon}>
          ⚔️ ダンジョンへ
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bgBottom, padding: 16 },
  title: { fontSize: 20, fontWeight: '800', color: theme.textPrimary, marginTop: 8 },
  subtitle: { fontSize: 12, color: theme.textSecondary, marginTop: 6, marginBottom: 12 },
  townHallImage: { width: 90, height: 90, alignSelf: 'center' },
  dungeonIconsRow: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginTop: 20, marginBottom: 20 },
  dungeonIcon: { width: 56, height: 56 },
  elapsedText: { fontSize: 16, fontWeight: '800', color: theme.gold, textAlign: 'center', marginTop: 10 },
  hintText: { fontSize: 11, color: theme.textMuted, textAlign: 'center', marginTop: 10, paddingHorizontal: 12 },
  reportBox: {
    backgroundColor: theme.cardAlt,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: theme.gold,
    padding: 12,
    marginBottom: 12,
  },
  reportTitle: { fontSize: 13, fontWeight: '800', color: theme.textPrimary, marginBottom: 6 },
  reportLine: { fontSize: 12, color: theme.textSecondary, marginBottom: 2 },
  birdList: { flex: 1, marginBottom: 12 },
  birdLine: { fontSize: 13, color: theme.textPrimary, marginBottom: 6 },
  buttonRow: { alignItems: 'center', paddingBottom: 16 },
  linkButton: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
    backgroundColor: theme.gold,
    borderRadius: 999,
    paddingHorizontal: 24,
    paddingVertical: 12,
    overflow: 'hidden',
  },
});
