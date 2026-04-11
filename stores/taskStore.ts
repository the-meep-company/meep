import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Task, TaskStatus } from '@/types';

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

  // Selectors
  getFilteredTasks: () => Task[];
  getSubtasks: (parentId: string) => Task[];
}

export const useTaskStore = create<TaskState>()(
  persist(
    (set, get) => ({
      tasks: [],
      filter: 'all',

      setFilter: (filter) => set({ filter }),

      addTask: (task) =>
        set((state) => ({ tasks: [...state.tasks, task] })),

      updateTask: (id, updates) =>
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === id ? { ...t, ...updates, updatedAt: new Date() } : t
          ),
        })),

      deleteTask: (id) =>
        set((state) => ({
          // Also delete any subtasks
          tasks: state.tasks.filter((t) => t.id !== id && t.parentTaskId !== id),
        })),

      toggleStatus: (id) =>
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === id
              ? { ...t, status: (t.status === 'done' ? 'todo' : 'done') as TaskStatus, updatedAt: new Date() }
              : t
          ),
        })),

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
