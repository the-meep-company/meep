import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, format, isSameMonth, isSameDay, isToday,
} from 'date-fns';
import { useThemeStore } from '@/stores/themeStore';
import { useCalendarStore } from '@/stores/calendarStore';

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface MonthViewProps {
  onDayPress?: (date: Date) => void;
}

export default function MonthView({ onDayPress }: MonthViewProps) {
  const { theme } = useThemeStore();
  const { selectedDate, setSelectedDate, setView, getEventsForDate } = useCalendarStore();

  const monthStart = startOfMonth(selectedDate);
  const monthEnd = endOfMonth(selectedDate);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  // Build rows of 7 days
  const rows: Date[][] = [];
  let day = calStart;
  while (day <= calEnd) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(day);
      day = addDays(day, 1);
    }
    rows.push(week);
  }

  const handleDayPress = (d: Date) => {
    setSelectedDate(d);
    if (onDayPress) {
      onDayPress(d);
    } else {
      setView('day');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Day name headers */}
      <View style={styles.headerRow}>
        {DAY_NAMES.map((name) => (
          <View key={name} style={styles.headerCell}>
            <Text style={[styles.headerText, { color: theme.colors.textTertiary }]}>
              {name}
            </Text>
          </View>
        ))}
      </View>

      {/* Calendar grid */}
      {rows.map((week, rowIdx) => (
        <View key={rowIdx} style={styles.weekRow}>
          {week.map((d) => {
            const inMonth = isSameMonth(d, selectedDate);
            const today = isToday(d);
            const selected = isSameDay(d, selectedDate);
            const events = getEventsForDate(d);

            return (
              <TouchableOpacity
                key={d.toISOString()}
                style={[
                  styles.dayCell,
                  {
                    backgroundColor: selected
                      ? theme.colors.primaryLight
                      : 'transparent',
                    borderRadius: theme.borderRadius.sm,
                  },
                ]}
                onPress={() => handleDayPress(d)}
                activeOpacity={0.6}
              >
                <View
                  style={[
                    styles.dayNumberWrapper,
                    today && {
                      backgroundColor: theme.colors.primary,
                      borderRadius: 14,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.dayNumber,
                      {
                        color: today
                          ? '#FFFFFF'
                          : inMonth
                          ? theme.colors.text
                          : theme.colors.textTertiary,
                        fontWeight: today || selected ? '700' : '400',
                      },
                    ]}
                  >
                    {format(d, 'd')}
                  </Text>
                </View>

                {/* Event dots */}
                {events.length > 0 && (
                  <View style={styles.dotRow}>
                    {events.slice(0, 3).map((e, i) => (
                      <View
                        key={i}
                        style={[styles.dot, { backgroundColor: e.color }]}
                      />
                    ))}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 8,
  },
  headerRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  headerCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  headerText: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    minHeight: 52,
  },
  dayNumberWrapper: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumber: {
    fontSize: 14,
  },
  dotRow: {
    flexDirection: 'row',
    marginTop: 4,
    gap: 3,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
});
