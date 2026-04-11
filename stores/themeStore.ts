import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { themes, type ThemeName, type Theme } from '@/themes';

interface ThemeState {
  themeName: ThemeName;
  theme: Theme;
  setTheme: (name: ThemeName) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      themeName: 'sleek',
      theme: themes.sleek,
      setTheme: (name) => set({ themeName: name, theme: themes[name] }),
    }),
    {
      name: 'meep-theme',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ themeName: state.themeName }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.theme = themes[state.themeName];
        }
      },
    }
  )
);
