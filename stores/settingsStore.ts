import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AIPersona, GlassBackgroundId, GlassStyle } from '@/types';
import { deviceTimeZone } from '@/lib/timezones';

/** Longest custom instructions the companion accepts (also enforced by the AI functions). */
export const MAX_COMPANION_INSTRUCTIONS = 500;

interface SettingsState {
  aiPersona: AIPersona;
  /** IANA zone used for scheduling. Follows the device while timezoneAutoDetect is on. */
  timezone: string;
  timezoneAutoDetect: boolean;
  companionName: string;
  /** Free-text instructions the companion follows in every chat. Stays on this device. */
  companionInstructions: string;
  voiceLocale: string;
  ttsEnabled: boolean;
  ttsAutoRead: boolean;
  ttsVoice: string | null;
  widgetCategory: string | null;
  glassStyle: GlassStyle;
  /** A preset mesh background, or 'custom' to use customBackgroundUri. */
  glassBackground: GlassBackgroundId | 'custom';
  customBackgroundUri: string | null;
  /** Film-grain strength over the wallpaper, 0 (off) to 1. */
  grain: number;
  /** Replace see-through glass with solid surfaces for maximum contrast. */
  solidSurfaces: boolean;
  taskCarryOverEnabled: boolean;

  setPersona: (persona: AIPersona) => void;
  setTimezone: (tz: string) => void;
  setTimezoneAutoDetect: (v: boolean) => void;
  setCompanionName: (name: string) => void;
  setCompanionInstructions: (text: string) => void;
  setVoiceLocale: (locale: string) => void;
  setTtsEnabled: (v: boolean) => void;
  setTtsAutoRead: (v: boolean) => void;
  setTtsVoice: (voice: string | null) => void;
  setWidgetCategory: (category: string | null) => void;
  setGlassStyle: (style: GlassStyle) => void;
  setGlassBackground: (background: GlassBackgroundId | 'custom') => void;
  setCustomBackground: (uri: string | null) => void;
  setGrain: (grain: number) => void;
  setSolidSurfaces: (v: boolean) => void;
  setTaskCarryOverEnabled: (v: boolean) => void;
}

/** Grain was three named levels before it became a slider. */
const LEGACY_GRAIN: Record<string, number> = { off: 0, subtle: 0.5, strong: 1 };

function syncSettings() {
  const { useAuthStore } = require('./authStore');
  const { pushSettings } = require('@/lib/sync');
  const { useThemeStore } = require('./themeStore');
  const user = useAuthStore.getState().user;
  if (!user) return;
  const s = useSettingsStore.getState();
  const theme = useThemeStore.getState().themeName;
  pushSettings(user.id, {
    aiPersona: s.aiPersona,
    timezone: s.timezone,
    timezoneAutoDetect: s.timezoneAutoDetect,
    companionName: s.companionName,
    voiceLocale: s.voiceLocale,
    theme,
  }).catch(() => {});
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      aiPersona: 'friendly',
      timezone: deviceTimeZone(),
      timezoneAutoDetect: true,
      companionName: 'Meep',
      companionInstructions: '',
      voiceLocale: 'en-US',
      ttsEnabled: true,
      ttsAutoRead: false,
      ttsVoice: null,
      widgetCategory: null,
      glassStyle: 'frosted',
      glassBackground: 'midnight',
      customBackgroundUri: null,
      grain: 0.5,
      solidSurfaces: false,
      taskCarryOverEnabled: true,

      setPersona: (persona) => { set({ aiPersona: persona }); syncSettings(); },
      setTimezone: (tz) => { set({ timezone: tz }); syncSettings(); },
      // Turning it back on snaps to the device's zone straight away.
      setTimezoneAutoDetect: (v) => {
        set(v ? { timezoneAutoDetect: true, timezone: deviceTimeZone() } : { timezoneAutoDetect: false });
        syncSettings();
      },
      setCompanionName: (name) => { set({ companionName: name }); syncSettings(); },
      setCompanionInstructions: (text) =>
        set({ companionInstructions: text.slice(0, MAX_COMPANION_INSTRUCTIONS) }),
      setVoiceLocale: (locale) => { set({ voiceLocale: locale }); syncSettings(); },
      setTtsEnabled: (v) => set({ ttsEnabled: v }),
      setTtsAutoRead: (v) => set({ ttsAutoRead: v }),
      setTtsVoice: (voice) => set({ ttsVoice: voice }),
      setWidgetCategory: (category) => set({ widgetCategory: category }),
      setGlassStyle: (style) => set({ glassStyle: style }),
      setGlassBackground: (background) => set({ glassBackground: background }),
      // Setting a photo selects it; clearing it falls back to the default preset.
      setCustomBackground: (uri) =>
        set(uri ? { customBackgroundUri: uri, glassBackground: 'custom' } : { customBackgroundUri: null, glassBackground: 'midnight' }),
      setGrain: (grain) => set({ grain: Math.max(0, Math.min(1, grain)) }),
      setSolidSurfaces: (v) => set({ solidSurfaces: v }),
      setTaskCarryOverEnabled: (v) => set({ taskCarryOverEnabled: v }),
    }),
    {
      name: 'meep-settings',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      migrate: (persisted) => {
        const state = (persisted ?? {}) as Record<string, unknown>;
        if (typeof state.grain === 'string') state.grain = LEGACY_GRAIN[state.grain] ?? 0.5;
        delete state.widgetCalendarView; // the widget only ever drew the daily view
        return state as unknown as SettingsState;
      },
      onRehydrateStorage: () => (state) => {
        // "Set automatically": follow the device if it moved zones since last launch.
        if (state?.timezoneAutoDetect && state.timezone !== deviceTimeZone()) {
          useSettingsStore.setState({ timezone: deviceTimeZone() });
        }
      },
      partialize: (state) => ({
        aiPersona: state.aiPersona,
        timezone: state.timezone,
        timezoneAutoDetect: state.timezoneAutoDetect,
        companionName: state.companionName,
        companionInstructions: state.companionInstructions,
        voiceLocale: state.voiceLocale,
        ttsEnabled: state.ttsEnabled,
        ttsAutoRead: state.ttsAutoRead,
        ttsVoice: state.ttsVoice,
        widgetCategory: state.widgetCategory,
        glassStyle: state.glassStyle,
        glassBackground: state.glassBackground,
        customBackgroundUri: state.customBackgroundUri,
        grain: state.grain,
        solidSurfaces: state.solidSurfaces,
        taskCarryOverEnabled: state.taskCarryOverEnabled,
      }),
    }
  )
);
