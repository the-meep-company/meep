import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GoogleCalendarInfo, SyncState } from '@/types';

interface SyncStoreState {
  googleCalendars: GoogleCalendarInfo[];
  syncState: SyncState;
  selectedCalendarIds: string[];

  // Actions
  setGoogleCalendars: (calendars: GoogleCalendarInfo[]) => void;
  toggleCalendarSync: (id: string) => void;
  setSyncing: (v: boolean) => void;
  setSyncError: (err: string | null) => void;
  setLastSync: (date: Date) => void;
  clearSync: () => void; // called on disconnect
}

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

      setGoogleCalendars: (calendars) => {
        // On first load, auto-select the primary calendar
        const currentSelected = get().selectedCalendarIds;
        const newSelected =
          currentSelected.length === 0
            ? calendars.filter((c) => c.primary).map((c) => c.id)
            : currentSelected;
        set({ googleCalendars: calendars, selectedCalendarIds: newSelected });
      },

      toggleCalendarSync: (id) => {
        const { selectedCalendarIds } = get();
        const next = selectedCalendarIds.includes(id)
          ? selectedCalendarIds.filter((s) => s !== id)
          : [...selectedCalendarIds, id];
        set({ selectedCalendarIds: next });
      },

      setSyncing: (v) =>
        set((state) => ({ syncState: { ...state.syncState, isSyncing: v } })),

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
