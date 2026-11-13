import { supabase } from './supabase';
import { useFeedStore } from '@/stores/feedStore';
import { useMeepleStore, type MeepleDraft } from '@/stores/meepleStore';
import type { BotScope, BotTrigger, BotTrust, FeedItem, Meeple } from '@/types';

// Bots are meeples that run on a schedule or when something happens. The
// server runs them (supabase/functions/run-bot); this file is the app's side:
// starter bots, the schedule / trigger / trust vocabulary, and feed actions.

export type StarterKey = 'deadline' | 'morning';

/** Shipped with the app; created for every user on first sign-in, all on "Ask me". */
export const STARTER_BOTS: Record<StarterKey, MeepleDraft & { kind: Meeple['kind'] }> = {
  deadline: {
    name: 'Deadline bot',
    role: 'Books focus time before deadlines',
    instructions:
      "When a task gets a due date, work back from it and book focus blocks in my free time so it's done before the deadline. If the task has no estimate, assume about two hours. Keep each block to 90 minutes or less, one per day, and leave days that are already full alone.",
    icon: 'flag-checkered',
    glow: 'apricot',
    webSearch: false,
    scheduleAccess: true,
    kind: 'triggered',
    trigger: 'task.deadline_changed',
    trust: 'ask',
    scope: ['read_calendar', 'read_tasks', 'propose_blocks', 'write_blocks'],
    enabled: true,
    pushEnabled: false,
    template: 'deadline',
  },
  morning: {
    name: 'Morning bot',
    role: "Drafts your day's blocks each morning",
    instructions:
      "Each morning, look at today's events and my open tasks and draft the day: put the most pressing tasks into today's free time as blocks, biggest-brain work earlier, with breaks between them. Don't pack every gap, and leave anything with guests alone. Send me the whole day as one plan.",
    icon: 'sun-o',
    glow: 'sky',
    webSearch: false,
    scheduleAccess: true,
    kind: 'scheduled',
    schedule: '30 7 * * *',
    trust: 'ask',
    scope: ['read_calendar', 'read_tasks', 'propose_blocks', 'write_blocks'],
    enabled: true,
    pushEnabled: false,
    template: 'morning',
  },
};

export const starterBotId = (key: StarterKey, userId: string) => `bot_${key}_${userId}`;

export const TRUST_OPTIONS: { value: BotTrust; label: string; description: string }[] = [
  { value: 'ask', label: 'Ask me', description: 'Suggests changes; nothing moves until you approve.' },
  { value: 'ask_big', label: 'Ask if big', description: 'Nudges blocks under 2 hours within the same day on its own; asks about anything bigger.' },
  { value: 'auto', label: 'Just do it', description: 'Makes changes and tells you what it did. Everything can be undone.' },
];

// block.skipped and block.overran exist server-side; they're offered here once
// the app can mark blocks done/skipped and bot-tick watches for overruns.
export const TRIGGER_OPTIONS: { value: BotTrigger; label: string }[] = [
  { value: 'task.deadline_changed', label: 'A task gets a due date' },
  { value: 'task.created', label: 'I add a task' },
  { value: 'calendar.event_added', label: 'A new event lands on my calendar' },
];

/** Bots that can change the calendar get both scopes; trust decides what's applied. */
export const CHANGE_SCOPE: BotScope[] = ['read_calendar', 'read_tasks', 'propose_blocks', 'write_blocks'];
export const READ_ONLY_SCOPE: BotScope[] = ['read_calendar', 'read_tasks'];
export const canChangeCalendar = (scope: BotScope[]) => scope.includes('propose_blocks') || scope.includes('write_blocks');

// ===== Schedules: the presets the app offers, as cron on the user's clock =====

export type SchedulePreset = 'daily' | 'weekdays' | 'weekly';
export interface ScheduleSpec {
  preset: SchedulePreset;
  hour: number;
  minute: number;
  /** 0 = Sunday, for weekly. */
  weekday: number;
}

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function toCron(spec: ScheduleSpec): string {
  const days = spec.preset === 'daily' ? '*' : spec.preset === 'weekdays' ? '1-5' : String(spec.weekday);
  return `${spec.minute} ${spec.hour} * * ${days}`;
}

/** The preset a cron string came from, or null if it's something hand-written. */
export function fromCron(cron?: string): ScheduleSpec | null {
  const m = cron?.trim().match(/^(\d{1,2}) (\d{1,2}) \* \* (\*|1-5|[0-6])$/);
  if (!m) return null;
  const [, minute, hour, days] = m;
  const preset: SchedulePreset = days === '*' ? 'daily' : days === '1-5' ? 'weekdays' : 'weekly';
  return { preset, hour: Number(hour), minute: Number(minute), weekday: preset === 'weekly' ? Number(days) : 0 };
}

export const formatTime = (hour: number, minute: number) => {
  const h = hour % 12 || 12;
  return `${h}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'am' : 'pm'}`;
};

