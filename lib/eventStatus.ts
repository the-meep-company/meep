import { endOfDay } from 'date-fns';
import { useCalendarStore } from '@/stores/calendarStore';
import type { CalendarEvent, EventStatus } from '@/types';

// Checking blocks off: done, skipped, or running over. Each goes through the
// normal event write path; the server turns skips and overruns into bot
// events (block.skipped / block.overran) for any bot listening, such as Drift.

const STEP_MS = 15 * 60000;

/** Done and Running over only make sense once a block has started. */
export const hasStarted = (event: CalendarEvent, now = new Date()) =>
  !event.allDay && new Date(event.startTime).getTime() <= now.getTime();

/** A block can be skipped once it's started, or ahead of time later today. */
export const canSkip = (event: CalendarEvent, now = new Date()) =>
  !event.allDay && new Date(event.startTime).getTime() <= endOfDay(now).getTime();

/** Still under way, or ended within the last hour and not checked off. */
export const canRunOver = (event: CalendarEvent, now = new Date()) =>
  hasStarted(event, now) &&
  (event.status ?? 'planned') === 'planned' &&
  new Date(event.endTime).getTime() > now.getTime() - 60 * 60000;

/** Running over gives a block another 15 minutes past now (or its end, if later), on the quarter hour. */
export function runningOverEnd(event: CalendarEvent, now = new Date()): Date {
  const from = Math.max(new Date(event.endTime).getTime(), now.getTime());
  return new Date(Math.ceil(from / STEP_MS) * STEP_MS + STEP_MS);
}

export function setEventStatus(event: CalendarEvent, status: EventStatus) {
  useCalendarStore.getState().updateEvent(event.id, { status });
}

export function markRunningOver(event: CalendarEvent, now = new Date()) {
  useCalendarStore.getState().updateEvent(event.id, { endTime: runningOverEnd(event, now) });
}
