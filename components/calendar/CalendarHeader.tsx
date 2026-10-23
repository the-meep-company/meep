import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { addDays, format, isSameMonth, startOfWeek } from 'date-fns';
import { useThemeStore } from '@/stores/themeStore';
import { useCalendarStore } from '@/stores/calendarStore';
import { useSyncStore } from '@/stores/syncStore';
import { useSettingsStore } from '@/stores/settingsStore';
import ScreenHeader, { GlowAvatar } from '@/components/ui/ScreenHeader';
import IconButton from '@/components/ui/IconButton';
import PillTabs from '@/components/ui/PillTabs';
import { DisplayTitle } from '@/components/ui/Typography';
import type { CalendarView } from '@/types';

const VIEW_OPTIONS: { value: CalendarView; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];

/** Two-tone heading for the current range, e.g. "2026 / October". */
function rangeTitle(view: CalendarView, date: Date): { lead: string; title: string } {
  if (view === 'day') return { lead: format(date, 'EEEE'), title: format(date, 'd MMMM') };
  if (view === 'week') {
    const start = startOfWeek(date, { weekStartsOn: 1 });
    const end = addDays(start, 6);
    return {
      lead: 'Week of',
      title: isSameMonth(start, end)
        ? `${format(start, 'd')}–${format(end, 'd MMMM')}`
        : `${format(start, 'd MMM')} – ${format(end, 'd MMM')}`,
    };
  }
  return { lead: format(date, 'yyyy'), title: format(date, 'MMMM') };
}

export default function CalendarHeader() {
  const { theme } = useThemeStore();
  const { currentView, selectedDate, setView, goBack, goForward, goToToday } =
    useCalendarStore();
  const { syncState, googleCalendars } = useSyncStore();
  const companionName = useSettingsStore((s) => s.companionName);
  const syncing = googleCalendars.length > 0 && syncState.isSyncing;
  const { lead, title } = rangeTitle(currentView, selectedDate);

  return (
    <View>
      <ScreenHeader
        title="Calendar"
        left={<GlowAvatar initial={companionName || 'M'} />}
        right={
          <IconButton
            icon="calendar-check-o"
            accessibilityLabel="Go to today"
            onPress={goToToday}
          />
        }
      />

      <View style={[styles.body, { paddingHorizontal: theme.spacing.screen }]}>
        <View style={styles.titleRow}>
          <DisplayTitle lead={lead} title={title} />
          {syncing && (
            <ActivityIndicator
              color={theme.colors.textSecondary}
              accessibilityLabel="Syncing with Google Calendar"
              accessibilityLiveRegion="polite"
            />
          )}
        </View>

        <View style={styles.controls}>
          <PillTabs
            options={VIEW_OPTIONS}
            value={currentView}
            onChange={setView}
            layout="fill"
            accessibilityLabel="Calendar view"
            style={styles.tabs}
          />
          <IconButton
            icon="chevron-left"
            size={38}
            iconSize={12}
            accessibilityLabel={`Previous ${currentView}`}
            onPress={goBack}
          />
          <IconButton
            icon="chevron-right"
            size={38}
            iconSize={12}
            accessibilityLabel={`Next ${currentView}`}
            onPress={goForward}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingTop: 4,
    paddingBottom: 14,
    gap: 18,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tabs: {
    flex: 1,
  },
});
