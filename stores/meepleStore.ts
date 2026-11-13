import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { BotFields, Meeple, MeepleMessage } from '@/types';

const MAX_MESSAGES = 200;

export type MeepleDraft = Pick<
  Meeple,
  'name' | 'role' | 'instructions' | 'icon' | 'glow' | 'webSearch' | 'scheduleAccess'
> &
  Partial<BotFields>;

/** A plain chat meeple: never runs on its own. */
const CHAT_DEFAULTS: BotFields = { kind: 'chat', trust: 'ask', scope: [], enabled: false, pushEnabled: false };

/** Fills bot fields on meeples saved before bots existed. */
const withBotDefaults = <T extends Partial<BotFields>>(m: T) => ({ ...CHAT_DEFAULTS, ...m });

export const isBot = (m: Pick<Meeple, 'kind'>) => m.kind !== 'chat';

interface MeepleState {
  meeples: Meeple[];
  /** Meeples with a request in flight (not persisted). */
  workingIds: string[];
  /** The thread currently on screen, so its replies don't count as unread. */
  openId: string | null;

  /** Pass `id` for starter bots, which use stable ids so devices don't duplicate them. */
  addMeeple: (draft: MeepleDraft, id?: string) => string;
  updateMeeple: (id: string, updates: Partial<MeepleDraft>) => void;
  deleteMeeple: (id: string) => void;
  addMessage: (id: string, msg: MeepleMessage) => void;
  setActionStatus: (id: string, messageId: string, index: number, status: 'accepted' | 'rejected') => void;
  clearThread: (id: string) => void;
  setWorking: (id: string, working: boolean) => void;
  setOpen: (id: string | null) => void;

  // Server state (sync and Realtime); these never push back.
  setMeeples: (meeples: Meeple[]) => void;
  applyRemoteMeeple: (meeple: Omit<Meeple, 'messages'>) => void;
  applyRemoteMessage: (meepleId: string, msg: MeepleMessage) => void;
  removeRemoteMeeple: (id: string) => void;
  removeRemoteMessage: (messageId: string) => void;
}

const patch = (meeples: Meeple[], id: string, fn: (m: Meeple) => Meeple) =>
  meeples.map((m) => (m.id === id ? fn(m) : m));

// Write-through to Supabase, lazily required like the other stores.
function remote() {
  const { useAuthStore } = require('./authStore');
  const sync = require('@/lib/sync');
  const user = useAuthStore.getState().user as { id: string } | null;
  return user ? { userId: user.id, sync } : null;
}

function syncMeeple(meeple: Meeple | undefined) {
  const r = remote();
  if (r && meeple) r.sync.pushMeeple(meeple, r.userId).catch(() => {});
}

function syncMessage(meepleId: string, msg: MeepleMessage | undefined) {
  const r = remote();
  if (r && msg) r.sync.pushMeepleMessage(msg, meepleId, r.userId).catch(() => {});
}

