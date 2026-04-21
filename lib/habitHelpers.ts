import { addMinutes, format, parse } from 'date-fns';
import type { CalendarEvent, Habit } from '@/types';

function habitAppliesToDay(habit: Habit, dayOfWeek: number): boolean {
  switch (habit.frequency) {
    case 'daily':
      return true;
    case 'weekdays':
      return dayOfWeek >= 1 && dayOfWeek <= 5;
    case 'weekends':
      return dayOfWeek === 0 || dayOfWeek === 6;
    case 'custom':
      return habit.customDays?.includes(dayOfWeek) ?? false;
    default:
      return false;
  }
}

function parseHabitTime(timeStr: string, date: Date): Date {
  // Parse "HH:mm" string into a Date on the given day
  return parse(timeStr, 'HH:mm', date);
}

export function generateHabitEventsForDate(
  habits: Habit[],
  date: Date
): CalendarEvent[] {
  const dayOfWeek = date.getDay(); // 0=Sun..6=Sat
  const dateStr = format(date, 'yyyy-MM-dd');

  return habits
    .filter((h) => h.isActive && habitAppliesToDay(h, dayOfWeek))
    .map((h) => {
      const startTime = parseHabitTime(h.startTime, date);
      const endTime = addMinutes(startTime, h.durationMinutes);

      return {
        id: `habit-${h.id}-${dateStr}`,
        title: h.title,
        description: h.description,
        startTime,
        endTime,
        allDay: false,
        color: h.color,
        source: 'local' as const,
        isHabit: true,
        createdAt: h.createdAt,
        updatedAt: h.updatedAt,
      };
    });
}
