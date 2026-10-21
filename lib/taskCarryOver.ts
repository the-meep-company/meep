import { startOfDay, isBefore } from 'date-fns';
import type { Task } from '@/types';

// Carry-over of unfinished tasks (Phase 6B).
// Pure functions — no store imports, so they stay testable and mirror lib/scheduler.ts.

/**
 * A task is a carry-over candidate when it's a top-level, not-done task whose
 * reference date (due date, else AI/manual scheduled start) fell before today.
 */
export function findCarryOverCandidates(tasks: Task[], now: Date = new Date()): Task[] {
  const today = startOfDay(now);
  return tasks.filter((t) => {
    if (t.parentTaskId) return false; // only surface top-level tasks
    if (t.status === 'done') return false;
    const ref = t.dueDate ?? t.scheduledStart;
    if (!ref) return false; // undated tasks never go stale
    return isBefore(startOfDay(new Date(ref)), today);
  });
}

/**
 * The field updates that move a stale task forward to `now`'s day:
 * bump the due date to today, drop any past scheduled slot so it can be
 * re-placed by the scheduler, un-defer it, and stamp its origin for tracking.
 */
export function carryOverUpdates(task: Task, now: Date = new Date()): Partial<Task> {
  const today = startOfDay(now);
  const updates: Partial<Task> = {
    // Preserve the first origin id across repeated carry-overs.
    carryOverFrom: task.carryOverFrom ?? task.id,
  };
  if (task.dueDate) updates.dueDate = today;
  if (task.scheduledStart && isBefore(new Date(task.scheduledStart), today)) {
    updates.scheduledStart = undefined;
    updates.scheduledEnd = undefined;
    if (task.scheduleSource === 'ai') updates.scheduleSource = undefined;
  }
  if (task.status === 'deferred') updates.status = 'todo';
  return updates;
}
