// Task <-> `tasks` row mapping (camelCase <-> snake_case).
// Shared by the Expo app and the Next.js site in web/, so it has no React Native
// imports and uses relative paths (each project maps `@/` to its own root).
import type { Task } from '../types';

export interface DbTask {
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

export function toDbTask(task: Task, userId: string): DbTask {
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
