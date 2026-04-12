import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Goal } from '@/types';

interface GoalState {
  goals: Goal[];

  addGoal: (goal: Goal) => void;
  updateGoal: (id: string, updates: Partial<Goal>) => void;
  deleteGoal: (id: string) => void;
  getActiveGoals: () => Goal[];
}

export const useGoalStore = create<GoalState>()(
  persist(
    (set, get) => ({
      goals: [],

      addGoal: (goal) =>
        set((state) => ({ goals: [...state.goals, goal] })),

      updateGoal: (id, updates) =>
        set((state) => ({
          goals: state.goals.map((g) =>
            g.id === id ? { ...g, ...updates } : g
          ),
        })),

      deleteGoal: (id) =>
        set((state) => ({ goals: state.goals.filter((g) => g.id !== id) })),

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
