import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { useThemeStore } from '@/stores/themeStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTaskStore } from '@/stores/taskStore';
import type { WidgetCalendarView } from '@/types';
import { decorative, a11yState } from '@/lib/accessibility';

// Segments are ~33pt tall; extend vertically only so neighbours don't overlap.
const SEGMENT_HIT_SLOP = { top: 6, bottom: 6, left: 0, right: 0 };

const CALENDAR_VIEWS: { value: WidgetCalendarView; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

export function WidgetSettingsSection() {
  const { theme } = useThemeStore();
  const { widgetCalendarView, widgetCategory, setWidgetCalendarView, setWidgetCategory } =
    useSettingsStore();
  const tasks = useTaskStore((s) => s.tasks);

  const categories = Array.from(
    new Set(tasks.map((t) => t.category).filter((c): c is string => Boolean(c)))
  ).sort();

  const cardStyle = [
    styles.card,
    {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
      borderRadius: theme.borderRadius.md,
    },
  ];

  return (
    <>
      {/* Calendar view picker */}
      <View style={cardStyle}>
        <View
          style={[styles.segmented, { borderColor: theme.colors.border }]}
          accessibilityRole="radiogroup"
          accessibilityLabel="Widget calendar view"
        >
          {CALENDAR_VIEWS.map((view, idx) => {
            const active = widgetCalendarView === view.value;
            return (
              <TouchableOpacity
                key={view.value}
                style={[
                  styles.segment,
                  idx < CALENDAR_VIEWS.length - 1 && {
                    borderRightWidth: 1,
                    borderRightColor: theme.colors.border,
                  },
                  active && { backgroundColor: theme.colors.primary },
                ]}
                onPress={() => setWidgetCalendarView(view.value)}
                accessibilityRole="radio"
                accessibilityLabel={`${view.label} view`}
                {...a11yState({ checked: active })}
                hitSlop={SEGMENT_HIT_SLOP}
              >
                <Text
                  style={[
                    styles.segmentLabel,
                    { color: active ? theme.colors.onPrimary : theme.colors.text },
                  ]}
                >
                  {view.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Category picker */}
      <TouchableOpacity
        style={[
          styles.card,
          {
            backgroundColor: widgetCategory === null ? theme.colors.primaryLight : theme.colors.surface,
            borderColor: widgetCategory === null ? theme.colors.primary : theme.colors.border,
            borderRadius: theme.borderRadius.md,
          },
        ]}
        onPress={() => setWidgetCategory(null)}
        accessibilityRole="radio"
        accessibilityLabel="Show all tasks in widget"
        {...a11yState({ checked: widgetCategory === null })}
      >
        <View style={styles.row}>
          <Text style={[styles.optionName, { color: theme.colors.text }]}>All tasks</Text>
          {widgetCategory === null && (
            <Text {...decorative} style={{ color: theme.colors.primary, fontSize: 18 }}>✓</Text>
          )}
        </View>
      </TouchableOpacity>

      {categories.map((cat) => (
        <TouchableOpacity
          key={cat}
          style={[
            styles.card,
            {
              backgroundColor:
                widgetCategory === cat ? theme.colors.primaryLight : theme.colors.surface,
              borderColor: widgetCategory === cat ? theme.colors.primary : theme.colors.border,
              borderRadius: theme.borderRadius.md,
            },
          ]}
          onPress={() => setWidgetCategory(cat)}
          accessibilityRole="radio"
          accessibilityLabel={`Show only ${cat} tasks in widget`}
          {...a11yState({ checked: widgetCategory === cat })}
        >
          <View style={styles.row}>
            <Text style={[styles.optionName, { color: theme.colors.text }]}>{cat}</Text>
            {widgetCategory === cat && (
              <Text {...decorative} style={{ color: theme.colors.primary, fontSize: 18 }}>✓</Text>
            )}
          </View>
        </TouchableOpacity>
      ))}

      {categories.length === 0 && (
        <View style={[cardStyle, { opacity: 0.6 }]}>
          <Text style={[styles.optionDesc, { color: theme.colors.textSecondary }]}>
            Add categories to your tasks to filter the widget by project.
          </Text>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    marginBottom: 10,
    borderWidth: 1.5,
  },
  segmented: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
  },
  segmentLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionName: {
    fontSize: 16,
    fontWeight: '600',
  },
  optionDesc: {
    fontSize: 13,
  },
});
