import { Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { format } from 'date-fns';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useThemeStore } from '@/stores/themeStore';
import { useMeepleStore } from '@/stores/meepleStore';
import MeepleAvatar from '@/components/meeples/MeepleAvatar';
import { decorative } from '@/lib/accessibility';
import { canRunOver, canSkip, hasStarted, markRunningOver, setEventStatus } from '@/lib/eventStatus';
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
  const status = event.status ?? 'planned';
  const started = hasStarted(event);

  const label = [
    event.title,
    `${format(startTime, 'h:mm a')} to ${format(endTime, 'h:mm a')}`,
    isHabit ? 'recurring habit' : null,
    isAiPlaced && !isGoogle ? 'scheduled by AI' : null,
    isGoogle ? 'from Google Calendar' : null,
    bot ? `placed by ${bot.name}` : null,
    status !== 'planned' ? status : null,
  ]
    .filter(Boolean)
    .join(', ');

  // Check-off for screen readers; the circle on the block does the same by tap.
  const actions = [
    ...(started ? [{ name: 'done', label: status === 'done' ? 'Mark not done' : 'Mark done' }] : []),
    ...(canSkip(event) ? [{ name: 'skip', label: status === 'skipped' ? 'Unskip' : 'Skip' }] : []),
    ...(canRunOver(event) ? [{ name: 'over', label: 'Running over' }] : []),
  ];
  const onAction = (name: string) => {
    if (name === 'done') setEventStatus(event, status === 'done' ? 'planned' : 'done');
    else if (name === 'skip') setEventStatus(event, status === 'skipped' ? 'planned' : 'skipped');
    else if (name === 'over') markRunningOver(event);
  };

  return (
    <TouchableOpacity
      onPress={() => onPress?.(event)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Opens event details"
      accessibilityActions={actions}
      onAccessibilityAction={(e) => onAction(e.nativeEvent.actionName)}
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
        status === 'done' && styles.done,
        status === 'skipped' && styles.skipped,
        style,
      ]}
    >
      <View style={styles.titleRow}>
        {isHabit && (
          <FontAwesome name="refresh" size={10} color={event.color} style={styles.habitIcon} {...decorative} />
        )}
        <Text
          style={[styles.title, { color: status === 'planned' ? theme.colors.text : theme.colors.textSecondary, flex: 1 }]}
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
        {(started || status !== 'planned') && (
          <Pressable
            accessible={false}
            hitSlop={10}
            onPress={() => setEventStatus(event, status === 'planned' ? 'done' : 'planned')}
            style={styles.check}
          >
            <FontAwesome
              name={status === 'done' ? 'check-circle' : status === 'skipped' ? 'minus-circle' : 'circle-thin'}
              size={14}
              color={status === 'done' ? event.color : theme.colors.textTertiary}
            />
          </Pressable>
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
  check: {
    marginLeft: 6,
  },
  done: {
    opacity: 0.6,
  },
  skipped: {
    opacity: 0.45,
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
