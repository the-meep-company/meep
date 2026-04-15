import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Goal } from '@/types';

function syncGoal(goal: Goal) {
  const { useAuthStore } = require('./authStore');
  const { pushGoal } = require('@/lib/sync');
  const user = useAuthStore.getState().user;
  if (user) pushGoal(goal, user.id).catch(() => {});
}

function syncDeleteGoal(id: string) {
  const { useAuthStore } = require('./authStore');
  const { deleteRemoteGoal } = require('@/lib/sync');
  const user = useAuthStore.getState().user;
  if (user) deleteRemoteGoal(id).catch(() => {});
}

interface GoalState {
  goals: Goal[];

  addGoal: (goal: Goal) => void;
  updateGoal: (id: string, updates: Partial<Goal>) => void;
  deleteGoal: (id: string) => void;
  setGoals: (goals: Goal[]) => void;
  getActiveGoals: () => Goal[];
}

export const useGoalStore = create<GoalState>()(
  persist(
    (set, get) => ({
      goals: [],

      addGoal: (goal) => {
        set((state) => ({ goals: [...state.goals, goal] }));
        syncGoal(goal);
      },

      updateGoal: (id, updates) => {
        set((state) => ({
          goals: state.goals.map((g) =>
            g.id === id ? { ...g, ...updates } : g
          ),
        }));
        const updated = get().goals.find((g) => g.id === id);
        if (updated) syncGoal(updated);
      },

      deleteGoal: (id) => {
        set((state) => ({ goals: state.goals.filter((g) => g.id !== id) }));
        syncDeleteGoal(id);
      },

      setGoals: (goals) => set({ goals }),

      getActiveGoals: () =>
        get().goals.filter((g) => g.status === 'active'),
    }),
    {
      name: 'meep-goals',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ goals: state.goals }),
    }
  )
);
