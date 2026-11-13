"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { fetchTasks, removeTask, saveTask, sortTasks, type Task } from "@/lib/tasks";
import TaskComposer from "./TaskComposer";
import TaskRow from "./TaskRow";

type Filter = "all" | "todo" | "done";

/** Supabase errors are plain objects, not Error instances, but both carry a message. */
function errorMessage(e: unknown, fallback: string): string {
  const message = (e as { message?: unknown } | null)?.message;
  return typeof message === "string" && message ? message : fallback;
}

export default function TaskBoard({ user }: { user: User }) {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("todo");
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    try {
      setTasks(await fetchTasks(user.id));
      setError(null);
    } catch (e) {
      setError(errorMessage(e, "Couldn't load your tasks."));
    }
  }, [user.id]);

  // Load now, again when the tab regains focus, and whenever the app changes a task.
  useEffect(() => {
    load();
    window.addEventListener("focus", load);
    const channel = supabase
      .channel(`tasks:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks", filter: `user_id=eq.${user.id}` },
        () => load(),
      )
      .subscribe();
    return () => {
      window.removeEventListener("focus", load);
      supabase.removeChannel(channel);
    };
  }, [load, user.id]);

  /** Apply a change locally right away, then write it; reload if the write fails. */
  async function mutate(apply: (prev: Task[]) => Task[], write: () => Promise<void>) {
    setTasks((prev) => (prev ? apply(prev) : prev));
    try {
      await write();
    } catch (e) {
      setError(errorMessage(e, "Couldn't save that change."));
      load();
    }
  }

  const addTask = (task: Task) => mutate((prev) => [...prev, task], () => saveTask(task, user.id));

  const updateTask = (task: Task) => {
    const next = { ...task, updatedAt: new Date() };
    return mutate(
      (prev) => prev.map((t) => (t.id === next.id ? next : t)),
      () => saveTask(next, user.id),
    );
  };

  const deleteTask = (id: string) =>
    mutate(
      (prev) => prev.filter((t) => t.id !== id && t.parentTaskId !== id),
      () => removeTask(id),
    );

  const topLevel = useMemo(() => (tasks ?? []).filter((t) => !t.parentTaskId), [tasks]);
  const subtaskCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of tasks ?? []) {
      if (t.parentTaskId) counts.set(t.parentTaskId, (counts.get(t.parentTaskId) ?? 0) + 1);
    }
    return counts;
  }, [tasks]);

  const doneCount = topLevel.filter((t) => t.status === "done").length;
  const counts: Record<Filter, number> = {
    all: topLevel.length,
    todo: topLevel.length - doneCount,
    done: doneCount,
  };

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sortTasks(
      topLevel.filter((t) => {
        if (filter === "todo" && t.status === "done") return false;
        if (filter === "done" && t.status !== "done") return false;
        if (!q) return true;
        return [t.title, t.description, t.category].some((s) => s?.toLowerCase().includes(q));
      }),
    );
  }, [topLevel, filter, query]);

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <span className="font-semibold tracking-tight text-accent">meep</span>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-muted sm:inline">{user.email}</span>
            <button
              type="button"
              onClick={() => supabase.auth.signOut()}
              className="rounded-md px-2 py-1 text-muted transition hover:bg-surface-2 hover:text-foreground"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Tasks</h1>
            <p className="mt-1 text-muted">
              {tasks === null ? "Loading…" : `${counts.todo} to do · ${counts.done} done`}
            </p>
          </div>
          <input
            type="search"
            placeholder="Search tasks"
            aria-label="Search tasks"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent sm:w-56"
          />
        </div>

        <div className="mt-6">
          <TaskComposer onAdd={addTask} />
        </div>

        <div role="tablist" aria-label="Filter tasks" className="mt-6 flex gap-1">
          {(["todo", "done", "all"] as const).map((f) => (
            <button
              key={f}
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1 text-sm transition ${
                filter === f ? "bg-foreground text-background" : "text-muted hover:bg-surface-2"
              }`}
            >
              {f === "todo" ? "To do" : f === "done" ? "Done" : "All"}
              <span className="ml-1.5 opacity-60">{counts[f]}</span>
            </button>
          ))}
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded-lg bg-accent-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <ul className="mt-4 divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {visible.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              subtaskCount={subtaskCounts.get(task.id) ?? 0}
              onUpdate={updateTask}
              onDelete={deleteTask}
            />
          ))}
          {tasks !== null && visible.length === 0 && (
            <li className="px-4 py-10 text-center text-sm text-muted">
              {query ? "No tasks match your search." : filter === "done" ? "Nothing done yet." : "No tasks here. Add one above."}
            </li>
          )}
        </ul>
      </main>
    </div>
  );
}
