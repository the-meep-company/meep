import {
  startOfDay,
  endOfDay,
  addMinutes,
  addDays,
  differenceInCalendarDays,
  differenceInMinutes,
  setHours,
  setMinutes,
  format,
  isAfter,
  isBefore,
  isSameDay,
} from 'date-fns';
import type {
  Task,
  CalendarEvent,
  SchedulingPattern,
  ScheduleRequest,
  ScheduleResult,
  SchedulePlacement,
  FreeSlot,
} from '@/types';

// ===== Constants =====
const BUFFER_MINUTES = 15;
const MAX_FILL_RATE = 0.7;
const HARD_START_HOUR = 7; // never before 7am
const HARD_END_HOUR = 22; // never after 10pm
const DEFAULT_DURATION = 30;

// ===== Urgency Scoring =====
export function computeUrgencyScore(task: Task, now: Date): number {
  const priorityWeight = (5 - task.priority) * 4; // P1=16, P2=12, P3=8, P4=4

  let dueDateBonus = 0;
  let overduePenalty = 0;

  if (task.dueDate) {
    const dueDate = new Date(task.dueDate);
    const daysUntilDue = differenceInCalendarDays(dueDate, now);

    if (daysUntilDue <= 0) dueDateBonus = 10;
    else if (daysUntilDue <= 1) dueDateBonus = 6;
    else if (daysUntilDue <= 3) dueDateBonus = 3;
    else if (daysUntilDue <= 7) dueDateBonus = 1;

    if (daysUntilDue < 0) {
      overduePenalty = Math.min(Math.abs(daysUntilDue) * 2, 10);
    }
  }

  return priorityWeight + dueDateBonus + overduePenalty;
}

// ===== Free Slot Computation =====
export function computeFreeSlots(
  events: CalendarEvent[],
  day: Date,
  workingHours: { startHour: number; endHour: number },
  bufferMinutes: number = BUFFER_MINUTES
): FreeSlot[] {
  const dayStart = setMinutes(setHours(startOfDay(day), Math.max(workingHours.startHour, HARD_START_HOUR)), 0);
  const dayEnd = setMinutes(setHours(startOfDay(day), Math.min(workingHours.endHour, HARD_END_HOUR)), 0);

  if (!isAfter(dayEnd, dayStart)) return [];

  // Get events that overlap this day, sorted by start time
  const dayEvents = events
    .filter((e) => {
      const eStart = new Date(e.startTime);
      const eEnd = new Date(e.endTime);
      return isBefore(eStart, dayEnd) && isAfter(eEnd, dayStart);
    })
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  // Build occupied intervals with buffers
  const occupied: { start: Date; end: Date }[] = dayEvents.map((e) => ({
    start: addMinutes(new Date(e.startTime), -bufferMinutes),
    end: addMinutes(new Date(e.endTime), bufferMinutes),
  }));

  // Merge overlapping intervals
  const merged: { start: Date; end: Date }[] = [];
  for (const interval of occupied) {
    if (merged.length === 0 || isAfter(interval.start, merged[merged.length - 1].end)) {
      merged.push({ ...interval });
    } else {
      const last = merged[merged.length - 1];
      if (isAfter(interval.end, last.end)) {
        last.end = interval.end;
      }
    }
  }

  // Extract free slots between occupied intervals
  const slots: FreeSlot[] = [];
  let cursor = dayStart;

  for (const interval of merged) {
    const gapStart = isBefore(cursor, dayStart) ? dayStart : cursor;
    const gapEnd = isBefore(interval.start, dayEnd) ? interval.start : dayEnd;

    if (isAfter(gapEnd, gapStart)) {
      const duration = differenceInMinutes(gapEnd, gapStart);
      if (duration >= 15) {
        slots.push({ start: gapStart, end: gapEnd, durationMinutes: duration });
      }
    }

    cursor = isAfter(interval.end, cursor) ? interval.end : cursor;
  }

  // Final slot after last occupied interval
  const finalStart = isBefore(cursor, dayStart) ? dayStart : cursor;
  if (isAfter(dayEnd, finalStart)) {
    const duration = differenceInMinutes(dayEnd, finalStart);
    if (duration >= 15) {
      slots.push({ start: finalStart, end: dayEnd, durationMinutes: duration });
    }
  }

  return slots;
}

