import type { CalendarEvent, Task, PatternDataPoint } from '@/types';

type PatternFields = Omit<PatternDataPoint, 'id' | 'recordedAt'>;

export function collectEventPattern(event: CalendarEvent): PatternFields {
  const start = new Date(event.startTime);
  const end = new Date(event.endTime);
  const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);

  return {
    category: undefined, // events don't have a category field
    dayOfWeek: start.getDay(),
    startHour: start.getHours() + start.getMinutes() / 60,
    endHour: end.getHours() + end.getMinutes() / 60,
    durationMinutes,
    wasAiSuggested: event.scheduleSource === 'ai',
    wasModified: false,
  };
}

export function collectTaskPattern(task: Task): PatternFields | null {
  if (!task.scheduledStart || !task.scheduledEnd) return null;

  const start = new Date(task.scheduledStart);
  const end = new Date(task.scheduledEnd);
  const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);

  return {
    category: task.category,
    dayOfWeek: start.getDay(),
    startHour: start.getHours() + start.getMinutes() / 60,
    endHour: end.getHours() + end.getMinutes() / 60,
    durationMinutes,
    wasAiSuggested: task.scheduleSource === 'ai',
    wasModified: false,
  };
}
