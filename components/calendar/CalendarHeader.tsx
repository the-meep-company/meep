import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { format } from 'date-fns';
import { useThemeStore } from '@/stores/themeStore';
import { useCalendarStore } from '@/stores/calendarStore';
import type { CalendarView } from '@/types';

const VIEW_OPTIONS: { key: CalendarView; label: string }[] = [
  { key: 'day', label: 'Day' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
];

export default function CalendarHeader() {
  const { theme } = useThemeStore();
  const { currentView, selectedDate, setView, goBack, goForward, goToToday } =
    useCalendarStore();

  const getTitle = () => {
    if (currentView === 'day') return format(selectedDate, 'EEEE, MMM d');
    if (currentView === 'week') return format(selectedDate, 'MMM yyyy');
    return format(selectedDate, 'MMMM yyyy');
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Navigation row */}
      <View style={styles.navRow}>
        <TouchableOpacity onPress={goBack} style={styles.navBtn}>
          <Text style={[styles.navArrow, { color: theme.colors.primary }]}>‹</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={goToToday}>
          <Text style={[styles.title, { color: theme.colors.text }]}>{getTitle()}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={goForward} style={styles.navBtn}>
          <Text style={[styles.navArrow, { color: theme.colors.primary }]}>›</Text>
        </TouchableOpacity>
      </View>

      {/* View switcher */}
      <View
        style={[
          styles.viewSwitcher,
          {
            backgroundColor: theme.colors.surfaceSecondary,
            borderRadius: theme.borderRadius.md,
          },
        ]}
      >
        {VIEW_OPTIONS.map(({ key, label }) => (
          <TouchableOpacity
            key={key}
            onPress={() => setView(key)}
            style={[
              styles.viewBtn,
              {
                backgroundColor:
                  currentView === key ? theme.colors.primary : 'transparent',
                borderRadius: theme.borderRadius.sm,
              },
            ]}
          >
            <Text
              style={[
                styles.viewBtnText,
                {
                  color:
                    currentView === key ? '#FFFFFF' : theme.colors.textSecondary,
                  fontWeight: currentView === key ? '600' : '400',
                },
              ]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  navBtn: {
    padding: 8,
    width: 44,
    alignItems: 'center',
  },
  navArrow: {
    fontSize: 28,
    fontWeight: '300',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
  },
  viewSwitcher: {
    flexDirection: 'row',
    padding: 3,
  },
  viewBtn: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
  },
  viewBtnText: {
    fontSize: 13,
  },
});
