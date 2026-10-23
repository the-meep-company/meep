import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  AIPersona,
  GlassBackgroundId,
  GlassStyle,
  GrainLevel,
  WidgetCalendarView,
} from '@/types';

interface SettingsState {
  aiPersona: AIPersona;
  timezone: string;
  timezoneAutoDetect: boolean;
  companionName: string;
  voiceLocale: string;
  ttsEnabled: boolean;
  ttsAutoRead: boolean;
  ttsVoice: string | null;
  widgetCalendarView: WidgetCalendarView;
  widgetCategory: string | null;
  glassStyle: GlassStyle;
  /** A preset mesh background, or 'custom' to use customBackgroundUri. */
  glassBackground: GlassBackgroundId | 'custom';
  customBackgroundUri: string | null;
  grain: GrainLevel;
  /** Replace see-through glass with solid surfaces for maximum contrast. */
  solidSurfaces: boolean;
  taskCarryOverEnabled: boolean;

  setPersona: (persona: AIPersona) => void;
  setTimezone: (tz: string) => void;
  setTimezoneAutoDetect: (v: boolean) => void;
  setCompanionName: (name: string) => void;
  setVoiceLocale: (locale: string) => void;
  setTtsEnabled: (v: boolean) => void;
  setTtsAutoRead: (v: boolean) => void;
  setTtsVoice: (voice: string | null) => void;
  setWidgetCalendarView: (view: WidgetCalendarView) => void;
  setWidgetCategory: (category: string | null) => void;
  setGlassStyle: (style: GlassStyle) => void;
  setGlassBackground: (background: GlassBackgroundId | 'custom') => void;
  setCustomBackground: (uri: string | null) => void;
  setGrain: (grain: GrainLevel) => void;
  setSolidSurfaces: (v: boolean) => void;
  setTaskCarryOverEnabled: (v: boolean) => void;
}

const defaultTimezone =
  typeof Intl !== 'undefined'
    ? Intl.DateTimeFormat().resolvedOptions().timeZone
    : 'Europe/London';

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
      timezone: defaultTimezone,
      timezoneAutoDetect: true,
      companionName: 'Meep',
      voiceLocale: 'en-US',
      ttsEnabled: true,
      ttsAutoRead: false,
      ttsVoice: null,
      widgetCalendarView: 'daily',
      widgetCategory: null,
      glassStyle: 'frosted',
      glassBackground: 'midnight',
      customBackgroundUri: null,
      grain: 'subtle',
      solidSurfaces: false,
      taskCarryOverEnabled: true,

      setPersona: (persona) => { set({ aiPersona: persona }); syncSettings(); },
      setTimezone: (tz) => { set({ timezone: tz }); syncSettings(); },
      setTimezoneAutoDetect: (v) => { set({ timezoneAutoDetect: v }); syncSettings(); },
      setCompanionName: (name) => { set({ companionName: name }); syncSettings(); },
      setVoiceLocale: (locale) => { set({ voiceLocale: locale }); syncSettings(); },
      setTtsEnabled: (v) => set({ ttsEnabled: v }),
      setTtsAutoRead: (v) => set({ ttsAutoRead: v }),
      setTtsVoice: (voice) => set({ ttsVoice: voice }),
      setWidgetCalendarView: (view) => set({ widgetCalendarView: view }),
      setWidgetCategory: (category) => set({ widgetCategory: category }),
      setGlassStyle: (style) => set({ glassStyle: style }),
      setGlassBackground: (background) => set({ glassBackground: background }),
      // Setting a photo selects it; clearing it falls back to the default preset.
      setCustomBackground: (uri) =>
        set(uri ? { customBackgroundUri: uri, glassBackground: 'custom' } : { customBackgroundUri: null, glassBackground: 'midnight' }),
      setGrain: (grain) => set({ grain }),
      setSolidSurfaces: (v) => set({ solidSurfaces: v }),
      setTaskCarryOverEnabled: (v) => set({ taskCarryOverEnabled: v }),
    }),
    {
      name: 'meep-settings',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        aiPersona: state.aiPersona,
        timezone: state.timezone,
        timezoneAutoDetect: state.timezoneAutoDetect,
        companionName: state.companionName,
        voiceLocale: state.voiceLocale,
        ttsEnabled: state.ttsEnabled,
        ttsAutoRead: state.ttsAutoRead,
        ttsVoice: state.ttsVoice,
        widgetCalendarView: state.widgetCalendarView,
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
