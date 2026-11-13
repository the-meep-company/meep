import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { format } from 'date-fns';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useThemeStore } from '@/stores/themeStore';
import { useMeepleStore } from '@/stores/meepleStore';
import MeepleAvatar from '@/components/meeples/MeepleAvatar';
import { decorative } from '@/lib/accessibility';
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
  const isHabit = event.isHabit === true;
  const isAiPlaced = event.scheduleSource === 'ai';
  const isGoogle = event.source === 'google';
  // The bot that placed or last moved this block, shown as its little face.
  const bot = useMeepleStore((s) => (event.botId ? s.meeples.find((m) => m.id === event.botId) : undefined));


  const label = [
    event.title,
    `${format(startTime, 'h:mm a')} to ${format(endTime, 'h:mm a')}`,
    isHabit ? 'recurring habit' : null,
    isAiPlaced && !isGoogle ? 'scheduled by AI' : null,
    isGoogle ? 'from Google Calendar' : null,
    bot ? `placed by ${bot.name}` : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <TouchableOpacity
      onPress={() => onPress?.(event)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Opens event details"
      style={[
        styles.container,
        {
          backgroundColor: event.color + (isHabit ? '18' : '22'),
          borderLeftColor: event.color,
          borderRadius: theme.borderRadius.sm,
          opacity: isHabit ? 0.9 : 1,
        },
        isHabit && styles.habitBorder,
        isAiPlaced && !isHabit && { borderStyle: 'dashed' as const, borderLeftColor: theme.colors.primary },
        style,
      ]}
    >
      <View style={styles.titleRow}>
        {isHabit && (
          <FontAwesome name="refresh" size={10} color={event.color} style={styles.habitIcon} {...decorative} />
        )}
        <Text
          style={[styles.title, { color: theme.colors.text, flex: 1 }]}
          numberOfLines={compact ? 1 : 2}
        >
          {event.title}
        </Text>
        {bot ? (
          <View style={styles.aiIcon}>
            <MeepleAvatar icon={bot.icon} glow={bot.glow} size={14} />
          </View>
        ) : (
          isAiPlaced && !isGoogle && (
            <FontAwesome name="magic" size={10} color={theme.colors.text} style={styles.aiIcon} {...decorative} />
          )
        )}
        {isGoogle && (
          <FontAwesome name="google" size={10} color={event.color} style={styles.googleIcon} {...decorative} />
        )}
      </View>
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
  habitBorder: {
    borderStyle: 'dashed',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  habitIcon: {
    marginRight: 4,
  },
  aiIcon: {
    marginLeft: 4,
  },
  googleIcon: {
    marginLeft: 4,
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
