import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { format } from 'date-fns';
import { useThemeStore } from '@/stores/themeStore';
import type { CalendarEvent } from '@/types';

interface EventBlockProps {
  event: CalendarEvent;
  style?: object;
  compact?: boolean;
  onPress?: (event: CalendarEvent) => void;
}

export default function EventBlock({ event, style, compact, onPress }: EventBlockProps) {
  const { theme } = useThemeStore();
  const startTime = new Date(event.startTime);
  const endTime = new Date(event.endTime);

  return (
    <TouchableOpacity
      onPress={() => onPress?.(event)}
      activeOpacity={0.7}
      style={[
        styles.container,
        {
          backgroundColor: event.color + '22',
          borderLeftColor: event.color,
          borderRadius: theme.borderRadius.sm,
        },
        style,
      ]}
    >
      <Text
        style={[styles.title, { color: theme.colors.text }]}
        numberOfLines={compact ? 1 : 2}
      >
        {event.title}
      </Text>
      {!compact && (
        <Text style={[styles.time, { color: theme.colors.textSecondary }]}>
          {format(startTime, 'h:mm a')} – {format(endTime, 'h:mm a')}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderLeftWidth: 3,
    marginVertical: 1,
    overflow: 'hidden',
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
  },
  time: {
    fontSize: 11,
    marginTop: 2,
  },
});
