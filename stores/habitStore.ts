import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Habit } from '@/types';

interface HabitState {
  habits: Habit[];

  // Actions
  addHabit: (habit: Habit) => void;
  updateHabit: (id: string, updates: Partial<Habit>) => void;
  deleteHabit: (id: string) => void;
  toggleActive: (id: string) => void;
  setHabits: (habits: Habit[]) => void;

  // Selectors
  getActiveHabits: () => Habit[];
  getHabitsForDay: (dayOfWeek: number) => Habit[];
}

function syncHabit(habit: Habit) {
  const { useAuthStore } = require('./authStore');
  const { pushHabit } = require('@/lib/sync');
  const user = useAuthStore.getState().user;
  if (user) pushHabit(habit, user.id).catch(() => {});
}

function syncDeleteHabit(id: string) {
  const { useAuthStore } = require('./authStore');
  const { deleteRemoteHabit } = require('@/lib/sync');
  const user = useAuthStore.getState().user;
  if (user) deleteRemoteHabit(id).catch(() => {});
}

function habitAppliesToDay(habit: Habit, dayOfWeek: number): boolean {
  switch (habit.frequency) {
    case 'daily':
      return true;
    case 'weekdays':
      return dayOfWeek >= 1 && dayOfWeek <= 5;
    case 'weekends':
      return dayOfWeek === 0 || dayOfWeek === 6;
    case 'custom':
      return habit.customDays?.includes(dayOfWeek) ?? false;
    default:
      return false;
  }
}

export const useHabitStore = create<HabitState>()(
  persist(
    (set, get) => ({
      habits: [],

      addHabit: (habit) => {
        set((state) => ({ habits: [...state.habits, habit] }));
        syncHabit(habit);
      },

      updateHabit: (id, updates) => {
        set((state) => ({
          habits: state.habits.map((h) =>
            h.id === id ? { ...h, ...updates, updatedAt: new Date() } : h
          ),
        }));
        const updated = get().habits.find((h) => h.id === id);
        if (updated) syncHabit(updated);
      },

      deleteHabit: (id) => {
        set((state) => ({ habits: state.habits.filter((h) => h.id !== id) }));
        syncDeleteHabit(id);
      },

      toggleActive: (id) => {
        set((state) => ({
          habits: state.habits.map((h) =>
            h.id === id ? { ...h, isActive: !h.isActive, updatedAt: new Date() } : h
          ),
        }));
        const updated = get().habits.find((h) => h.id === id);
        if (updated) syncHabit(updated);
      },

      setHabits: (habits) => set({ habits }),

      getActiveHabits: () => get().habits.filter((h) => h.isActive),

      getHabitsForDay: (dayOfWeek) =>
        get().habits.filter((h) => h.isActive && habitAppliesToDay(h, dayOfWeek)),
    }),
    {
      name: 'meep-habits',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ habits: state.habits }),
    }
  )
);
