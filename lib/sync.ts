import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { addToQueue, flushQueue } from './syncQueue';
import type { CalendarEvent, Task, Habit, Goal, Meeple, MeepleMessage } from '@/types';

// ===== Type mappings (camelCase ↔ snake_case) =====

interface DbEvent {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  all_day: boolean;
  color: string;
  location: string | null;
  source: string;
  calendar_id: string | null;
  schedule_source: string | null;
  is_habit: boolean;
  google_event_id: string | null;
  google_calendar_id: string | null;
  status: string;
  category: string | null;
  task_id: string | null;
  bot_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Server-owned columns that only come down from Supabase. */
interface DbEventRead extends DbEvent {
  has_guests: boolean;
}

interface DbTask {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  priority: number;
  category: string | null;
  color: string | null;
  status: string;
  parent_task_id: string | null;
  estimated_minutes: number | null;
  carry_over_from: string | null;
  schedule_source: string | null;
  created_at: string;
  updated_at: string;
}

interface DbHabit {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  frequency: string;
  custom_days: number[] | null;
  start_time: string | null;
  duration_minutes: number;
  color: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface DbGoal {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  target_date: string | null;
  category: string | null;
  status: string;
  created_at: string;
}

interface DbSettings {
  user_id: string;
  ai_persona: string;
  timezone: string | null;
  timezone_auto_detect: boolean;
  companion_name: string;
  voice_locale: string;
  theme: string;
}

interface DbMeeple {
  id: string;
  user_id: string;
  name: string;
  role: string;
  instructions: string;
  icon: string;
  glow: string;
  web_search: boolean;
  schedule_access: boolean;
  unread: boolean;
  created_at: string;
  updated_at: string;
}

interface DbMeepleMessage {
  id: string;
  meeple_id: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  actions: MeepleMessage['actions'] | null;
  sources: MeepleMessage['sources'] | null;
  action_statuses: MeepleMessage['actionStatuses'] | null;
  created_at: string;
}

export interface SyncedSettings {
  aiPersona: string;
  timezone: string | null;
  timezoneAutoDetect: boolean;
  companionName: string;
  voiceLocale: string;
  theme: string;
}

// ===== Converters =====

function toDbEvent(event: CalendarEvent, userId: string): DbEvent {
  return {
    id: event.id,
    user_id: userId,
    title: event.title,
    description: event.description ?? null,
    start_time: new Date(event.startTime).toISOString(),
    end_time: new Date(event.endTime).toISOString(),
    all_day: event.allDay,
    color: event.color,
    location: event.location ?? null,
    source: event.source,
    calendar_id: event.calendarId ?? null,
    schedule_source: event.scheduleSource ?? null,
    is_habit: event.isHabit ?? false,
    google_event_id: event.googleEventId ?? null,
    google_calendar_id: event.googleCalendarId ?? null,
    status: event.status ?? 'planned',
    category: event.category ?? null,
    task_id: event.taskId ?? null,
    bot_id: event.botId ?? null,
    created_at: new Date(event.createdAt).toISOString(),
    updated_at: new Date(event.updatedAt).toISOString(),
  };
}

export function fromDbEvent(row: DbEventRead): CalendarEvent {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    startTime: new Date(row.start_time),
    endTime: new Date(row.end_time),
    allDay: row.all_day,
    color: row.color,
    location: row.location ?? undefined,
    source: row.source as CalendarEvent['source'],
    calendarId: row.calendar_id ?? undefined,
    scheduleSource: row.schedule_source as CalendarEvent['scheduleSource'],
    isHabit: row.is_habit,
    googleEventId: row.google_event_id ?? undefined,
    googleCalendarId: row.google_calendar_id ?? undefined,
    hasGuests: row.has_guests,
    status: row.status as CalendarEvent['status'],
    category: row.category ?? undefined,
    taskId: row.task_id ?? undefined,
    botId: row.bot_id ?? undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function toDbTask(task: Task, userId: string): DbTask {
  return {
    id: task.id,
    user_id: userId,
    title: task.title,
    description: task.description ?? null,
    due_date: task.dueDate ? new Date(task.dueDate).toISOString() : null,
    scheduled_start: task.scheduledStart ? new Date(task.scheduledStart).toISOString() : null,
    scheduled_end: task.scheduledEnd ? new Date(task.scheduledEnd).toISOString() : null,
    priority: task.priority,
    category: task.category ?? null,
    color: task.color ?? null,
    status: task.status,
    parent_task_id: task.parentTaskId ?? null,
    estimated_minutes: task.estimatedMinutes ?? null,
    carry_over_from: task.carryOverFrom ?? null,
    schedule_source: task.scheduleSource ?? null,
    created_at: new Date(task.createdAt).toISOString(),
    updated_at: new Date(task.updatedAt).toISOString(),
  };
}

export function fromDbTask(row: DbTask): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    dueDate: row.due_date ? new Date(row.due_date) : undefined,
    scheduledStart: row.scheduled_start ? new Date(row.scheduled_start) : undefined,
    scheduledEnd: row.scheduled_end ? new Date(row.scheduled_end) : undefined,
    priority: row.priority as Task['priority'],
    category: row.category ?? undefined,
    color: row.color ?? undefined,
    status: row.status as Task['status'],
    parentTaskId: row.parent_task_id ?? undefined,
    estimatedMinutes: row.estimated_minutes ?? undefined,
    carryOverFrom: row.carry_over_from ?? undefined,
    scheduleSource: row.schedule_source as Task['scheduleSource'],
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function toDbHabit(habit: Habit, userId: string): DbHabit {
  return {
    id: habit.id,
    user_id: userId,
    title: habit.title,
    description: habit.description ?? null,
    frequency: habit.frequency,
    custom_days: habit.customDays ?? null,
    start_time: habit.startTime ?? null,
    duration_minutes: habit.durationMinutes,
    color: habit.color,
    is_active: habit.isActive,
    created_at: new Date(habit.createdAt).toISOString(),
    updated_at: new Date(habit.updatedAt).toISOString(),
  };
}

function fromDbHabit(row: DbHabit): Habit {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    frequency: row.frequency as Habit['frequency'],
    customDays: row.custom_days ?? undefined,
    startTime: row.start_time ?? '07:00',
    durationMinutes: row.duration_minutes,
    color: row.color,
    isActive: row.is_active,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function toDbGoal(goal: Goal, userId: string): DbGoal {
  return {
    id: goal.id,
    user_id: userId,
    title: goal.title,
    description: goal.description ?? null,
    target_date: goal.targetDate ? new Date(goal.targetDate).toISOString() : null,
    category: goal.category ?? null,
    status: goal.status,
    created_at: new Date(goal.createdAt).toISOString(),
  };
}

function fromDbGoal(row: DbGoal): Goal {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    targetDate: row.target_date ? new Date(row.target_date) : undefined,
    category: row.category ?? undefined,
    status: row.status as Goal['status'],
    createdAt: new Date(row.created_at),
  };
}

function toDbMeeple(meeple: Meeple, userId: string): DbMeeple {
  return {
    id: meeple.id,
    user_id: userId,
    name: meeple.name,
    role: meeple.role,
    instructions: meeple.instructions,
    icon: meeple.icon,
    glow: meeple.glow,
    web_search: meeple.webSearch,
    schedule_access: meeple.scheduleAccess,
    unread: meeple.unread,
    created_at: new Date(meeple.createdAt).toISOString(),
    updated_at: new Date(meeple.updatedAt).toISOString(),
  };
}

export function fromDbMeeple(row: DbMeeple): Omit<Meeple, 'messages'> {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    instructions: row.instructions,
    icon: row.icon,
    glow: row.glow as Meeple['glow'],
    webSearch: row.web_search,
    scheduleAccess: row.schedule_access,
    unread: row.unread,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function toDbMeepleMessage(msg: MeepleMessage, meepleId: string, userId: string): DbMeepleMessage {
  return {
    id: msg.id,
    meeple_id: meepleId,
    user_id: userId,
    role: msg.role,
    content: msg.content,
    actions: msg.actions ?? null,
    sources: msg.sources ?? null,
    action_statuses: msg.actionStatuses ?? null,
    created_at: new Date(msg.timestamp).toISOString(),
  };
}

export function fromDbMeepleMessage(row: DbMeepleMessage): MeepleMessage & { meepleId: string } {
  return {
    id: row.id,
    meepleId: row.meeple_id,
    role: row.role,
    content: row.content,
    actions: row.actions ?? undefined,
    sources: row.sources ?? undefined,
    actionStatuses: row.action_statuses ?? undefined,
    timestamp: new Date(row.created_at),
  };
}

// ===== Pull functions =====

async function pullEvents(userId: string): Promise<CalendarEvent[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('user_id', userId);
  if (error) throw error;
  return (data || []).map(fromDbEvent);
}

async function pullTasks(userId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId);
  if (error) throw error;
  return (data || []).map(fromDbTask);
}

async function pullHabits(userId: string): Promise<Habit[]> {
  const { data, error } = await supabase
    .from('habits')
    .select('*')
    .eq('user_id', userId);
  if (error) throw error;
  return (data || []).map(fromDbHabit);
}

async function pullGoals(userId: string): Promise<Goal[]> {
  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .eq('user_id', userId);
  if (error) throw error;
  return (data || []).map(fromDbGoal);
}

/** Meeples with their threads (oldest message first, last 200 per meeple). */
async function pullMeeples(userId: string): Promise<Meeple[]> {
  const [{ data: rows, error }, { data: msgs, error: msgError }] = await Promise.all([
    supabase.from('meeples').select('*').eq('user_id', userId),
    supabase.from('meeple_messages').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
  ]);
  if (error) throw error;
  if (msgError) throw msgError;
  const byMeeple = new Map<string, MeepleMessage[]>();
  for (const m of (msgs || []).map(fromDbMeepleMessage)) {
    const { meepleId, ...msg } = m;
    byMeeple.set(meepleId, [...(byMeeple.get(meepleId) ?? []), msg]);
  }
  return (rows || []).map((r) => ({
    ...fromDbMeeple(r as DbMeeple),
    messages: (byMeeple.get(r.id) ?? []).slice(-200),
  }));
}

async function pullSettings(userId: string): Promise<SyncedSettings | null> {
  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (error || !data) return null;
  const row = data as DbSettings;
  return {
    aiPersona: row.ai_persona,
    timezone: row.timezone,
    timezoneAutoDetect: row.timezone_auto_detect,
    companionName: row.companion_name,
    voiceLocale: row.voice_locale,
    theme: row.theme,
  };
}

// ===== Push functions =====

export async function pushEvent(event: CalendarEvent, userId: string): Promise<void> {
  const row = toDbEvent(event, userId);
  const { error } = await supabase.from('events').upsert(row);
  if (error) {
    await addToQueue({ type: 'upsert', table: 'events', data: row });
    throw error;
  }
}

/**
 * Events that live in Google go through the event-write function, which writes
 * to Google first so the edit isn't overwritten by the next sync. If Google
 * refuses, the local copy is put back to the server's version.
 */
export async function writeGoogleEvent(event: CalendarEvent, userId: string): Promise<void> {
  const { error } = await supabase.functions.invoke('event-write', {
    body: { op: 'upsert', row: toDbEvent(event, userId) },
  });
  if (error) {
    await restoreEvent(event.id);
    throw error;
  }
}

export async function deleteGoogleEvent(event: CalendarEvent): Promise<void> {
  const { error } = await supabase.functions.invoke('event-write', { body: { op: 'delete', id: event.id } });
  if (error) {
    await restoreEvent(event.id, event);
    throw error;
  }
}

/** Puts one event back to its server state (or `fallback` if the fetch fails). */
async function restoreEvent(id: string, fallback?: CalendarEvent): Promise<void> {
  const { useCalendarStore } = require('@/stores/calendarStore');
  const { data } = await supabase.from('events').select('*').eq('id', id).maybeSingle();
  const server = data ? fromDbEvent(data as DbEventRead) : fallback;
  if (server) useCalendarStore.getState().batchUpsertEvents([server]);
}

export async function pushTask(task: Task, userId: string): Promise<void> {
  const row = toDbTask(task, userId);
  const { error } = await supabase.from('tasks').upsert(row);
  if (error) {
    await addToQueue({ type: 'upsert', table: 'tasks', data: row });
    throw error;
  }
}

export async function pushHabit(habit: Habit, userId: string): Promise<void> {
  const row = toDbHabit(habit, userId);
  const { error } = await supabase.from('habits').upsert(row);
  if (error) {
    await addToQueue({ type: 'upsert', table: 'habits', data: row });
    throw error;
  }
}

export async function pushGoal(goal: Goal, userId: string): Promise<void> {
  const row = toDbGoal(goal, userId);
  const { error } = await supabase.from('goals').upsert(row);
  if (error) {
    await addToQueue({ type: 'upsert', table: 'goals', data: row });
    throw error;
  }
}

export async function pushSettings(userId: string, settings: {
  aiPersona: string;
  timezone: string;
  timezoneAutoDetect: boolean;
  companionName: string;
  voiceLocale: string;
  theme: string;
}): Promise<void> {
  const row: DbSettings = {
    user_id: userId,
    ai_persona: settings.aiPersona,
    timezone: settings.timezone,
    timezone_auto_detect: settings.timezoneAutoDetect,
    companion_name: settings.companionName,
    voice_locale: settings.voiceLocale,
    theme: settings.theme,
  };
  const { error } = await supabase.from('user_settings').upsert(row);
  if (error) {
    await addToQueue({ type: 'upsert', table: 'user_settings', data: row });
  }
}

export async function pushMeeple(meeple: Meeple, userId: string): Promise<void> {
  const row = toDbMeeple(meeple, userId);
  const { error } = await supabase.from('meeples').upsert(row);
  if (error) {
    await addToQueue({ type: 'upsert', table: 'meeples', data: row });
    throw error;
  }
}

export async function pushMeepleMessage(msg: MeepleMessage, meepleId: string, userId: string): Promise<void> {
  const row = toDbMeepleMessage(msg, meepleId, userId);
  const { error } = await supabase.from('meeple_messages').upsert(row);
  if (error) {
    await addToQueue({ type: 'upsert', table: 'meeple_messages', data: row });
    throw error;
  }
}

// ===== Delete functions =====

export async function deleteRemoteEvent(id: string): Promise<void> {
  const { error } = await supabase.from('events').delete().eq('id', id);
  if (error) {
    await addToQueue({ type: 'delete', table: 'events', data: { id } });
  }
}

export async function deleteRemoteTask(id: string): Promise<void> {
  const { error } = await supabase.from('tasks').delete().eq('id', id);
  if (error) {
    await addToQueue({ type: 'delete', table: 'tasks', data: { id } });
  }
}

export async function deleteRemoteHabit(id: string): Promise<void> {
  const { error } = await supabase.from('habits').delete().eq('id', id);
  if (error) {
    await addToQueue({ type: 'delete', table: 'habits', data: { id } });
  }
}

export async function deleteRemoteGoal(id: string): Promise<void> {
  const { error } = await supabase.from('goals').delete().eq('id', id);
  if (error) {
    await addToQueue({ type: 'delete', table: 'goals', data: { id } });
  }
}

export async function deleteRemoteMeeple(id: string): Promise<void> {
  // Messages go with it (on delete cascade).
  const { error } = await supabase.from('meeples').delete().eq('id', id);
  if (error) {
    await addToQueue({ type: 'delete', table: 'meeples', data: { id } });
  }
}

export async function clearRemoteThread(meepleId: string): Promise<void> {
  await supabase.from('meeple_messages').delete().eq('meeple_id', meepleId);
}

// ===== Merge =====
//
// Supabase is the source of truth: bots and gcal-sync change rows while the app
// is closed. After queued offline writes are flushed, the server wins. A row that
// exists only on this device is kept (and pushed) when it was created since the
// last successful pull, or on the first pull ever (moving existing local data
// up); otherwise it was deleted elsewhere and is dropped. Google events only ever
// come from the server, so a local-only Google event is always dropped.

const LAST_PULL_KEY = 'meep-last-pull';

function toTime(value: Date | string | undefined | null): number {
  if (!value) return 0;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

function serverWins<T extends { id: string; createdAt: Date | string }>(
  local: T[],
  remote: T[],
  lastPull: number | null,
  keepLocal: (item: T) => boolean = () => true,
): { merged: T[]; localOnly: T[] } {
  const remoteIds = new Set(remote.map((r) => r.id));
  const localOnly = local.filter(
    (item) =>
      !remoteIds.has(item.id) &&
      keepLocal(item) &&
      (lastPull === null || toTime(item.createdAt) > lastPull),
  );
  return { merged: [...remote, ...localOnly], localOnly };
}

// ===== Full sync (on login and whenever the app comes to the foreground) =====

export async function syncAll(userId: string): Promise<{
  events: CalendarEvent[];
  tasks: Task[];
  habits: Habit[];
  goals: Goal[];
  meeples: Meeple[];
  settings: SyncedSettings | null;
}> {
  // Flush any queued offline writes first
  await flushQueue();

  const pullStartedAt = Date.now();
  const lastPullRaw = await AsyncStorage.getItem(`${LAST_PULL_KEY}:${userId}`);
  const lastPull = lastPullRaw ? Number(lastPullRaw) : null;

  // Pull remote data in parallel
  const [remoteEvents, remoteTasks, remoteHabits, remoteGoals, remoteMeeples, remoteSettings] = await Promise.all([
    pullEvents(userId),
    pullTasks(userId),
    pullHabits(userId),
    pullGoals(userId),
    pullMeeples(userId),
    pullSettings(userId),
  ]);

  // Lazy imports to avoid circular dependencies
  const { useCalendarStore } = require('@/stores/calendarStore');
  const { useTaskStore } = require('@/stores/taskStore');
  const { useHabitStore } = require('@/stores/habitStore');
  const { useGoalStore } = require('@/stores/goalStore');
  const { useMeepleStore } = require('@/stores/meepleStore');

  const events = serverWins<CalendarEvent>(
    useCalendarStore.getState().events,
    remoteEvents,
    lastPull,
    (e) => e.source !== 'google',
  );
  const tasks = serverWins<Task>(useTaskStore.getState().tasks, remoteTasks, lastPull);
  const habits = serverWins<Habit>(useHabitStore.getState().habits, remoteHabits, lastPull);
  const goals = serverWins<Goal>(useGoalStore.getState().goals, remoteGoals, lastPull);
  const meeples = serverWins<Meeple>(useMeepleStore.getState().meeples, remoteMeeples, lastPull);

  const pushes: Promise<void>[] = [];
  for (const e of events.localOnly) pushes.push(pushEvent(e, userId));
  for (const t of tasks.localOnly) pushes.push(pushTask(t, userId));
  for (const h of habits.localOnly) pushes.push(pushHabit(h, userId));
  for (const g of goals.localOnly) pushes.push(pushGoal(g, userId));
  for (const m of meeples.localOnly) {
    pushes.push(
      pushMeeple(m, userId).then(async () => {
        for (const msg of m.messages) await pushMeepleMessage(msg, m.id, userId);
      }),
    );
  }
  const results = await Promise.allSettled(pushes);

  // Only advance the watermark when every local-only row made it up; failed
  // ones are in the offline queue and must not be dropped on the next pull.
  if (results.every((r) => r.status === 'fulfilled')) {
    await AsyncStorage.setItem(`${LAST_PULL_KEY}:${userId}`, String(pullStartedAt));
  }

  return {
    events: events.merged,
    tasks: tasks.merged,
    habits: habits.merged,
    goals: goals.merged,
    meeples: meeples.merged,
    settings: remoteSettings,
  };
}