/** "Every weekday at 7:30 am", "When a task gets a due date". */
export function describeWhen(m: Pick<Meeple, 'kind' | 'schedule' | 'trigger'>): string {
  if (m.kind === 'triggered') {
    const t = TRIGGER_OPTIONS.find((o) => o.value === m.trigger);
    return t ? `When ${t.label.charAt(0).toLowerCase()}${t.label.slice(1)}` : 'When something happens';
  }
  if (m.kind === 'scheduled') {
    const spec = fromCron(m.schedule);
    if (!spec) return `On a schedule (${m.schedule})`;
    const time = formatTime(spec.hour, spec.minute);
    if (spec.preset === 'daily') return `Every day at ${time}`;
    if (spec.preset === 'weekdays') return `Weekdays at ${time}`;
    return `${WEEKDAYS[spec.weekday]}s at ${time}`;
  }
  return 'When you message it';
}

// ===== Calls to the bot functions =====

async function invoke<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    // Never reached the function (offline, or it isn't deployed).
    if (error.name === 'FunctionsFetchError') throw new Error("Couldn't reach Meep. Check your connection and try again.");
    const detail = await (error as any).context?.json?.().catch(() => null);
    throw new Error(detail?.error ?? error.message);
  }
  return data as T;
}

export interface RunResult {
  runId: string;
  status: 'done' | 'error' | 'skipped';
  reply?: string;
  replyMessageId?: string;
  feedItemIds: string[];
}

/** Runs a bot now. A dry run shows what it would do without applying anything. */
export function runBotNow(meepleId: string, mode: 'manual' | 'dry_run'): Promise<RunResult> {
  return invoke('run-bot', { meepleId, mode });
}

/** One chat turn with a bot: it can answer and leave new proposals in the feed. */
export function chatWithBot(meepleId: string, message: string): Promise<RunResult> {
  return invoke('run-bot', { meepleId, mode: 'chat', message });
}

/**
 * Saves the bot to Supabase (awaited, so the server can see it) and runs it once
 * without applying anything, so the user sees what it would do before it runs
 * on its own. Used after creating or editing a bot.
 */
export async function previewBot(id: string): Promise<void> {
  const { useAuthStore } = require('@/stores/authStore');
  const { pushMeeple } = require('./sync');
  const user = useAuthStore.getState().user as { id: string } | null;
  const meeple = useMeepleStore.getState().meeples.find((m) => m.id === id);
  if (!user || !meeple) return;
  const store = useMeepleStore.getState();
  store.setWorking(id, true);
  try {
    await pushMeeple(meeple, user.id);
    await runBotNow(id, 'dry_run');
  } catch (err) {
    console.warn('[bots] preview failed:', err);
  } finally {
    useMeepleStore.getState().setWorking(id, false);
  }
}

const NEXT_STATUS: Record<'approve' | 'dismiss' | 'undo', FeedItem['status']> = {
  approve: 'applied',
  dismiss: 'dismissed',
  undo: 'undone',
};

/**
 * Approves (optionally only some changes), dismisses or undoes a feed item.
 * Resolves to an error message to show, or null. The item's new state also
 * arrives over Realtime; the local patch just makes the tap feel instant.
 */
export async function feedAction(
  item: FeedItem,
  action: 'approve' | 'dismiss' | 'undo',
  changeIds?: string[],
  /** New times for some changes, from tweaking the plan on the day view. */
  edits?: Record<string, { start: string; end: string }>
): Promise<string | null> {
  const feed = useFeedStore.getState();
  if (feed.busyIds.includes(item.id)) return null;
  feed.setBusy(item.id, true);
  try {
    await invoke('feed-action', { itemId: item.id, action, changeIds, edits });
    feed.patchItem(item.id, { status: NEXT_STATUS[action] });
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : 'Something went wrong';
  } finally {
    useFeedStore.getState().setBusy(item.id, false);
  }
}

/** True when every change in a proposal is on its one day, so it can be tweaked on the day view. */
export function isDayPlan(item: FeedItem): boolean {
  if (item.type !== 'proposal' || !item.day) return false;
  const local = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  return item.changes.every((c) => [c.before, c.after].every((t) => !t || local(t.start) === item.day));
}

/** Creates any starter bots this user hasn't had yet. Deleted starters stay deleted. */
export async function seedStarterBots(userId: string): Promise<void> {
  const { data } = await supabase.from('user_settings').select('seeded_bots').eq('user_id', userId).maybeSingle();
  const seeded = new Set<string>(data?.seeded_bots ?? []);
  const missing = (Object.keys(STARTER_BOTS) as StarterKey[]).filter((k) => !seeded.has(k));
  if (!missing.length) return;

  const store = useMeepleStore.getState();
  for (const key of missing) {
    const id = starterBotId(key, userId);
    if (!store.meeples.some((m) => m.id === id)) store.addMeeple(STARTER_BOTS[key], id);
  }
  await supabase
    .from('user_settings')
    .upsert({ user_id: userId, seeded_bots: [...seeded, ...missing] }, { onConflict: 'user_id' });
}
