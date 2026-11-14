"use client";

import { useState, type FormEvent } from "react";
import {
  fromDateInput,
  PRIORITY_LABELS,
  toDateInput,
  type Task,
  type TaskPriority,
} from "@/lib/tasks";

const PRIORITY_DOT: Record<TaskPriority, string> = {
  1: "bg-danger",
  2: "bg-accent",
  3: "bg-muted/50",
  4: "bg-border",
};

function dueLabel(due: Date, done: boolean): { text: string; overdue: boolean } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  const text =
    days === 0
      ? "Today"
      : days === 1
        ? "Tomorrow"
        : days === -1
          ? "Yesterday"
          : due.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return { text, overdue: days < 0 && !done };
}

interface Props {
  task: Task;
  subtaskCount: number;
  onUpdate: (task: Task) => void;
  onDelete: (id: string) => void;
}

export default function TaskRow({ task, subtaskCount, onUpdate, onDelete }: Props) {
  const [editing, setEditing] = useState(false);
  const done = task.status === "done";
  const due = task.dueDate ? dueLabel(task.dueDate, done) : null;

  return (
    <li className="group">
      <div className="flex items-start gap-3 px-4 py-3">
        <input
          type="checkbox"
          checked={done}
          aria-label={done ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`}
          onChange={() => onUpdate({ ...task, status: done ? "todo" : "done" })}
          className="mt-1 size-4 shrink-0 cursor-pointer accent-[var(--accent)]"
        />
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          aria-expanded={editing}
          className="min-w-0 flex-1 text-left"
        >
          <span className={`block ${done ? "text-muted line-through" : ""}`}>{task.title}</span>
          <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            <span className="inline-flex items-center gap-1.5">
              <span className={`size-2 rounded-full ${PRIORITY_DOT[task.priority]}`} />
              {PRIORITY_LABELS[task.priority]}
            </span>
            {due && <span className={due.overdue ? "text-danger" : ""}>{due.text}</span>}
            {task.category && (
              <span className="rounded bg-surface-2 px-1.5 py-0.5 text-foreground/80">{task.category}</span>
            )}
            {subtaskCount > 0 && <span>{subtaskCount} subtask{subtaskCount > 1 ? "s" : ""}</span>}
          </span>
        </button>
      </div>
      {editing && (
        <TaskEditor
          task={task}
          onSave={(next) => {
            onUpdate(next);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
          onDelete={() => {
            const extra = subtaskCount > 0 ? ` and its ${subtaskCount} subtask${subtaskCount > 1 ? "s" : ""}` : "";
            if (window.confirm(`Delete "${task.title}"${extra}?`)) onDelete(task.id);
          }}
        />
      )}
    </li>
  );
}

function TaskEditor({
  task,
  onSave,
  onCancel,
  onDelete,
}: {
  task: Task;
  onSave: (task: Task) => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [due, setDue] = useState(toDateInput(task.dueDate));
  const [category, setCategory] = useState(task.category ?? "");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({
      ...task,
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      dueDate: fromDateInput(due),
      category: category.trim() || undefined,
    });
  }

  const field =
    "rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm outline-none focus:border-accent";

  return (
    <form onSubmit={handleSubmit} className="space-y-3 bg-surface-2/50 px-4 pb-4 pt-1 sm:pl-11">
      <input
        aria-label="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className={`${field} w-full`}
      />
      <textarea
        aria-label="Description"
        placeholder="Description"
        rows={3}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className={`${field} w-full resize-y`}
      />
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Priority"
          value={priority}
          onChange={(e) => setPriority(Number(e.target.value) as TaskPriority)}
          className={field}
        >
          {([1, 2, 3, 4] as const).map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABELS[p]}
            </option>
          ))}
        </select>
        <input type="date" aria-label="Due date" value={due} onChange={(e) => setDue(e.target.value)} className={field} />
        <input
          aria-label="Category"
          placeholder="Category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className={`${field} w-32`}
        />
      </div>
      <div className="flex items-center gap-2">
        <button
          type="submit"
          className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white transition hover:opacity-90"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-3 py-1.5 text-sm text-muted transition hover:bg-surface-2"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="ml-auto rounded-lg px-3 py-1.5 text-sm text-danger transition hover:bg-surface-2"
        >
          Delete
        </button>
      </div>
    </form>
  );
}
