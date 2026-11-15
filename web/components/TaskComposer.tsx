"use client";

import { useState, type FormEvent } from "react";
import { fromDateInput, newTask, PRIORITY_LABELS, type Task, type TaskPriority } from "@/lib/tasks";

export default function TaskComposer({ onAdd }: { onAdd: (task: Task) => void }) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<TaskPriority>(3);
  const [due, setDue] = useState("");
  const [category, setCategory] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    onAdd(
      newTask({
        title: trimmed,
        priority,
        dueDate: fromDateInput(due),
        category: category.trim() || undefined,
      }),
    );
    setTitle("");
    setDue("");
  }

  const field =
    "rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm outline-none focus:border-accent";

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-surface p-3">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Add a task…"
        aria-label="New task title"
        className="w-full bg-transparent px-1 py-1 text-base outline-none placeholder:text-muted"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
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
        <button
          type="submit"
          disabled={!title.trim()}
          className="ml-auto rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-40"
        >
          Add task
        </button>
      </div>
    </form>
  );
}
