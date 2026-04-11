import { StyleSheet, View, Text, ScrollView, TouchableOpacity } from 'react-native';
import {
  startOfWeek, addDays, format, isSameDay, isToday,
  startOfDay, differenceInMinutes,
} from 'date-fns';
import { useThemeStore } from '@/stores/themeStore';
import { useCalendarStore } from '@/stores/calendarStore';
import type { CalendarEvent } from '@/types';

const HOUR_HEIGHT = 52;
const HOURS = Array.from({ length: 24 }, (_, i) => i);

interface WeekViewProps {
  onTimeSlotPress?: (date: Date) => void;
  onEventPress?: (event: CalendarEvent) => void;
}

export default function WeekView({ onTimeSlotPress, onEventPress }: WeekViewProps) {
  const { theme } = useThemeStore();
  const { selectedDate, setSelectedDate, setView, getEventsForDate } = useCalendarStore();
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 }); // Monday
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const getEventStyle = (event: CalendarEvent) => {
    const start = new Date(event.startTime);
    const end = new Date(event.endTime);
    const dayStart = startOfDay(start);
    const topMin = differenceInMinutes(start, dayStart);
    const durMin = differenceInMinutes(end, start);
    return {
      top: (topMin / 60) * HOUR_HEIGHT,
      height: Math.max((durMin / 60) * HOUR_HEIGHT, 18),
    };
  };

  const handleDayPress = (day: Date) => {
    setSelectedDate(day);
    setView('day');
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Day headers */}
      <View style={styles.headerRow}>
        <View style={styles.timeGutter} />
        {days.map((day) => {
          const today = isToday(day);
          const selected = isSameDay(day, selectedDate);
          return (
            <TouchableOpacity
              key={day.toISOString()}
              style={styles.dayHeader}
              onPress={() => handleDayPress(day)}
            >
              <Text
                style={[
                  styles.dayName,
                  { color: today ? theme.colors.primary : theme.colors.textTertiary },
                ]}
              >
                {format(day, 'EEE')}
              </Text>
              <View
                style={[
                  styles.dayNumber,
                  today && {
                    backgroundColor: theme.colors.primary,
                    borderRadius: 16,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.dayNumberText,
                    {
                      color: today
                        ? '#FFFFFF'
                        : selected
                        ? theme.colors.primary
                        : theme.colors.text,
                    },
                  ]}
                >
                  {format(day, 'd')}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Time grid */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentOffset={{ x: 0, y: 7 * HOUR_HEIGHT }}
      >
        <View style={styles.grid}>
          {/* Hour rows */}
          {HOURS.map((hour) => (
            <View
              key={hour}
              style={[styles.hourRow, { height: HOUR_HEIGHT }]}
            >
              <View style={styles.timeGutter}>
                <Text style={[styles.hourLabel, { color: theme.colors.textTertiary }]}>
                  {hour === 0
                    ? ''
                    : hour < 12
                    ? `${hour} AM`
                    : hour === 12
                    ? '12 PM'
                    : `${hour - 12} PM`}
                </Text>
              </View>
              {days.map((day) => (
                <TouchableOpacity
                  key={day.toISOString()}
                  style={[
                    styles.cell,
                    { borderColor: theme.colors.borderLight },
                  ]}
                  activeOpacity={0.6}
                  onPress={() => {
                    if (onTimeSlotPress) {
                      const d = new Date(day);
                      d.setHours(hour, 0, 0, 0);
                      onTimeSlotPress(d);
                    }
                  }}
                />
              ))}
            </View>
          ))}

          {/* Event overlays per day column */}
          {days.map((day, dayIndex) => {
            const events = getEventsForDate(day);
            return events.map((event) => {
              const pos = getEventStyle(event);
              const leftOffset = 48 + dayIndex * ((100 - 12) / 7); // approximate %
              return (
                <TouchableOpacity
                  key={event.id}
                  activeOpacity={0.7}
                  onPress={() => onEventPress?.(event)}
                  style={[
                    styles.weekEvent,
                    {
                      top: pos.top,
                      height: pos.height,
                      left: `${8 + dayIndex * (92 / 7)}%`,
                      width: `${92 / 7 - 0.5}%`,
                      backgroundColor: event.color + '33',
                      borderLeftColor: event.color,
                      borderRadius: theme.borderRadius.sm - 2,
                    },
                  ]}
                >
                  <Text
                    style={[styles.weekEventTitle, { color: theme.colors.text }]}
                    numberOfLines={1}
                  >
                    {event.title}
                  </Text>
                </TouchableOpacity>
              );
            });
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,128,128,0.2)',
  },
  timeGutter: {
    width: 48,
  },
  dayHeader: {
    flex: 1,
    alignItems: 'center',
  },
  dayName: {
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  dayNumber: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumberText: {
    fontSize: 16,
    fontWeight: '600',
  },
  grid: {
    position: 'relative',
  },
  hourRow: {
    flexDirection: 'row',
  },
  hourLabel: {
    fontSize: 10,
    textAlign: 'right',
    paddingRight: 6,
    marginTop: -6,
  },
  cell: {
    flex: 1,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  weekEvent: {
    position: 'absolute',
    borderLeftWidth: 2,
    paddingHorizontal: 3,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  weekEventTitle: {
    fontSize: 10,
    fontWeight: '600',
  },
});
