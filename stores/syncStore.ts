import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GoogleCalendarInfo, SyncState } from '@/types';

// A cache of the user's google_calendars rows. The server owns them; the
// toggles here are optimistic and lib/googleCalendar.ts writes them through.

interface SyncStoreState {
  googleCalendars: GoogleCalendarInfo[];
  syncState: SyncState;
  selectedCalendarIds: string[];

  // Actions
  setGoogleCalendars: (calendars: GoogleCalendarInfo[]) => void;
  toggleCalendarSync: (id: string) => void;
  toggleBotsCanWrite: (id: string) => void;
  setSyncing: (v: boolean) => void;
  setSyncError: (err: string | null) => void;
  setLastSync: (date: Date) => void;
  clearSync: () => void; // called on disconnect
}

const selectedIds = (calendars: GoogleCalendarInfo[]) => calendars.filter((c) => c.selected).map((c) => c.id);

export const useSyncStore = create<SyncStoreState>()(
  persist(
    (set, get) => ({
      googleCalendars: [],
      syncState: {
        lastSyncAt: null,
        isSyncing: false,
        syncError: null,
      },
      selectedCalendarIds: [],

      setGoogleCalendars: (calendars) =>
        set({ googleCalendars: calendars, selectedCalendarIds: selectedIds(calendars) }),

      toggleCalendarSync: (id) => {
        const calendars = get().googleCalendars.map((c) => (c.id === id ? { ...c, selected: !c.selected } : c));
        set({ googleCalendars: calendars, selectedCalendarIds: selectedIds(calendars) });
        const cal = calendars.find((c) => c.id === id);
        const { setCalendarSelected } = require('@/lib/googleCalendar');
        if (cal) setCalendarSelected(id, cal.selected).catch((e: Error) => get().setSyncError(e.message));
      },

      toggleBotsCanWrite: (id) => {
        const calendars = get().googleCalendars.map((c) => (c.id === id ? { ...c, botsCanWrite: !c.botsCanWrite } : c));
        set({ googleCalendars: calendars });
        const cal = calendars.find((c) => c.id === id);
        const { setCalendarBotsCanWrite } = require('@/lib/googleCalendar');
        if (cal) setCalendarBotsCanWrite(id, cal.botsCanWrite).catch((e: Error) => get().setSyncError(e.message));
      },

      setSyncing: (v) =>
        set((state) => ({ syncState: { ...state.syncState, isSyncing: v, syncError: v ? null : state.syncState.syncError } })),

      setSyncError: (err) =>
        set((state) => ({ syncState: { ...state.syncState, syncError: err } })),

      setLastSync: (date) =>
        set((state) => ({
          syncState: { ...state.syncState, lastSyncAt: date, syncError: null },
        })),

      clearSync: () =>
        set({
          googleCalendars: [],
          selectedCalendarIds: [],
          syncState: { lastSyncAt: null, isSyncing: false, syncError: null },
        }),
    }),
    {
      name: 'meep-sync',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        googleCalendars: state.googleCalendars,
        selectedCalendarIds: state.selectedCalendarIds,
        syncState: state.syncState,
      }),
    }
  )
);
