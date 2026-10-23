import { Pressable, StyleSheet, View, Text, ScrollView } from 'react-native';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, format, isSameMonth, isSameDay, isToday,
} from 'date-fns';
import { useThemeStore } from '@/stores/themeStore';
import { useCalendarStore } from '@/stores/calendarStore';
import { useHabitStore } from '@/stores/habitStore';
import { generateHabitEventsForDate } from '@/lib/habitHelpers';
import { decorative } from '@/lib/accessibility';
import { useTabBarClearance } from '@/components/navigation/FloatingTabBar';
import Card from '@/components/ui/Card';

const DAY_INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DAY_CIRCLE = 36;

interface MonthViewProps {
  onDayPress?: (date: Date) => void;
}

export default function MonthView({ onDayPress }: MonthViewProps) {
  const { theme } = useThemeStore();
  const tabClearance = useTabBarClearance();
  const { selectedDate, setSelectedDate, setView, getEventsForDate } = useCalendarStore();
  const { getActiveHabits } = useHabitStore();
  const activeHabits = getActiveHabits();

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
    <ScrollView
      contentContainerStyle={{
        paddingHorizontal: theme.spacing.screen,
        paddingBottom: tabClearance,
      }}
      showsVerticalScrollIndicator={false}
    >
      <Card style={styles.card}>
        {/* Weekday initials — visual only; each day's label carries its weekday */}
        <View style={styles.weekRow} {...decorative}>
          {DAY_INITIALS.map((name, i) => (
            <View key={i} style={styles.headerCell}>
              <Text style={[styles.headerText, { color: theme.colors.textSecondary }]}>{name}</Text>
            </View>
          ))}
        </View>

        {rows.map((week, rowIdx) => (
          <View key={rowIdx} style={styles.weekRow}>
            {week.map((d) => {
              const inMonth = isSameMonth(d, selectedDate);
              const today = isToday(d);
              const selected = isSameDay(d, selectedDate);
              const events = [
                ...getEventsForDate(d),
                ...generateHabitEventsForDate(activeHabits, d),
              ];
              const label = [
                format(d, 'EEEE d MMMM'),
                today ? 'today' : null,
                selected ? 'selected' : null,
                events.length > 0
                  ? `${events.length} ${events.length === 1 ? 'event' : 'events'}`
                  : null,
              ]
                .filter(Boolean)
                .join(', ');

              return (
                <Pressable
                  key={d.toISOString()}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  accessibilityHint="Opens this day"
                  onPress={() => handleDayPress(d)}
                  style={({ pressed }) => [styles.dayCell, pressed && { opacity: 0.6 }]}
                >
                  <View
                    style={[
                      styles.dayCircle,
                      today && { backgroundColor: theme.colors.primary },
                      selected &&
                        !today && {
                          backgroundColor: theme.colors.primaryLight,
                          borderWidth: 1.5,
                          borderColor: theme.colors.primary,
                        },
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayNumber,
                        {
                          color: today
                            ? theme.colors.onPrimary
                            : inMonth
                            ? theme.colors.text
                            : theme.colors.textTertiary,
                          fontWeight: today || selected ? '600' : '400',
                        },
                      ]}
                    >
                      {format(d, 'd')}
                    </Text>
                  </View>

                  {/* Event dots */}
                  <View style={styles.dotRow} {...decorative}>
                    {events.slice(0, 3).map((e, i) => (
                      <View key={i} style={[styles.dot, { backgroundColor: e.color }]} />
                    ))}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: 10,
    paddingVertical: 14,
  },
  weekRow: {
    flexDirection: 'row',
  },
  headerCell: {
    flex: 1,
    alignItems: 'center',
    paddingBottom: 8,
  },
  headerText: {
    fontSize: 11,
    fontWeight: '500',
  },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    minHeight: 50,
    paddingTop: 2,
  },
  dayCircle: {
    width: DAY_CIRCLE,
    height: DAY_CIRCLE,
    borderRadius: DAY_CIRCLE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumber: {
    fontSize: 15,
  },
  dotRow: {
    flexDirection: 'row',
    gap: 3,
    height: 7,
    marginTop: 3,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
});