export const useMeepleStore = create<MeepleState>()(
  persist(
    (set, get) => ({
      meeples: [],
      workingIds: [],
      openId: null,

      addMeeple: (draft, givenId) => {
        const id = givenId ?? Date.now().toString() + Math.random().toString(36).slice(2, 7);
        const now = new Date();
        set((s) => ({
          meeples: [
            ...s.meeples.filter((m) => m.id !== id),
            { ...withBotDefaults(draft), id, messages: [], unread: false, createdAt: now, updatedAt: now },
          ],
        }));
        syncMeeple(get().meeples.find((m) => m.id === id));
        return id;
      },

      updateMeeple: (id, updates) => {
        set((s) => ({
          meeples: patch(s.meeples, id, (m) => ({ ...m, ...updates, updatedAt: new Date() })),
        }));
        syncMeeple(get().meeples.find((m) => m.id === id));
      },

      deleteMeeple: (id) => {
        set((s) => ({
          meeples: s.meeples.filter((m) => m.id !== id),
          workingIds: s.workingIds.filter((w) => w !== id),
        }));
        const r = remote();
        if (r) r.sync.deleteRemoteMeeple(id).catch(() => {});
      },

      addMessage: (id, msg) => {
        const wasUnread = get().meeples.find((m) => m.id === id)?.unread;
        set((s) => ({
          meeples: patch(s.meeples, id, (m) => ({
            ...m,
            messages: [...m.messages, msg].slice(-MAX_MESSAGES),
            unread: msg.role === 'assistant' && get().openId !== id ? true : m.unread,
            updatedAt: new Date(),
          })),
        }));
        syncMessage(id, msg);
        const after = get().meeples.find((m) => m.id === id);
        if (after && after.unread !== wasUnread) syncMeeple(after);
      },

      setActionStatus: (id, messageId, index, status) => {
        set((s) => ({
          meeples: patch(s.meeples, id, (m) => ({
            ...m,
            messages: m.messages.map((msg) =>
              msg.id === messageId
                ? { ...msg, actionStatuses: { ...msg.actionStatuses, [index]: status } }
                : msg
            ),
          })),
        }));
        syncMessage(id, get().meeples.find((m) => m.id === id)?.messages.find((msg) => msg.id === messageId));
      },

      clearThread: (id) => {
        set((s) => ({ meeples: patch(s.meeples, id, (m) => ({ ...m, messages: [], unread: false })) }));
        const r = remote();
        if (r) r.sync.clearRemoteThread(id).catch(() => {});
        syncMeeple(get().meeples.find((m) => m.id === id));
      },

      setWorking: (id, working) =>
        set((s) => ({
          workingIds: working
            ? [...s.workingIds.filter((w) => w !== id), id]
            : s.workingIds.filter((w) => w !== id),
        })),

      setOpen: (id) => {
        const wasUnread = id ? get().meeples.find((m) => m.id === id)?.unread : false;
        set((s) => ({
          openId: id,
          meeples: id ? patch(s.meeples, id, (m) => (m.unread ? { ...m, unread: false } : m)) : s.meeples,
        }));
        if (id && wasUnread) syncMeeple(get().meeples.find((m) => m.id === id));
      },

      setMeeples: (meeples) => set({ meeples }),

      applyRemoteMeeple: (meeple) =>
        set((s) => {
          const existing = s.meeples.find((m) => m.id === meeple.id);
          // The open thread is being read, so it never shows as unread here.
          const unread = s.openId === meeple.id ? false : meeple.unread;
          return existing
            ? { meeples: patch(s.meeples, meeple.id, (m) => ({ ...m, ...meeple, unread })) }
            : { meeples: [...s.meeples, { ...withBotDefaults(meeple), unread, messages: [] }] };
        }),

      applyRemoteMessage: (meepleId, msg) =>
        set((s) => ({
          meeples: patch(s.meeples, meepleId, (m) => {
            const exists = m.messages.some((x) => x.id === msg.id);
            const messages = exists
              ? m.messages.map((x) => (x.id === msg.id ? msg : x))
              : [...m.messages, msg].slice(-MAX_MESSAGES);
            return { ...m, messages };
          }),
        })),

      removeRemoteMeeple: (id) =>
        set((s) => ({
          meeples: s.meeples.filter((m) => m.id !== id),
          workingIds: s.workingIds.filter((w) => w !== id),
        })),

      removeRemoteMessage: (messageId) =>
        set((s) => ({
          meeples: s.meeples.map((m) =>
            m.messages.some((x) => x.id === messageId)
              ? { ...m, messages: m.messages.filter((x) => x.id !== messageId) }
              : m
          ),
        })),
    }),
    {
      name: 'meep-meeples',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ meeples: state.meeples }),
      merge: (persisted, current) => ({
        ...current,
        meeples: ((persisted as { meeples?: Meeple[] })?.meeples ?? []).map(withBotDefaults),
      }),
    }
  )
);
