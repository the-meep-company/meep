import { useCalendarStore } from '@/stores/calendarStore';
import { useTaskStore } from '@/stores/taskStore';
import { useGoalStore } from '@/stores/goalStore';
import { useHabitStore } from '@/stores/habitStore';
import { usePatternStore } from '@/stores/patternStore';
import { useColorStore } from '@/stores/colorStore';
import { collectEventPattern, collectTaskPattern } from '@/lib/patternLearning';
import { suggestColor } from '@/lib/colors';
import type { ParsedItem, CalendarEvent, Task, Goal, Habit } from '@/types';

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).slice(2, 7);
}

export function confirmAndSaveItem(item: ParsedItem): void {
  const now = new Date();
  const prefs = useColorStore.getState().getColorPreferences();

  switch (item.type) {
    case 'event': {
      const e = item.event;
      if (!e?.title) return;
      const event: CalendarEvent = {
        id: generateId(),
        title: e.title,
        description: e.description,
        startTime: e.startTime ? new Date(e.startTime) : now,
        endTime: e.endTime ? new Date(e.endTime) : new Date(now.getTime() + 60 * 60 * 1000),
        allDay: e.allDay ?? false,
        color: e.color || suggestColor(e.title, null, prefs),
        location: e.location,
        source: 'local',
        scheduleSource: 'ai',
        createdAt: now,
        updatedAt: now,
      };
      useCalendarStore.getState().addEvent(event);
      usePatternStore.getState().recordDataPoint(collectEventPattern(event));
      break;
    }
    case 'task': {
      const t = item.task;
      if (!t?.title) return;
      const task: Task = {
        id: generateId(),
        title: t.title,
        description: t.description,
        dueDate: t.dueDate ? new Date(t.dueDate) : undefined,
        priority: t.priority ?? 3,
        category: t.category,
        color: t.color || suggestColor(t.title, t.category, prefs),
        status: 'todo',
        estimatedMinutes: t.estimatedMinutes ?? 30,
        scheduleSource: 'ai',
        createdAt: now,
        updatedAt: now,
      };
      useTaskStore.getState().addTask(task);
      const taskPattern = collectTaskPattern(task);
      if (taskPattern) usePatternStore.getState().recordDataPoint(taskPattern);
      break;
    }
    case 'goal': {
      const g = item.goal;
      if (!g?.title) return;
      const goal: Goal = {
        id: generateId(),
        title: g.title,
        description: g.description,
        targetDate: g.targetDate ? new Date(g.targetDate) : undefined,
        category: g.category,
        status: 'active',
        createdAt: now,
      };
      useGoalStore.getState().addGoal(goal);
      break;
    }
    case 'habit': {
      const h = item.habit;
      if (!h?.title) return;
      const habit: Habit = {
        id: generateId(),
        title: h.title,
        description: h.description,
        frequency: h.frequency ?? 'daily',
        customDays: h.customDays,
        startTime: h.startTime ?? '07:00',
        durationMinutes: h.durationMinutes ?? 30,
        color: h.color || suggestColor(h.title, null, prefs),
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };
      useHabitStore.getState().addHabit(habit);
      break;
    }
  }
}

export function confirmAndSaveAll(items: ParsedItem[]): void {
  items
    .filter((item) => item.status !== 'deleted')
    .forEach(confirmAndSaveItem);
}
