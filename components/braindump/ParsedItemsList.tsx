import { useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, AccessibilityInfo } from 'react-native';
import { useThemeStore } from '@/stores/themeStore';
import { hitSlopFor } from '@/lib/accessibility';
import ParsedItemCard from './ParsedItemCard';
import type { ParsedItem } from '@/types';

interface ParsedItemsListProps {
  items: ParsedItem[];
  summary?: string;
  onEdit: (item: ParsedItem) => void;
  onDelete: (id: string) => void;
  onConfirm: (id: string) => void;
  onConfirmAll: () => void;
}

export default function ParsedItemsList({
  items, summary, onEdit, onDelete, onConfirm, onConfirmAll,
}: ParsedItemsListProps) {
  const { theme } = useThemeStore();

  const activeItems = items.filter((i) => i.status !== 'deleted');
  const allConfirmed = activeItems.every((i) => i.status === 'confirmed');
  const hasUnconfirmed = activeItems.some((i) => i.status !== 'confirmed');

  // Parsed results arrive asynchronously; announce them (iOS ignores live regions)
  useEffect(() => {
    if (activeItems.length === 0) return;
    const count = `Found ${activeItems.length} item${activeItems.length === 1 ? '' : 's'} to review.`;
    AccessibilityInfo.announceForAccessibility(summary ? `${count} ${summary}` : count);
    // Announce once per result set, not on every confirm/delete
  }, [summary]);

  useEffect(() => {
    if (allConfirmed && activeItems.length > 0) {
      AccessibilityInfo.announceForAccessibility('All items saved');
    }
  }, [allConfirmed]);

  if (activeItems.length === 0) return null;

  return (
    <View style={styles.container}>
      {/* AI Summary */}
      {summary && (
        <View
          style={[
            styles.summaryBox,
            { backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.md },
          ]}
          accessibilityLiveRegion="polite"
        >
          <Text style={[styles.summaryText, { color: theme.colors.textSecondary }]}>
            {summary}
          </Text>
        </View>
      )}

      {/* Confirm All button */}
      {hasUnconfirmed && (
        <TouchableOpacity
          onPress={onConfirmAll}
          accessibilityRole="button"
          accessibilityLabel={`Confirm all ${activeItems.length} items`}
          hitSlop={hitSlopFor(42)}
          style={[
            styles.confirmAllButton,
            { backgroundColor: theme.colors.primary, borderRadius: theme.borderRadius.md },
          ]}
        >
          <Text style={[styles.confirmAllText, { color: theme.colors.onPrimary }]}>Confirm All ({activeItems.length})</Text>
        </TouchableOpacity>
      )}

      {allConfirmed && (
        <View
          style={[
            styles.allDoneBox,
            { backgroundColor: (theme.colors.success || '#10B981') + '18', borderRadius: theme.borderRadius.md },
          ]}
          accessibilityLiveRegion="polite"
        >
          <Text style={[styles.allDoneText, { color: theme.colors.success || '#10B981' }]}>
            All items saved!
          </Text>
        </View>
      )}

      {/* Item cards */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
        {activeItems.map((item) => (
          <ParsedItemCard
            key={item.id}
            item={item}
            onEdit={onEdit}
            onDelete={onDelete}
            onConfirm={onConfirm}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  summaryBox: {
    padding: 12,
    marginBottom: 12,
  },
  summaryText: {
    fontSize: 14,
    lineHeight: 20,
  },
  confirmAllButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  confirmAllText: {
    fontSize: 15,
    fontWeight: '700',
  },
  allDoneBox: {
    padding: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  allDoneText: {
    fontSize: 14,
    fontWeight: '600',
  },
  list: {
    paddingBottom: 20,
  },
});
