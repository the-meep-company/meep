import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Task, TaskStatus } from '@/types';
import { findCarryOverCandidates, carryOverUpdates } from '@/lib/taskCarryOver';

type TaskFilter = 'all' | 'todo' | 'done';

interface TaskState {
  tasks: Task[];
  filter: TaskFilter;

  // Actions
  setFilter: (filter: TaskFilter) => void;
  addTask: (task: Task) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  toggleStatus: (id: string) => void;
  setTasks: (tasks: Task[]) => void;
  carryOverTasks: (now?: Date) => number;

  // Selectors
  getFilteredTasks: () => Task[];
  getSubtasks: (parentId: string) => Task[];
}

function syncTask(task: Task) {
  const { useAuthStore } = require('./authStore');
  const { pushTask } = require('@/lib/sync');
  const user = useAuthStore.getState().user;
  if (user) pushTask(task, user.id).catch(() => {});
}

function syncDeleteTask(id: string) {
  const { useAuthStore } = require('./authStore');
  const { deleteRemoteTask } = require('@/lib/sync');
  const user = useAuthStore.getState().user;
  if (user) deleteRemoteTask(id).catch(() => {});
}

export const useTaskStore = create<TaskState>()(
  persist(
    (set, get) => ({
      tasks: [],
      filter: 'all',

      setFilter: (filter) => set({ filter }),

      addTask: (task) => {
        set((state) => ({ tasks: [...state.tasks, task] }));
        syncTask(task);
      },

      updateTask: (id, updates) => {
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === id ? { ...t, ...updates, updatedAt: new Date() } : t
          ),
        }));
        const updated = get().tasks.find((t) => t.id === id);
        if (updated) syncTask(updated);
      },

      deleteTask: (id) => {
        // Also collect subtask IDs to delete remotely
        const subtaskIds = get().tasks.filter((t) => t.parentTaskId === id).map((t) => t.id);
        set((state) => ({
          tasks: state.tasks.filter((t) => t.id !== id && t.parentTaskId !== id),
        }));
        syncDeleteTask(id);
        subtaskIds.forEach(syncDeleteTask);
      },

      toggleStatus: (id) => {
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === id
              ? { ...t, status: (t.status === 'done' ? 'todo' : 'done') as TaskStatus, updatedAt: new Date() }
              : t
          ),
        }));
        const updated = get().tasks.find((t) => t.id === id);
        if (updated) syncTask(updated);
      },

      setTasks: (tasks) => set({ tasks }),

      carryOverTasks: (now = new Date()) => {
        const candidates = findCarryOverCandidates(get().tasks, now);
        if (candidates.length === 0) return 0;
        const updatesById = new Map(
          candidates.map((t) => [t.id, carryOverUpdates(t, now)])
        );
        set((state) => ({
          tasks: state.tasks.map((t) =>
            updatesById.has(t.id)
              ? { ...t, ...updatesById.get(t.id), updatedAt: new Date() }
              : t
          ),
        }));
        // Sync each carried task individually (mirrors updateTask's fire-and-forget).
        for (const id of updatesById.keys()) {
          const updated = get().tasks.find((t) => t.id === id);
          if (updated) syncTask(updated);
        }
        return candidates.length;
      },

      getFilteredTasks: () => {
        const { tasks, filter } = get();
        // Only show top-level tasks (no parentTaskId)
        const topLevel = tasks.filter((t) => !t.parentTaskId);
        if (filter === 'all') return topLevel;
        if (filter === 'todo') return topLevel.filter((t) => t.status !== 'done');
        return topLevel.filter((t) => t.status === 'done');
      },

      getSubtasks: (parentId) =>
        get().tasks.filter((t) => t.parentTaskId === parentId),
    }),
    {
      name: 'meep-tasks',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ tasks: state.tasks }),
    }
  )
);
