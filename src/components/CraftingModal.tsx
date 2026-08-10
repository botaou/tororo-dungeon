import React, { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ItemCategory } from '../types';
import { CraftingPanel } from './CraftingPanel';
import { AnimatedPressable } from './AnimatedPressable';
import { theme } from '../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
}

// UX改善: this used to be framed as a "dev shortcut" (title said
// "開発用"), with the "real" flow described as walking into a shop first.
// That's backwards from what players actually want — being able to craft
// without detouring into a specific shop building every time — so this is
// now the primary, first-class way to craft, reachable straight from the
// top bar's 🔨 button. A shop's own "加工する" (see ShopModal) still exists
// too, filtered to just that shop's categories, but it's no longer the only
// path; this one shows every unlocked recipe across every category.
const CATEGORY_TABS: { label: string; categories: ItemCategory[] | undefined }[] = [
  { label: '全部', categories: undefined },
  { label: '⚔️武器', categories: ['weapon'] },
  { label: '🎩頭', categories: ['head'] },
  { label: '🛡️体', categories: ['body'] },
  { label: '🧤手', categories: ['hand'] },
  { label: '👟足', categories: ['foot'] },
  { label: '🌾食べ物', categories: ['food'] },
  { label: '🧸おもちゃ', categories: ['toy'] },
];

export function CraftingModal({ visible, onClose }: Props) {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>🛠️ 加工</Text>
            <AnimatedPressable onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>閉じる</Text>
            </AnimatedPressable>
          </View>
          <Text style={styles.bodySubText}>買い取った素材を加工して、店に並べるアイテムを作れます。店に入らなくてもここから加工できます。</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll} contentContainerStyle={styles.tabRow}>
            {CATEGORY_TABS.map((tab, i) => (
              <AnimatedPressable
                key={tab.label}
                style={[styles.tabButton, activeTab === i && styles.tabButtonActive]}
                onPress={() => setActiveTab(i)}
              >
                <Text style={[styles.tabButtonText, activeTab === i && styles.tabButtonTextActive]}>{tab.label}</Text>
              </AnimatedPressable>
            ))}
          </ScrollView>
          <CraftingPanel categoryFilter={CATEGORY_TABS[activeTab].categories} />
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 16, fontWeight: '800', color: theme.gold },
  closeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: theme.cardAlt,
    borderRadius: 999,
  },
  closeButtonText: { color: theme.blue, fontWeight: '700', fontSize: 13 },
  bodySubText: { fontSize: 12, color: theme.textSecondary, marginBottom: 12 },
  tabScroll: { flexGrow: 0, marginBottom: 10 },
  tabRow: { flexDirection: 'row', gap: 6 },
  tabButton: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: theme.cardAlt,
    borderWidth: 1.5,
    borderColor: theme.cardBorder,
  },
  tabButtonActive: { backgroundColor: theme.gold, borderColor: theme.gold },
  tabButtonText: { fontSize: 12, fontWeight: '700', color: theme.textSecondary },
  tabButtonTextActive: { color: '#fff' },
});
