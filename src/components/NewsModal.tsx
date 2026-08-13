import React, { useMemo } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';

import { NewsArticle } from '../types';
import { generateNewsArticle, todayKey } from '../game/newsGenerator';
import { useNewsStore } from '../store/useNewsStore';
import { AnimatedPressable } from './AnimatedPressable';
import { cuteShadow, theme } from '../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
}

// トロロタイムズ(item 84) — the archive (useNewsStore.articles, one per
// calendar day that had one generated) plus a live "本日の速報" preview
// built on the fly from whatever's been collected so far today — so there's
// always something to read even before tonight's article actually exists
// yet. Same component reused from both TownStatusModal's own access point
// and TitleScreen's "ニュース" button (see each's own comment).
export function NewsModal({ visible, onClose }: Props) {
  const articles = useNewsStore((s) => s.articles);
  const collectedEntries = useNewsStore((s) => s.collectedEntries);

  // Recomputed each time this modal opens/re-renders while visible — cheap
  // (at most NEWS_COLLECTED_ENTRIES_MAX entries) and always reflects
  // whatever's happened so far today, unlike a stored article which only
  // exists once the day is actually over.
  const todayPreview: NewsArticle | null = useMemo(
    () => (collectedEntries.length > 0 ? generateNewsArticle(todayKey(), collectedEntries) : null),
    [collectedEntries]
  );

  const allEntries: { article: NewsArticle; isToday: boolean }[] = [
    ...(todayPreview ? [{ article: todayPreview, isToday: true }] : []),
    ...articles.map((article) => ({ article, isToday: false })),
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>📰 トロロタイムズ</Text>
            <AnimatedPressable onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>閉じる</Text>
            </AnimatedPressable>
          </View>

          <ScrollView style={styles.list}>
            {allEntries.length === 0 ? (
              <Text style={styles.emptyText}>まだ記事がありません。街が動き出すと、記事が生まれていきます。</Text>
            ) : (
              allEntries.map(({ article, isToday }) => (
                <View key={article.id} style={[styles.articleCard, isToday && styles.articleCardToday]}>
                  <View style={styles.articleHeaderRow}>
                    <Text style={styles.articleHeadline}>{isToday ? '📝 本日の速報' : article.headline}</Text>
                    {isToday && <Text style={styles.todayBadge}>更新中</Text>}
                  </View>
                  {article.lines.map((line, i) => (
                    <Text key={i} style={styles.articleLine}>
                      ・{line}
                    </Text>
                  ))}
                </View>
              ))
            )}
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
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '800', color: theme.gold },
  closeButton: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: theme.cardAlt, borderRadius: 999 },
  closeButtonText: { color: theme.blue, fontWeight: '700', fontSize: 13 },
  list: { maxHeight: 480 },
  emptyText: { fontSize: 12, color: theme.textMuted, paddingVertical: 12 },
  articleCard: {
    backgroundColor: theme.cardAlt,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: theme.cardBorder,
    padding: 14,
    marginBottom: 12,
    ...cuteShadow,
  },
  articleCardToday: { borderColor: theme.gold, borderWidth: 2 },
  articleHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  articleHeadline: { fontSize: 14, fontWeight: '800', color: theme.textPrimary },
  todayBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
    backgroundColor: theme.gold,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  articleLine: { fontSize: 12, color: theme.textSecondary, lineHeight: 18, marginBottom: 2 },
});
