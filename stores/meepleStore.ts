import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Meeple, MeepleMessage } from '@/types';

const MAX_MESSAGES = 200;

export type MeepleDraft = Pick<
  Meeple,
  'name' | 'role' | 'instructions' | 'icon' | 'glow' | 'webSearch' | 'scheduleAccess'
>;

interface MeepleState {
  meeples: Meeple[];
  /** Meeples with a request in flight (not persisted). */
  workingIds: string[];
  /** The thread currently on screen, so its replies don't count as unread. */
  openId: string | null;

  addMeeple: (draft: MeepleDraft) => string;
  updateMeeple: (id: string, updates: Partial<MeepleDraft>) => void;
  deleteMeeple: (id: string) => void;
  addMessage: (id: string, msg: MeepleMessage) => void;
  setActionStatus: (id: string, messageId: string, index: number, status: 'accepted' | 'rejected') => void;
  clearThread: (id: string) => void;
  setWorking: (id: string, working: boolean) => void;
  setOpen: (id: string | null) => void;
}

const patch = (meeples: Meeple[], id: string, fn: (m: Meeple) => Meeple) =>
  meeples.map((m) => (m.id === id ? fn(m) : m));

export const useMeepleStore = create<MeepleState>()(
  persist(
    (set, get) => ({
      meeples: [],
      workingIds: [],
      openId: null,

      addMeeple: (draft) => {
        const id = Date.now().toString() + Math.random().toString(36).slice(2, 7);
        const now = new Date();
        set((s) => ({
          meeples: [...s.meeples, { ...draft, id, messages: [], unread: false, createdAt: now, updatedAt: now }],
        }));
        return id;
      },

      updateMeeple: (id, updates) =>
        set((s) => ({
          meeples: patch(s.meeples, id, (m) => ({ ...m, ...updates, updatedAt: new Date() })),
        })),

      deleteMeeple: (id) =>
        set((s) => ({
          meeples: s.meeples.filter((m) => m.id !== id),
          workingIds: s.workingIds.filter((w) => w !== id),
        })),

      addMessage: (id, msg) =>
        set((s) => ({
          meeples: patch(s.meeples, id, (m) => ({
            ...m,
            messages: [...m.messages, msg].slice(-MAX_MESSAGES),
            unread: msg.role === 'assistant' && get().openId !== id ? true : m.unread,
            updatedAt: new Date(),
          })),
        })),

      setActionStatus: (id, messageId, index, status) =>
        set((s) => ({
          meeples: patch(s.meeples, id, (m) => ({
            ...m,
            messages: m.messages.map((msg) =>
              msg.id === messageId
                ? { ...msg, actionStatuses: { ...msg.actionStatuses, [index]: status } }
                : msg
            ),
          })),
        })),

      clearThread: (id) =>
        set((s) => ({ meeples: patch(s.meeples, id, (m) => ({ ...m, messages: [], unread: false })) })),

      setWorking: (id, working) =>
        set((s) => ({
          workingIds: working
            ? [...s.workingIds.filter((w) => w !== id), id]
            : s.workingIds.filter((w) => w !== id),
        })),

      setOpen: (id) =>
        set((s) => ({
          openId: id,
          meeples: id ? patch(s.meeples, id, (m) => (m.unread ? { ...m, unread: false } : m)) : s.meeples,
        })),
    }),
    {
      name: 'meep-meeples',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ meeples: state.meeples }),
    }
  )
);
