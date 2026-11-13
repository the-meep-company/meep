import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { format, parseISO } from 'date-fns';
import { useThemeStore } from '@/stores/themeStore';
import { useFeedStore } from '@/stores/feedStore';
import { useMeepleStore } from '@/stores/meepleStore';
import { feedAction } from '@/lib/bots';
import Card from '@/components/ui/Card';
import MeepleAvatar from '@/components/meeples/MeepleAvatar';
import { a11yState } from '@/lib/accessibility';

// Shown above the calendar while a bot's day plan is being tweaked: approve
// what's left of the plan (with any moved times), or put it back as it was.

export default function DraftBar() {
  const router = useRouter();
  const { theme } = useThemeStore();
  const draft = useFeedStore((s) => s.draft);
  const item = useFeedStore((s) => (s.draft ? s.items.find((i) => i.id === s.draft!.itemId) : undefined));
  const busy = useFeedStore((s) => (s.draft ? s.busyIds.includes(s.draft.itemId) : false));
  const bot = useMeepleStore((s) => (item ? s.meeples.find((m) => m.id === item.meepleId) : undefined));
  const [note, setNote] = useState<string | null>(null);

  // Handled somewhere else in the meantime (another device, the feed): stop drafting.
  useEffect(() => {
    if (draft && (!item || item.status !== 'pending')) useFeedStore.getState().clearDraft();
  }, [draft, item]);

  if (!draft || !item) return null;

  const kept = item.changes.filter((c) => !draft.removed.includes(c.id));
  const edits = Object.fromEntries(Object.entries(draft.edits).filter(([id]) => !draft.removed.includes(id)));

  const approve = async () => {
    setNote(null);
    const error = await feedAction(item, 'approve', kept.map((c) => c.id), edits);
    if (error) {
      setNote(error);
      return;
    }
    useFeedStore.getState().clearDraft();
    router.navigate('/(tabs)/chat');
  };

  const cancel = () => {
    useFeedStore.getState().clearDraft();
    router.navigate('/(tabs)/chat');
  };

  return (
    <View style={[styles.wrap, { paddingHorizontal: theme.spacing.screen }]}>
      <Card radius={theme.borderRadius.lg} style={styles.card}>
        <View style={styles.row}>
          {bot && <MeepleAvatar icon={bot.icon} glow={bot.glow} size={28} />}
          <View style={styles.text}>
            <Text accessibilityRole="header" style={[styles.title, { color: theme.colors.text }]} numberOfLines={1}>
              {bot?.name ?? 'Bot'}'s plan{item.day ? ` for ${format(parseISO(item.day), 'EEE d MMM')}` : ''}
            </Text>
            <Text style={[styles.hint, { color: theme.colors.textSecondary }]}>
              Drag a block to move it, × to leave it out.
            </Text>
          </View>
        </View>
        {note && (
          <Text accessibilityLiveRegion="polite" style={[styles.hint, styles.note, { color: theme.colors.textSecondary }]}>
            {note}
          </Text>
        )}
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel tweaking"
            onPress={cancel}
            style={({ pressed }) => [styles.chip, { borderWidth: 1, borderColor: theme.colors.border }, pressed && { opacity: 0.75 }]}
          >
            <Text style={[styles.chipText, { color: theme.colors.textSecondary }]}>Cancel</Text>
          </Pressable>
          {busy ? (
            <ActivityIndicator size="small" color={theme.colors.textSecondary} />
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Approve ${kept.length} block${kept.length === 1 ? '' : 's'}`}
              {...a11yState({ disabled: kept.length === 0 })}
              disabled={kept.length === 0}
              onPress={approve}
              style={({ pressed }) => [
                styles.chip,
                { backgroundColor: kept.length ? theme.colors.primary : theme.colors.primaryLight },
                pressed && { opacity: 0.8 },
              ]}
            >
              <Text style={[styles.chipText, { color: kept.length ? theme.colors.onPrimary : theme.colors.textTertiary }]}>
                Approve {kept.length}
              </Text>
            </Pressable>
          )}
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 8 },
  card: { padding: 14, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  text: { flex: 1, gap: 2 },
  title: { fontSize: 15, fontWeight: '600' },
  hint: { fontSize: 13 },
  note: { marginTop: -2 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 8 },
  chip: { height: 34, paddingHorizontal: 14, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontSize: 14, fontWeight: '500' },
});
