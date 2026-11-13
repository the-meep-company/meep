import type { Task, TaskPriority } from "../../types";
import { fromDbTask, toDbTask, type DbTask } from "../../lib/taskRows";
import { supabase } from "./supabase";

export type { Task, TaskPriority };

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  1: "Urgent",
  2: "High",
  3: "Medium",
  4: "Low",
};

export async function fetchTasks(userId: string): Promise<Task[]> {
  const { data, error } = await supabase.from("tasks").select("*").eq("user_id", userId);
  if (error) throw error;
  return (data as DbTask[]).map(fromDbTask);
}

export async function saveTask(task: Task, userId: string): Promise<void> {
  const { error } = await supabase.from("tasks").upsert(toDbTask(task, userId));
  if (error) throw error;
}

/** Deletes a task and its subtasks, matching the app's deleteTask. */
export async function removeTask(id: string): Promise<void> {
  const { error } = await supabase.from("tasks").delete().or(`id.eq.${id},parent_task_id.eq.${id}`);
  if (error) throw error;
}

export function newTask(fields: Pick<Task, "title"> & Partial<Task>): Task {
  const now = new Date();
  return {
    id: crypto.randomUUID(),
    priority: 3,
    status: "todo",
    scheduleSource: "manual",
    createdAt: now,
    updatedAt: now,
    ...fields,
  };
}

/** To-do before done, then by priority, then soonest due date, then newest. */
export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const doneA = a.status === "done" ? 1 : 0;
    const doneB = b.status === "done" ? 1 : 0;
    if (doneA !== doneB) return doneA - doneB;
    if (a.priority !== b.priority) return a.priority - b.priority;
    const dueA = a.dueDate?.getTime() ?? Infinity;
    const dueB = b.dueDate?.getTime() ?? Infinity;
    if (dueA !== dueB) return dueA - dueB;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}

/** A Date as the yyyy-mm-dd value of an <input type="date">, in local time. */
export function toDateInput(date?: Date): string {
  if (!date) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** An <input type="date"> value as local midnight on that day. */
export function fromDateInput(value: string): Date | undefined {
  return value ? new Date(`${value}T00:00:00`) : undefined;
}