// ===== Main Scheduler =====
export function autoScheduleTasks(request: ScheduleRequest): ScheduleResult {
  const { tasks, existingEvents, habitEvents, patterns, dateRange, workingHours } = request;
  const now = new Date();

  // Combine all calendar events
  const allEvents = [...existingEvents, ...habitEvents];

  // Sort tasks by urgency (highest first)
  const sortedTasks = [...tasks].sort(
    (a, b) => computeUrgencyScore(b, now) - computeUrgencyScore(a, now)
  );

  // Build free slots for each day in the range
  const days: Date[] = [];
  let current = startOfDay(dateRange.start);
  const end = startOfDay(dateRange.end);
  while (!isAfter(current, end)) {
    days.push(current);
    current = addDays(current, 1);
  }

  // Track placed events to update free slots as we go
  const placedEvents: CalendarEvent[] = [];
  const placements: SchedulePlacement[] = [];
  const unplaceable: { taskId: string; task: Task; reason: string }[] = [];

  // Track fill per day
  const dayFillMinutes = new Map<string, number>();
  for (const day of days) {
    const key = format(day, 'yyyy-MM-dd');
    const existingFill = allEvents
      .filter((e) => isSameDay(new Date(e.startTime), day))
      .reduce((sum, e) => sum + differenceInMinutes(new Date(e.endTime), new Date(e.startTime)), 0);
    dayFillMinutes.set(key, existingFill);
  }

  const totalWorkingMinutesPerDay = (Math.min(workingHours.endHour, HARD_END_HOUR) - Math.max(workingHours.startHour, HARD_START_HOUR)) * 60;

  // Track last placed category for adjacency grouping
  let lastPlacedCategory: string | undefined;
  let lastPlacedDay: string | undefined;

  for (const task of sortedTasks) {
    const duration = task.estimatedMinutes ?? DEFAULT_DURATION;
    const pattern = patterns.find((p) => p.category === task.category) ?? patterns.find((p) => !p.category);

    let placed = false;

    // Try each day
    for (const day of days) {
      const dayKey = format(day, 'yyyy-MM-dd');
      const currentFill = dayFillMinutes.get(dayKey) ?? 0;
      const maxFillMinutes = totalWorkingMinutesPerDay * MAX_FILL_RATE;

      if (currentFill + duration > maxFillMinutes) continue;

      const slots = computeFreeSlots([...allEvents, ...placedEvents], day, workingHours);

      // Filter slots that can fit this task
      const viableSlots = slots.filter((s) => s.durationMinutes >= duration);
      if (viableSlots.length === 0) continue;

      // Score slots
      const scoredSlots = viableSlots.map((slot) => {
        let score = 0;
        let reason = '';
        const slotHour = slot.start.getHours() + slot.start.getMinutes() / 60;

        // Pattern match bonus
        if (pattern && pattern.sampleSize >= 3) {
          if (slotHour >= pattern.preferredTimeRange.startHour && slotHour <= pattern.preferredTimeRange.endHour) {
            score += 10;
            reason = `Matches your ${task.category ?? 'usual'} pattern`;
          }
          if (pattern.preferredDays.includes(day.getDay())) {
            score += 3;
          }
        }

        // Category adjacency bonus
        if (task.category && task.category === lastPlacedCategory && dayKey === lastPlacedDay) {
          score += 5;
          reason = reason || 'Grouped with similar tasks';
        }

        // Due date proximity: prefer earlier slots for urgent tasks
        if (task.dueDate) {
          const dueDate = new Date(task.dueDate);
          if (isSameDay(day, dueDate) || isBefore(day, dueDate)) {
            score += 2;
          }
        }

        // Earlier is generally better (tiebreaker)
        score += (24 - slotHour) / 24;

        if (!reason) {
          reason = 'Best available time slot';
        }

        return { slot, score, reason };
      });

      // Pick the best slot
      scoredSlots.sort((a, b) => b.score - a.score);
      const best = scoredSlots[0];

      const proposedStart = best.slot.start;
      const proposedEnd = addMinutes(proposedStart, duration);

      // Confidence based on pattern match and urgency
      const urgency = computeUrgencyScore(task, now);
      const maxUrgency = 36;
      let confidence = 0.5 + (best.score / 30) * 0.3 + (urgency / maxUrgency) * 0.2;
      confidence = Math.min(Math.max(confidence, 0.3), 0.95);

      placements.push({
        taskId: task.id,
        task,
        proposedStart,
        proposedEnd,
        reason: best.reason,
        confidence: Math.round(confidence * 100) / 100,
      });

      // Track the placement as an occupied event
      placedEvents.push({
        id: `sched-${task.id}`,
        title: task.title,
        startTime: proposedStart,
        endTime: proposedEnd,
        allDay: false,
        color: task.color ?? '#6C5CE7',
        source: 'local',
        scheduleSource: 'ai',
        createdAt: now,
        updatedAt: now,
      });

      dayFillMinutes.set(dayKey, (dayFillMinutes.get(dayKey) ?? 0) + duration);
      lastPlacedCategory = task.category;
      lastPlacedDay = dayKey;
      placed = true;
      break;
    }

    if (!placed) {
      unplaceable.push({
        taskId: task.id,
        task,
        reason: `No free slot of ${duration} minutes available in the scheduled range`,
      });
    }
  }

  return { placements, unplaceable };
}
