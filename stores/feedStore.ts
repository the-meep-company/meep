import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FeedItem } from '@/types';

// The bots' feed: proposals, things they did, and insights. The server owns it
// (feed-action changes it); this is a cache fed by sync and Realtime.

/** A day plan being tweaked on the calendar's day view. */
export interface FeedDraft {
  itemId: string;
  /** New times by change id, from dragging blocks. */
  edits: Record<string, { start: string; end: string }>;
  /** Changes taken out of the plan. */
  removed: string[];
}

interface FeedState {
  items: FeedItem[];
  /** Items with an approve / dismiss / undo in flight (not persisted). */
  busyIds: string[];
  draft: FeedDraft | null;

  setItems: (items: FeedItem[]) => void;
  upsertItem: (item: FeedItem) => void;
  patchItem: (id: string, updates: Partial<FeedItem>) => void;
  setBusy: (id: string, busy: boolean) => void;
  startDraft: (itemId: string) => void;
  moveDraftBlock: (changeId: string, start: string, end: string) => void;
  toggleDraftBlock: (changeId: string) => void;
  clearDraft: () => void;
}

const newestFirst = (a: FeedItem, b: FeedItem) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

export const useFeedStore = create<FeedState>()(
  persist(
    (set) => ({
      items: [],
      busyIds: [],
      draft: null,

      setItems: (items) => set({ items: [...items].sort(newestFirst) }),

      upsertItem: (item) =>
        set((s) => ({ items: [item, ...s.items.filter((i) => i.id !== item.id)].sort(newestFirst).slice(0, 100) })),

      patchItem: (id, updates) =>
        set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, ...updates } : i)) })),

      setBusy: (id, busy) =>
        set((s) => ({ busyIds: busy ? [...s.busyIds.filter((b) => b !== id), id] : s.busyIds.filter((b) => b !== id) })),

      startDraft: (itemId) => set({ draft: { itemId, edits: {}, removed: [] } }),

      moveDraftBlock: (changeId, start, end) =>
        set((s) => (s.draft ? { draft: { ...s.draft, edits: { ...s.draft.edits, [changeId]: { start, end } } } } : {})),

      toggleDraftBlock: (changeId) =>
        set((s) => {
          if (!s.draft) return {};
          const removed = s.draft.removed.includes(changeId)
            ? s.draft.removed.filter((r) => r !== changeId)
            : [...s.draft.removed, changeId];
          return { draft: { ...s.draft, removed } };
        }),

      clearDraft: () => set({ draft: null }),
    }),
    {
      name: 'meep-feed',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ items: state.items }),
    }
  )
);
