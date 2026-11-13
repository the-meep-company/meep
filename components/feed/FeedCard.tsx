import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { format, formatDistanceToNowStrict, isSameDay, isToday, parseISO } from 'date-fns';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useThemeStore } from '@/stores/themeStore';
import { useFeedStore } from '@/stores/feedStore';
import { useCalendarStore } from '@/stores/calendarStore';
import { useRouter } from 'expo-router';
import { feedAction, isDayPlan } from '@/lib/bots';
import Card from '@/components/ui/Card';
import MeepleAvatar from '@/components/meeples/MeepleAvatar';
import MiniDayView from './MiniDayView';
import { a11yState, decorative } from '@/lib/accessibility';
import type { BotChange, FeedItem, Meeple } from '@/types';

// One item in the bots' feed. Calm by design: no badges, no red. Proposals can
// be approved whole, tweaked (pick which changes), dismissed, or talked about;
// done items can be undone; insights can be put away.

const time = (iso: string) => format(new Date(iso), 'h:mm a').toLowerCase();

function describe(c: BotChange): string {
  if (c.kind === 'create') return `${c.title}, ${time(c.after!.start)}–${time(c.after!.end)}`;
  if (c.kind === 'delete') return `Remove ${c.title} (${time(c.before!.start)})`;
  return `${c.title}: ${time(c.before!.start)} → ${time(c.after!.start)}`;
}

interface Props {
  item: FeedItem;
  bot?: Pick<Meeple, 'id' | 'name' | 'icon' | 'glow'>;
  onReply: (meepleId: string) => void;
}

