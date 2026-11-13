import { StyleSheet, Text, View } from 'react-native';
import { format } from 'date-fns';
import { useThemeStore } from '@/stores/themeStore';
import { decorative } from '@/lib/accessibility';
import type { BotChange, CalendarEvent } from '@/types';

// A slice of one day with a bot's changes drawn on it: what's already there
// (quiet), where moved blocks were (outline), and where blocks land (solid).
// Purely visual; the card lists the changes in text for screen readers.

const PX_PER_HOUR = 26;
const MIN_SPAN_H = 4;

interface Props {
  changes: BotChange[];
  /** Events on the same day, from the calendar store. */
  events: CalendarEvent[];
}

const hoursOf = (iso: string | Date) => {
  const d = new Date(iso);
  return d.getHours() + d.getMinutes() / 60;
};

export default function MiniDayView({ changes, events }: Props) {
  const { theme } = useThemeStore();
  const touched = new Set(changes.map((c) => c.event_id).filter(Boolean));

  const marks = changes.flatMap((c) => [c.before, c.after].filter(Boolean)) as { start: string; end: string }[];
  if (!marks.length) return null;
  let from = Math.floor(Math.min(...marks.map((m) => hoursOf(m.start)))) - 1;
  let to = Math.ceil(Math.max(...marks.map((m) => hoursOf(m.end)))) + 1;
  if (to - from < MIN_SPAN_H) to = from + MIN_SPAN_H;
  from = Math.max(0, from);
  to = Math.min(24, to);
  const span = to - from;
  const height = span * PX_PER_HOUR;
  const y = (h: number) => (Math.min(Math.max(h, from), to) - from) * PX_PER_HOUR;

  const block = (start: string | Date, end: string | Date) => {
    const top = y(hoursOf(start));
    // A hair shorter than the slot so back-to-back blocks read as separate.
    return { top, height: Math.max(14, y(hoursOf(end)) - top - 2) };
  };

  const context = events.filter((e) => !e.allDay && !touched.has(e.id) && hoursOf(e.endTime) > from && hoursOf(e.startTime) < to);
  const ticks = Array.from({ length: Math.floor(span / 2) + 1 }, (_, i) => from + i * 2).filter((h) => h < to);

  return (
    <View style={[styles.frame, { height, borderColor: theme.colors.border }]} {...decorative}>
      {ticks.map((h) => (
        <View key={h} style={[styles.tick, { top: y(h) }]}>
          <Text style={[styles.tickLabel, { color: theme.colors.textTertiary }]}>
            {format(new Date(2000, 0, 1, h), 'ha').toLowerCase()}
          </Text>
          <View style={[styles.tickLine, { backgroundColor: theme.colors.border }]} />
        </View>
      ))}

      {context.map((e) => (
        <View
          key={e.id}
          style={[styles.block, block(e.startTime, e.endTime), { backgroundColor: theme.colors.primaryLight }]}
        >
          <Text style={[styles.blockText, { color: theme.colors.textTertiary }]} numberOfLines={1}>
            {e.title}
          </Text>
        </View>
      ))}

      {changes.map((c) => (
        <View key={c.id}>
          {c.before && (
            <View
              style={[
                styles.block,
                block(c.before.start, c.before.end),
                styles.ghost,
                { borderColor: theme.colors.textTertiary },
              ]}
            >
              <Text
                style={[
                  styles.blockText,
                  { color: theme.colors.textTertiary },
                  c.kind === 'delete' && styles.struck,
                ]}
                numberOfLines={1}
              >
                {c.title}
              </Text>
            </View>
          )}
          {c.after && (
            <View style={[styles.block, block(c.after.start, c.after.end), { backgroundColor: theme.colors.primary }]}>
              <Text style={[styles.blockText, { color: theme.colors.onPrimary }]} numberOfLines={1}>
                {c.title}
              </Text>
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { marginTop: 12, marginBottom: 4, borderTopWidth: StyleSheet.hairlineWidth },
  tick: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 6 },
  tickLabel: { fontSize: 10, width: 30, marginTop: -6 },
  tickLine: { flex: 1, height: StyleSheet.hairlineWidth, marginTop: -6 },
  block: {
    position: 'absolute',
    left: 40,
    right: 4,
    borderRadius: 6,
    paddingHorizontal: 8,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  ghost: { borderWidth: 1, borderStyle: 'dashed', backgroundColor: 'transparent' },
  blockText: { fontSize: 11, fontWeight: '500' },
  struck: { textDecorationLine: 'line-through' },
});
