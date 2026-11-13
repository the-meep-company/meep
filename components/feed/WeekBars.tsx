import { StyleSheet, Text, View } from 'react-native';
import { useThemeStore } from '@/stores/themeStore';
import { CATEGORY_LABELS, isEventCategory } from '@/lib/categories';
import { decorative } from '@/lib/accessibility';
import type { WeekSummary } from '@/types';

// A weekly insight's numbers: per category, how much of what was planned got
// checked off. The bar is decoration; the line under each label says it in words.

const label = (category: string) => (isEventCategory(category) ? CATEGORY_LABELS[category] : 'Everything else');

export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export default function WeekBars({ week }: { week: WeekSummary }) {
  const { theme } = useThemeStore();
  if (!week.categories.length) return null;

  return (
    <View style={styles.list}>
      {week.categories.map((c) => {
        const extras = [c.skipped && `${formatMinutes(c.skipped)} skipped`, c.ahead && `${formatMinutes(c.ahead)} still ahead`]
          .filter(Boolean)
          .join(' · ');
        return (
          <View key={c.category} style={styles.row}>
            <View style={styles.text}>
              <Text style={[styles.name, { color: theme.colors.text }]}>{label(c.category)}</Text>
              <Text style={[styles.detail, { color: theme.colors.textSecondary }]}>
                {c.done ? `${formatMinutes(c.done)} done of ${formatMinutes(c.planned)}` : `${formatMinutes(c.planned)} planned`}
                {extras ? ` · ${extras}` : ''}
              </Text>
            </View>
            <View style={[styles.track, { backgroundColor: theme.colors.primaryLight }]} {...decorative}>
              <View
                style={[
                  styles.fill,
                  { width: `${Math.round((c.done / Math.max(c.planned, 1)) * 100)}%`, backgroundColor: theme.colors.primary },
                ]}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { marginTop: 12, gap: 10 },
  row: { gap: 5 },
  text: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  name: { fontSize: 14, fontWeight: '500' },
  detail: { fontSize: 12 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
});
