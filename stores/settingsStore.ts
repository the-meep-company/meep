import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AIPersona } from '@/types';

interface SettingsState {
  aiPersona: AIPersona;
  timezone: string;
  timezoneAutoDetect: boolean;

  setPersona: (persona: AIPersona) => void;
  setTimezone: (tz: string) => void;
  setTimezoneAutoDetect: (v: boolean) => void;
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

      setPersona: (persona) => set({ aiPersona: persona }),
      setTimezone: (tz) => set({ timezone: tz }),
      setTimezoneAutoDetect: (v) => set({ timezoneAutoDetect: v }),
    }),
    {
      name: 'meep-settings',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        aiPersona: state.aiPersona,
        timezone: state.timezone,
        timezoneAutoDetect: state.timezoneAutoDetect,
      }),
    }
  )
);
