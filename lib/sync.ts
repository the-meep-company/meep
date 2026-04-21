import { supabase } from './supabase';
import { addToQueue, flushQueue } from './syncQueue';
import type { CalendarEvent, Task, Habit, Goal } from '@/types';

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
  created_at: string;
  updated_at: string;
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
    created_at: new Date(event.createdAt).toISOString(),
    updated_at: new Date(event.updatedAt).toISOString(),
  };
}

function fromDbEvent(row: DbEvent): CalendarEvent {
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

function fromDbTask(row: DbTask): Task {
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

// ===== Merge helper =====

/** Safely extract a timestamp from a Date object or ISO string */
function toTime(value: Date | string | undefined | null): number {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  // Handle ISO string (from persisted stores or Supabase)
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

function mergeById<T extends { id: string; updatedAt?: Date | string; createdAt: Date | string }>(
  local: T[],
  remote: T[],
): T[] {
  const map = new Map<string, T>();

  // Add all remote items
  for (const item of remote) {
    map.set(item.id, item);
  }

  // Merge local items — last-write-wins via updatedAt
  for (const item of local) {
    const existing = map.get(item.id);
    if (!existing) {
      map.set(item.id, item);
    } else {
      const localTime = toTime(item.updatedAt ?? item.createdAt);
      const remoteTime = toTime(existing.updatedAt ?? existing.createdAt);
      if (localTime > remoteTime) {
        map.set(item.id, item);
      }
    }
  }

  return Array.from(map.values());
}

// ===== Full sync (on login) =====

export async function syncAll(userId: string): Promise<{
  events: CalendarEvent[];
  tasks: Task[];
  habits: Habit[];
  goals: Goal[];
  settings: SyncedSettings | null;
}> {
  // Flush any queued offline writes first
  await flushQueue();

  // Pull remote data in parallel
  const [remoteEvents, remoteTasks, remoteHabits, remoteGoals, remoteSettings] = await Promise.all([
    pullEvents(userId),
    pullTasks(userId),
    pullHabits(userId),
    pullGoals(userId),
    pullSettings(userId),
  ]);

  // Lazy imports to avoid circular dependencies
  const { useCalendarStore } = require('@/stores/calendarStore');
  const { useTaskStore } = require('@/stores/taskStore');
  const { useHabitStore } = require('@/stores/habitStore');
  const { useGoalStore } = require('@/stores/goalStore');

  // Get local data
  const localEvents = useCalendarStore.getState().events;
  const localTasks = useTaskStore.getState().tasks;
  const localHabits = useHabitStore.getState().habits;
  const localGoals = useGoalStore.getState().goals;

  // Merge
  const mergedEvents = mergeById(localEvents, remoteEvents);
  const mergedTasks = mergeById(localTasks, remoteTasks);
  const mergedHabits = mergeById(localHabits, remoteHabits);
  const mergedGoals = mergeById(localGoals, remoteGoals);

  // Push any local-only items to remote
  const localOnlyEvents = mergedEvents.filter(
    (e) => !remoteEvents.find((r) => r.id === e.id)
  );
  const localOnlyTasks = mergedTasks.filter(
    (t) => !remoteTasks.find((r) => r.id === t.id)
  );
  const localOnlyHabits = mergedHabits.filter(
    (h) => !remoteHabits.find((r) => r.id === h.id)
  );
  const localOnlyGoals = mergedGoals.filter(
    (g) => !remoteGoals.find((r) => r.id === g.id)
  );

  // Push local-only items to remote (fire-and-forget)
  const pushPromises: Promise<void>[] = [];
  for (const e of localOnlyEvents) pushPromises.push(pushEvent(e, userId));
  for (const t of localOnlyTasks) pushPromises.push(pushTask(t, userId));
  for (const h of localOnlyHabits) pushPromises.push(pushHabit(h, userId));
  for (const g of localOnlyGoals) pushPromises.push(pushGoal(g, userId));
  await Promise.allSettled(pushPromises);

  return {
    events: mergedEvents,
    tasks: mergedTasks,
    habits: mergedHabits,
    goals: mergedGoals,
    settings: remoteSettings,
  };
}
