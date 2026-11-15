import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { themes, resolveThemeName, DEFAULT_THEME, type ThemeName, type Theme } from '@/themes';
import {
  DEFAULT_ACCENT,
  DEFAULT_ACCENT_HUE,
  resolveAccent,
  type AccentId,
} from '@/lib/accent';
import { useSettingsStore } from './settingsStore';

interface ThemeState {
  themeName: ThemeName;
  /** The active theme with the user's accent applied. */
  theme: Theme;
  accentId: AccentId | 'custom';
  /** Hue (0-360) used when accentId is 'custom'. */
  accentHue: number;
  /** Accepts any saved name; unknown/retired themes fall back to the default. */
  setTheme: (name: ThemeName | string) => void;
  setAccent: (id: AccentId | 'custom') => void;
  /** Sets a custom hue and selects it. */
  setAccentHue: (hue: number) => void;
}

function buildTheme(name: ThemeName, accentId: AccentId | 'custom', accentHue: number): Theme {
  const base = themes[name];
  return { ...base, colors: { ...base.colors, accent: resolveAccent(accentId, accentHue) } };
}

/**
 * The retired Afterglow theme, rebuilt from the settings that replaced it: its
 * backdrop as the wallpaper, matte cards, heavy grain and the warm accent.
 */
function applyAfterglowLook() {
  const apply = () =>
    useSettingsStore.setState({ glassBackground: 'afterglow', solidSurfaces: true, grain: 1 });
  if (useSettingsStore.persist.hasHydrated()) apply();
  else useSettingsStore.persist.onFinishHydration(apply);
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      themeName: DEFAULT_THEME,
      theme: buildTheme(DEFAULT_THEME, DEFAULT_ACCENT, DEFAULT_ACCENT_HUE),
      accentId: DEFAULT_ACCENT,
      accentHue: DEFAULT_ACCENT_HUE,
      setTheme: (name) => {
        if (name === 'afterglow') {
          // A device still on an older version synced the retired theme.
          applyAfterglowLook();
          set({
            themeName: DEFAULT_THEME,
            accentId: 'apricot',
            theme: buildTheme(DEFAULT_THEME, 'apricot', get().accentHue),
          });
          return;
        }
        const resolved = resolveThemeName(name);
        set({ themeName: resolved, theme: buildTheme(resolved, get().accentId, get().accentHue) });
      },
      setAccent: (accentId) =>
        set({ accentId, theme: buildTheme(get().themeName, accentId, get().accentHue) }),
      setAccentHue: (accentHue) =>
        set({ accentId: 'custom', accentHue, theme: buildTheme(get().themeName, 'custom', accentHue) }),
    }),
    {
      name: 'meep-theme',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        themeName: state.themeName,
        accentId: state.accentId,
        accentHue: state.accentHue,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        // Going through setTheme (not mutating `state`) saves the migrated name,
        // so the Afterglow conversion runs once and later changes stick.
        useThemeStore.getState().setTheme(state.themeName);
      },
    }
  )
);
