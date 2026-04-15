import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AIPersona } from '@/types';

interface SettingsState {
  aiPersona: AIPersona;
  timezone: string;
  timezoneAutoDetect: boolean;
  companionName: string;
  voiceLocale: string;

  setPersona: (persona: AIPersona) => void;
  setTimezone: (tz: string) => void;
  setTimezoneAutoDetect: (v: boolean) => void;
  setCompanionName: (name: string) => void;
  setVoiceLocale: (locale: string) => void;
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

      setPersona: (persona) => { set({ aiPersona: persona }); syncSettings(); },
      setTimezone: (tz) => { set({ timezone: tz }); syncSettings(); },
      setTimezoneAutoDetect: (v) => { set({ timezoneAutoDetect: v }); syncSettings(); },
      setCompanionName: (name) => { set({ companionName: name }); syncSettings(); },
      setVoiceLocale: (locale) => { set({ voiceLocale: locale }); syncSettings(); },
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
      }),
    }
  )
);
