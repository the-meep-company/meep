import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { themes, resolveThemeName, DEFAULT_THEME, type ThemeName, type Theme } from '@/themes';

interface ThemeState {
  themeName: ThemeName;
  theme: Theme;
  /** Accepts any saved name; unknown/retired themes fall back to the default. */
  setTheme: (name: ThemeName | string) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      themeName: DEFAULT_THEME,
      theme: themes[DEFAULT_THEME],
      setTheme: (name) => {
        const resolved = resolveThemeName(name);
        set({ themeName: resolved, theme: themes[resolved] });
      },
    }),
    {
      name: 'meep-theme',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ themeName: state.themeName }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Migrate retired themes (minimal/playful/sleek) saved by older versions.
          state.themeName = resolveThemeName(state.themeName);
          state.theme = themes[state.themeName];
        }
      },
    }
  )
);
