import { useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { differenceInMinutes, format, startOfDay } from 'date-fns';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useThemeStore } from '@/stores/themeStore';
import { useFeedStore } from '@/stores/feedStore';
import type { BotChange } from '@/types';

// A bot's day plan drawn on the day view while the user tweaks it: drag a
// block to move it (15-minute steps), × to leave it out, + to bring it back.
// Nothing is saved until the plan is approved from the bar above the calendar.

const SNAP_MIN = 15;

interface Props {
  day: Date;
  hourHeight: number;
  left: number;
}

export default function DraftBlocks({ day, hourHeight, left }: Props) {
  const draft = useFeedStore((s) => s.draft);
  const item = useFeedStore((s) => (s.draft ? s.items.find((i) => i.id === s.draft!.itemId) : undefined));
  if (!draft || !item) return null;

  return (
    <>
      {item.changes.map((c) => {
        const times = draft.edits[c.id] ?? c.after ?? c.before;
        if (!times) return null;
        return (
          <DraftBlock
            key={c.id}
            change={c}
            start={new Date(times.start)}
            end={new Date(times.end)}
            removed={draft.removed.includes(c.id)}
            day={day}
            hourHeight={hourHeight}
            left={left}
          />
        );
      })}
    </>
  );
}

function DraftBlock({
  change,
  start,
  end,
  removed,
  day,
  hourHeight,
  left,
}: {
  change: BotChange;
  start: Date;
  end: Date;
  removed: boolean;
  day: Date;
  hourHeight: number;
  left: number;
}) {
  const { theme } = useThemeStore();
  const [dragMin, setDragMin] = useState(0);
  const movable = change.kind !== 'delete' && !removed;

  // Latest values for the responder, which is created once per block.
  const latest = useRef({ start, end, hourHeight, movable });
  latest.current = { start, end, hourHeight, movable };

  const shift = (minutes: number) => {
    if (!minutes) return;
    const { start: s, end: e } = latest.current;
    useFeedStore
      .getState()
      .moveDraftBlock(change.id, new Date(s.getTime() + minutes * 60000).toISOString(), new Date(e.getTime() + minutes * 60000).toISOString());
  };

  const snapped = (dy: number) => Math.round(((dy / latest.current.hourHeight) * 60) / SNAP_MIN) * SNAP_MIN;
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => latest.current.movable,
        onMoveShouldSetPanResponder: (_, g) => latest.current.movable && Math.abs(g.dy) > 4,
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (_, g) => setDragMin(snapped(g.dy)),
        onPanResponderRelease: (_, g) => {
          setDragMin(0);
          shift(snapped(g.dy));
        },
        onPanResponderTerminate: () => setDragMin(0),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const shownStart = new Date(start.getTime() + dragMin * 60000);
  const shownEnd = new Date(end.getTime() + dragMin * 60000);
  const top = (differenceInMinutes(shownStart, startOfDay(day)) / 60) * hourHeight;
  const height = Math.max((differenceInMinutes(shownEnd, shownStart) / 60) * hourHeight, 28);
  const time = `${format(shownStart, 'h:mm')}–${format(shownEnd, 'h:mm a')}`.toLowerCase();
  const verb = change.kind === 'delete' ? 'Remove' : change.kind === 'move' ? 'Move' : 'Add';

  return (
    <View
      {...responder.panHandlers}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={`${removed ? 'Left out: ' : ''}${verb} ${change.title}, ${time}`}
      accessibilityHint={movable ? 'Swipe up or down to move it 15 minutes' : undefined}
      accessibilityActions={[
        ...(movable ? [{ name: 'increment' as const, label: '15 minutes later' }, { name: 'decrement' as const, label: '15 minutes earlier' }] : []),
        { name: 'activate' as const, label: removed ? 'Put back in the plan' : 'Leave out of the plan' },
      ]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'increment') shift(SNAP_MIN);
        else if (e.nativeEvent.actionName === 'decrement') shift(-SNAP_MIN);
        else if (e.nativeEvent.actionName === 'activate') useFeedStore.getState().toggleDraftBlock(change.id);
      }}
      style={[
        styles.block,
        {
          top,
          height,
          left,
          borderColor: removed ? theme.colors.textTertiary : theme.colors.primary,
          backgroundColor: removed ? 'transparent' : theme.colors.primaryLight,
          opacity: removed ? 0.5 : 1,
        },
        dragMin !== 0 && styles.dragging,
      ]}
    >
      <View style={styles.text}>
        <Text
          style={[styles.title, { color: theme.colors.text }, (removed || change.kind === 'delete') && styles.struck]}
          numberOfLines={1}
        >
          {change.kind === 'delete' ? `Remove ${change.title}` : change.title}
        </Text>
        {height >= 40 && <Text style={[styles.time, { color: theme.colors.textSecondary }]}>{time}</Text>}
      </View>
      <Pressable
        accessible={false}
        hitSlop={10}
        onPress={() => useFeedStore.getState().toggleDraftBlock(change.id)}
        style={styles.toggle}
      >
        <FontAwesome name={removed ? 'plus' : 'times'} size={12} color={theme.colors.textSecondary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    position: 'absolute',
    right: 8,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'flex-start',
    zIndex: 5,
  },
  dragging: { zIndex: 20, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  text: { flex: 1, gap: 1 },
  title: { fontSize: 13, fontWeight: '600' },
  time: { fontSize: 11 },
  struck: { textDecorationLine: 'line-through' },
  toggle: { padding: 2 },
});
