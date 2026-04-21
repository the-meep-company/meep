import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { normaliseCategoryKey } from '@/lib/colors';

interface ColorStoreState {
  preferences: Record<string, string>;
  learnColorPreference: (category: string, chosenColor: string) => void;
  getColorPreferences: () => Record<string, string>;
}

export const useColorStore = create<ColorStoreState>()(
  persist(
    (set, get) => ({
      preferences: {},

      learnColorPreference: (category, chosenColor) => {
        const key = normaliseCategoryKey(category);
        set((state) => ({
          preferences: { ...state.preferences, [key]: chosenColor },
        }));
      },

      getColorPreferences: () => get().preferences,
    }),
    {
      name: 'meep-colors',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ preferences: state.preferences }),
    }
  )
);
