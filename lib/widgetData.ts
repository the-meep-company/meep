import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { ExtensionStorage } from '@bacons/apple-targets';
import { addDays, startOfDay, endOfDay, startOfMonth, endOfMonth, format } from 'date-fns';
import type { AIPersona, CalendarEvent, Task, WidgetCalendarView } from '@/types';
import { useCalendarStore } from '@/stores/calendarStore';
import { useTaskStore } from '@/stores/taskStore';
import { useSettingsStore } from '@/stores/settingsStore';

export const WIDGET_APP_GROUP =
  process.env.EXPO_PUBLIC_WIDGET_APP_GROUP ?? 'group.com.themeepcompany.meep';
export const WIDGET_STORAGE_KEY = 'meep_widget_payload';

const FALLBACK_STORAGE_KEY = 'meep_widget_payload_fallback';

const extensionStorage = Platform.OS === 'ios' ? new ExtensionStorage(WIDGET_APP_GROUP) : null;

export type WidgetEvent = {
  id: string;
  title: string;
  startTime: string;
  color: string;
};

export type WidgetTask = {
  id: string;
  title: string;
  priority: number;
  category?: string;
};

export type WidgetPayload = {
  date: string;
  calendarView: WidgetCalendarView;
  selectedCategory: string | null;
  events: WidgetEvent[];
  weekEvents: WidgetEvent[];
  monthDots: string[];
  tasks: WidgetTask[];
  greeting: string;
};

export function generateWidgetGreeting(
  events: WidgetEvent[],
  tasks: WidgetTask[],
  companionName: string,
  persona: AIPersona
): string {
  const meetings = events.length;
  const openTasks = tasks.length;

  if (meetings >= 4) return `${companionName}: busy day, you've got this.`;
  if (meetings === 0 && openTasks <= 1) return `${companionName}: light day, great focus time.`;
  if (openTasks >= 3) return `${companionName}: top priorities are lined up.`;

  if (persona === 'playful') return `${companionName}: let's make today sparkle.`;
  if (persona === 'professional') return `${companionName}: schedule prepared, stay focused.`;
  return `${companionName}: you're on track for today.`;
}

function toWidgetEvent(event: CalendarEvent): WidgetEvent {
  return {
    id: event.id,
    title: event.title,
    startTime: new Date(event.startTime).toISOString(),
    color: event.color,
  };
}

// Today's upcoming events for daily view (max 5)
function normalizeDailyEvents(events: CalendarEvent[]): WidgetEvent[] {
  const now = new Date();
  const todayEnd = endOfDay(now);
  return events
    .filter((e) => {
      const start = new Date(e.startTime);
      return start >= now && start <= todayEnd;
    })
    .sort((a, b) => +new Date(a.startTime) - +new Date(b.startTime))
    .slice(0, 5)
    .map(toWidgetEvent);
}

// Next 7 days' events for weekly view (max 21)
function normalizeWeekEvents(events: CalendarEvent[]): WidgetEvent[] {
  const now = new Date();
  const weekEnd = endOfDay(addDays(now, 6));
  return events
    .filter((e) => {
      const start = new Date(e.startTime);
      return start >= startOfDay(now) && start <= weekEnd;
    })
    .sort((a, b) => +new Date(a.startTime) - +new Date(b.startTime))
    .slice(0, 21)
    .map(toWidgetEvent);
}

// Dates in the current month that have at least one event (YYYY-MM-DD strings)
function normalizeMonthDots(events: CalendarEvent[]): string[] {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const dates = new Set<string>();
  for (const event of events) {
    const start = new Date(event.startTime);
    if (start >= monthStart && start <= monthEnd) {
      dates.add(format(start, 'yyyy-MM-dd'));
    }
  }
  return Array.from(dates).sort();
}

function normalizeTasks(tasks: Task[], category: string | null): WidgetTask[] {
  return tasks
    .filter((task) => {
      if (task.parentTaskId || task.status === 'done') return false;
      if (category !== null && task.category !== category) return false;
      return true;
    })
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 3)
    .map((task) => ({
      id: task.id,
      title: task.title,
      priority: task.priority,
      category: task.category,
    }));
}

export function buildWidgetPayload(): WidgetPayload {
  const allEvents = useCalendarStore.getState().events;
  const allTasks = useTaskStore.getState().tasks;
  const { companionName, aiPersona, widgetCalendarView, widgetCategory } =
    useSettingsStore.getState();

  const events = normalizeDailyEvents(allEvents);
  const weekEvents = normalizeWeekEvents(allEvents);
  const monthDots = normalizeMonthDots(allEvents);
  const tasks = normalizeTasks(allTasks, widgetCategory);

  return {
    date: new Date().toISOString(),
    calendarView: widgetCalendarView,
    selectedCategory: widgetCategory,
    events,
    weekEvents,
    monthDots,
    tasks,
    greeting: generateWidgetGreeting(events, tasks, companionName, aiPersona),
  };
}

export async function writeWidgetPayload(payload = buildWidgetPayload()): Promise<void> {
  const serialized = JSON.stringify(payload);

  if (extensionStorage) {
    try {
      // Stored as a JSON string; the widget decodes it in targets/widget/WidgetData.swift.
      extensionStorage.set(WIDGET_STORAGE_KEY, serialized);
      ExtensionStorage.reloadWidget();
      return;
    } catch (err) {
      console.warn('[widgetData] Shared group write failed, using AsyncStorage fallback.', err);
    }
  }

  await AsyncStorage.setItem(FALLBACK_STORAGE_KEY, serialized);
}

export async function readWidgetPayload(): Promise<WidgetPayload | null> {
  if (extensionStorage) {
    try {
      const value = extensionStorage.get(WIDGET_STORAGE_KEY);
      if (value) return JSON.parse(value) as WidgetPayload;
    } catch (err) {
      console.warn('[widgetData] Shared group read failed, using AsyncStorage fallback.', err);
    }
  }

  const value = await AsyncStorage.getItem(FALLBACK_STORAGE_KEY);
  return value ? (JSON.parse(value) as WidgetPayload) : null;
}
