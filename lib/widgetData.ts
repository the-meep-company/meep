import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import SharedGroupPreferences from 'react-native-shared-group-preferences';
import type { AIPersona, CalendarEvent, Task } from '@/types';
import { useCalendarStore } from '@/stores/calendarStore';
import { useTaskStore } from '@/stores/taskStore';
import { useSettingsStore } from '@/stores/settingsStore';

export const WIDGET_APP_GROUP =
  process.env.EXPO_PUBLIC_WIDGET_APP_GROUP ?? 'group.com.themeepcompany.meep';
export const WIDGET_STORAGE_KEY = 'meep_widget_payload';

const FALLBACK_STORAGE_KEY = 'meep_widget_payload_fallback';

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
};

export type WidgetPayload = {
  date: string;
  events: WidgetEvent[];
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

function normalizeEvents(events: CalendarEvent[]): WidgetEvent[] {
  const now = new Date();
  return events
    .map((event) => ({
      id: event.id,
      title: event.title,
      startTime: new Date(event.startTime).toISOString(),
      color: event.color,
    }))
    .filter((event) => new Date(event.startTime) >= now)
    .sort((a, b) => +new Date(a.startTime) - +new Date(b.startTime))
    .slice(0, 3);
}

function normalizeTasks(tasks: Task[]): WidgetTask[] {
  return tasks
    .filter((task) => !task.parentTaskId && task.status !== 'done')
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 3)
    .map((task) => ({
      id: task.id,
      title: task.title,
      priority: task.priority,
    }));
}

export function buildWidgetPayload(): WidgetPayload {
  const events = normalizeEvents(useCalendarStore.getState().events);
  const tasks = normalizeTasks(useTaskStore.getState().tasks);
  const { companionName, aiPersona } = useSettingsStore.getState();

  return {
    date: new Date().toISOString(),
    events,
    tasks,
    greeting: generateWidgetGreeting(events, tasks, companionName, aiPersona),
  };
}

export async function writeWidgetPayload(payload = buildWidgetPayload()): Promise<void> {
  const serialized = JSON.stringify(payload);

  if (Platform.OS === 'ios') {
    try {
      await SharedGroupPreferences.setItem(WIDGET_STORAGE_KEY, payload, WIDGET_APP_GROUP);
      return;
    } catch (err) {
      console.warn('[widgetData] Shared group write failed, using AsyncStorage fallback.', err);
    }
  }

  await AsyncStorage.setItem(FALLBACK_STORAGE_KEY, serialized);
}

export async function readWidgetPayload(): Promise<WidgetPayload | null> {
  if (Platform.OS === 'ios') {
    try {
      const result = await SharedGroupPreferences.getItem(WIDGET_STORAGE_KEY, WIDGET_APP_GROUP);
      if (result) return result as WidgetPayload;
    } catch (err) {
      console.warn('[widgetData] Shared group read failed, using AsyncStorage fallback.', err);
    }
  }

  const value = await AsyncStorage.getItem(FALLBACK_STORAGE_KEY);
  return value ? (JSON.parse(value) as WidgetPayload) : null;
}
