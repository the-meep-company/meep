import { StyleSheet, View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { format, setHours, setMinutes, startOfDay, differenceInMinutes } from 'date-fns';
import { useThemeStore } from '@/stores/themeStore';
import { useCalendarStore } from '@/stores/calendarStore';
import EventBlock from './EventBlock';
import type { CalendarEvent } from '@/types';

const HOUR_HEIGHT = 60;
const HOURS = Array.from({ length: 24 }, (_, i) => i);

interface DayViewProps {
  onTimeSlotPress?: (date: Date) => void;
  onEventPress?: (event: CalendarEvent) => void;
}

export default function DayView({ onTimeSlotPress, onEventPress }: DayViewProps) {
  const { theme } = useThemeStore();
  const { selectedDate, getEventsForDate } = useCalendarStore();
  const events = getEventsForDate(selectedDate);

  const getEventPosition = (event: CalendarEvent) => {
    const start = new Date(event.startTime);
    const end = new Date(event.endTime);
    const dayStart = startOfDay(selectedDate);
    const topMinutes = differenceInMinutes(start, dayStart);
    const durationMinutes = differenceInMinutes(end, start);
    return {
      top: (topMinutes / 60) * HOUR_HEIGHT,
      height: Math.max((durationMinutes / 60) * HOUR_HEIGHT, 24),
    };
  };

  const handleTimeSlotPress = (hour: number) => {
    if (!onTimeSlotPress) return;
    const date = setMinutes(setHours(selectedDate, hour), 0);
    onTimeSlotPress(date);
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={{ paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
      contentOffset={{ x: 0, y: 7 * HOUR_HEIGHT }} // scroll to 7am
    >
      <View style={styles.timeGrid}>
        {/* Time labels + grid lines */}
        {HOURS.map((hour) => (
          <TouchableOpacity
            key={hour}
            onPress={() => handleTimeSlotPress(hour)}
            activeOpacity={0.6}
            style={[styles.hourRow, { height: HOUR_HEIGHT }]}
          >
            <Text style={[styles.hourLabel, { color: theme.colors.textTertiary }]}>
              {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
            </Text>
            <View
              style={[styles.hourLine, { borderBottomColor: theme.colors.borderLight }]}
            />
          </TouchableOpacity>
        ))}

        {/* Events overlay */}
        <View style={styles.eventsOverlay}>
          {events.map((event) => {
            const pos = getEventPosition(event);
            return (
              <EventBlock
                key={event.id}
                event={event}
                onPress={onEventPress}
                style={{
                  position: 'absolute',
                  top: pos.top,
                  left: 60,
                  right: 8,
                  height: pos.height,
                }}
              />
            );
          })}
        </View>

        {/* Current time indicator */}
        <CurrentTimeIndicator theme={theme} selectedDate={selectedDate} />
      </View>
    </ScrollView>
  );
}

function CurrentTimeIndicator({
  theme,
  selectedDate,
}: {
  theme: any;
  selectedDate: Date;
}) {
  const now = new Date();
  const isToday =
    now.toDateString() === new Date(selectedDate).toDateString();
  if (!isToday) return null;

  const minutes = now.getHours() * 60 + now.getMinutes();
  const top = (minutes / 60) * HOUR_HEIGHT;

  return (
    <View style={[styles.nowIndicator, { top }]}>
      <View style={[styles.nowDot, { backgroundColor: theme.colors.error }]} />
      <View style={[styles.nowLine, { backgroundColor: theme.colors.error }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  timeGrid: {
    position: 'relative',
  },
  hourRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  hourLabel: {
    width: 52,
    fontSize: 11,
    textAlign: 'right',
    paddingRight: 8,
    marginTop: -6,
  },
  hourLine: {
    flex: 1,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  eventsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  nowIndicator: {
    position: 'absolute',
    left: 48,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  nowDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: -4,
  },
  nowLine: {
    flex: 1,
    height: 1.5,
  },
});
