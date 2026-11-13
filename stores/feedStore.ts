import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FeedItem } from '@/types';

// The bots' feed: proposals, things they did, and insights. The server owns it
// (feed-action changes it); this is a cache fed by sync and Realtime.

interface FeedState {
  items: FeedItem[];
  /** Items with an approve / dismiss / undo in flight (not persisted). */
  busyIds: string[];

  setItems: (items: FeedItem[]) => void;
  upsertItem: (item: FeedItem) => void;
  patchItem: (id: string, updates: Partial<FeedItem>) => void;
  setBusy: (id: string, busy: boolean) => void;
}

const newestFirst = (a: FeedItem, b: FeedItem) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

export const useFeedStore = create<FeedState>()(
  persist(
    (set) => ({
      items: [],
      busyIds: [],

      setItems: (items) => set({ items: [...items].sort(newestFirst) }),

      upsertItem: (item) =>
        set((s) => ({ items: [item, ...s.items.filter((i) => i.id !== item.id)].sort(newestFirst).slice(0, 100) })),

      patchItem: (id, updates) =>
        set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, ...updates } : i)) })),

      setBusy: (id, busy) =>
        set((s) => ({ busyIds: busy ? [...s.busyIds.filter((b) => b !== id), id] : s.busyIds.filter((b) => b !== id) })),
    }),
    {
      name: 'meep-feed',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ items: state.items }),
    }
  )
);