export default function FeedCard({ item, bot, onReply }: Props) {
  const { theme } = useThemeStore();
  const router = useRouter();
  const busy = useFeedStore((s) => s.busyIds.includes(item.id));
  // Select the stable events array and filter here; a selector returning a
  // fresh array would re-render forever.
  const events = useCalendarStore((s) => s.events);
  const dayEvents = useMemo(() => {
    if (!item.day) return [];
    const day = parseISO(item.day);
    return events.filter((e) => isSameDay(new Date(e.startTime), day));
  }, [events, item.day]);
  const [tweaking, setTweaking] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(() => new Set(item.changes.map((c) => c.id)));
  const [note, setNote] = useState<string | null>(null);

  // A plan for one day is tweaked on the day view itself; anything wider by
  // choosing which changes to keep, here on the card.
  const dayPlan = isDayPlan(item);
  const tweak = () => {
    if (!dayPlan) {
      setTweaking((t) => !t);
      return;
    }
    useFeedStore.getState().startDraft(item.id);
    const calendar = useCalendarStore.getState();
    calendar.setSelectedDate(parseISO(item.day!));
    calendar.setView('day');
    router.navigate('/(tabs)/calendar');
  };

  const act = async (action: 'approve' | 'dismiss' | 'undo', changeIds?: string[]) => {
    setNote(null);
    const error = await feedAction(item, action, changeIds);
    if (error) setNote(error);
    else setTweaking(false);
  };

  const pending = item.status === 'pending';
  const settled = item.status === 'dismissed' || item.status === 'undone';
  const when = isToday(new Date(item.createdAt))
    ? formatDistanceToNowStrict(new Date(item.createdAt), { addSuffix: true })
    : format(new Date(item.createdAt), 'EEE d MMM');
  const shown = item.type === 'done' ? item.changes.filter((c) => c.applied) : item.changes;

  const statusLine =
    item.status === 'applied' && item.type === 'proposal'
      ? 'Approved'
      : item.status === 'undone'
      ? 'Undone'
      : item.status === 'dismissed' && item.type !== 'insight'
      ? 'Dismissed'
      : null;

  return (
    <Card radius={theme.borderRadius.lg} style={[styles.card, settled && styles.settled]}>
      <View style={styles.header}>
        {bot && <MeepleAvatar icon={bot.icon} glow={bot.glow} size={26} />}
        <Text style={[styles.byline, { color: theme.colors.textSecondary }]} numberOfLines={1}>
          {bot?.name ?? 'A bot'} · {when}
          {item.dryRun ? ' · preview' : ''}
        </Text>
      </View>

      <Text accessibilityRole="header" style={[styles.title, { color: theme.colors.text }]}>
        {item.title}
      </Text>
      {item.body ? <Text style={[styles.body, { color: theme.colors.textSecondary }]}>{item.body}</Text> : null}

      {shown.length > 0 && item.type !== 'insight' && (
        <>
          {item.type === 'proposal' && pending && <MiniDayView changes={shown} events={dayEvents} />}
          <View style={styles.changes}>
            {shown.map((c) => {
              const on = picked.has(c.id);
              const row = (
                <>
                  {tweaking ? (
                    <FontAwesome
                      name={on ? 'check-circle' : 'circle-thin'}
                      size={16}
                      color={on ? theme.colors.text : theme.colors.textTertiary}
                      {...decorative}
                    />
                  ) : (
                    <View style={[styles.bullet, { backgroundColor: theme.colors.textTertiary }]} {...decorative} />
                  )}
                  <View style={styles.changeText}>
                    <Text style={[styles.change, { color: theme.colors.text }]}>{describe(c)}</Text>
                    {c.reason ? (
                      <Text style={[styles.reason, { color: theme.colors.textTertiary }]}>{c.reason}</Text>
                    ) : null}
                  </View>
                </>
              );
              return tweaking ? (
                <Pressable
                  key={c.id}
                  accessibilityRole="checkbox"
                  accessibilityLabel={describe(c)}
                  {...a11yState({ checked: on })}
                  onPress={() =>
                    setPicked((p) => {
                      const next = new Set(p);
                      if (next.has(c.id)) next.delete(c.id);
                      else next.add(c.id);
                      return next;
                    })
                  }
                  style={styles.changeRow}
                >
                  {row}
                </Pressable>
              ) : (
                <View key={c.id} style={styles.changeRow}>
                  {row}
                </View>
              );
            })}
          </View>
        </>
      )}

      {note && (
        <Text accessibilityLiveRegion="polite" style={[styles.note, { color: theme.colors.textSecondary }]}>
          {note}
        </Text>
      )}
      {statusLine && <Text style={[styles.note, { color: theme.colors.textTertiary }]}>{statusLine}</Text>}

      <View style={styles.actions}>
        {busy && <ActivityIndicator size="small" color={theme.colors.textSecondary} />}

        {item.type === 'proposal' && pending && !busy && (
          <>
            <Chip label="Dismiss" onPress={() => act('dismiss')} />
            {(dayPlan || item.changes.length > 1) && (
              <Chip label={tweaking ? 'Cancel' : 'Tweak'} onPress={tweak} />
            )}
            <Chip
              primary
              label={tweaking ? `Approve ${picked.size}` : 'Approve'}
              disabled={tweaking && picked.size === 0}
              onPress={() => act('approve', tweaking ? [...picked] : undefined)}
            />
          </>
        )}

        {item.status === 'applied' && !busy && (
          <Chip label="Undo" icon="undo" onPress={() => act('undo')} />
        )}

        {item.type === 'insight' && pending && !busy && <Chip label="Got it" onPress={() => act('dismiss')} />}

        {bot && !settled && (
          <Chip label="Reply" icon="reply" onPress={() => onReply(bot.id)} accessibilityLabel={`Reply to ${bot.name}`} />
        )}
      </View>
    </Card>
  );
}

function Chip({
  label,
  icon,
  primary,
  disabled,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  icon?: 'undo' | 'reply';
  primary?: boolean;
  disabled?: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  const { theme } = useThemeStore();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      {...a11yState({ disabled: !!disabled })}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        primary
          ? { backgroundColor: disabled ? theme.colors.primaryLight : theme.colors.primary }
          : { borderWidth: 1, borderColor: theme.colors.border },
        pressed && { opacity: 0.75 },
      ]}
    >
      {icon && (
        <FontAwesome name={icon} size={11} color={theme.colors.textSecondary} {...decorative} />
      )}
      <Text
        style={[
          styles.chipText,
          { color: primary ? (disabled ? theme.colors.textTertiary : theme.colors.onPrimary) : theme.colors.textSecondary },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16 },
  settled: { opacity: 0.6 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  byline: { fontSize: 13, flexShrink: 1 },
  title: { fontSize: 17, fontWeight: '600', lineHeight: 22 },
  body: { fontSize: 15, lineHeight: 21, marginTop: 6 },
  changes: { marginTop: 10, gap: 8 },
  changeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  bullet: { width: 5, height: 5, borderRadius: 3, marginTop: 8, marginHorizontal: 5 },
  changeText: { flex: 1, gap: 2 },
  change: { fontSize: 14, lineHeight: 19 },
  reason: { fontSize: 13, lineHeight: 17 },
  note: { fontSize: 13, marginTop: 10 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 14 },
  chip: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chipText: { fontSize: 14, fontWeight: '500' },
});
