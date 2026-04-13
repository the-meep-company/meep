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

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      aiPersona: 'friendly',
      timezone: defaultTimezone,
      timezoneAutoDetect: true,
      companionName: 'Meep',
      voiceLocale: 'en-US',

      setPersona: (persona) => set({ aiPersona: persona }),
      setTimezone: (tz) => set({ timezone: tz }),
      setTimezoneAutoDetect: (v) => set({ timezoneAutoDetect: v }),
      setCompanionName: (name) => set({ companionName: name }),
      setVoiceLocale: (locale) => set({ voiceLocale: locale }),
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
