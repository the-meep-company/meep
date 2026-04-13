import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ChatMessage, ChatSession, ParsedItem } from '@/types';

type ChatMode = 'braindump' | 'chat';

const MAX_SESSIONS = 20;

interface ChatState {
  messages: ChatMessage[];
  currentParsedItems: ParsedItem[];
  isProcessing: boolean;
  mode: ChatMode;
  currentSessionId: string | null;
  sessions: ChatSession[];

  // Actions
  setMode: (mode: ChatMode) => void;
  addMessage: (msg: ChatMessage) => void;
  clearMessages: () => void;
  setParsedItems: (items: ParsedItem[]) => void;
  updateParsedItem: (id: string, updates: Partial<ParsedItem>) => void;
  removeParsedItem: (id: string) => void;
  confirmItem: (id: string) => void;
  confirmAllItems: () => void;
  setProcessing: (v: boolean) => void;
  startNewSession: () => void;
  loadSession: (id: string) => void;
  endSession: () => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      messages: [],
      currentParsedItems: [],
      isProcessing: false,
      mode: 'braindump',
      currentSessionId: null,
      sessions: [],

      setMode: (mode) => set({ mode }),

      addMessage: (msg) =>
        set((state) => {
          const newMessages =
            state.mode === 'braindump'
              ? [...state.messages.slice(-49), msg]
              : [...state.messages, msg];

          // Auto-save to current session in chat mode
          const sessions =
            state.mode === 'chat' && state.currentSessionId
              ? state.sessions.map((s) =>
                  s.id === state.currentSessionId
                    ? { ...s, messages: newMessages }
                    : s
                )
              : state.sessions;

          return { messages: newMessages, sessions };
        }),

      clearMessages: () => set({ messages: [], currentParsedItems: [] }),

      setParsedItems: (items) => set({ currentParsedItems: items }),

      updateParsedItem: (id, updates) =>
        set((state) => ({
          currentParsedItems: state.currentParsedItems.map((item) =>
            item.id === id ? { ...item, ...updates, status: 'edited' as const } : item
          ),
        })),

      removeParsedItem: (id) =>
        set((state) => ({
          currentParsedItems: state.currentParsedItems.map((item) =>
            item.id === id ? { ...item, status: 'deleted' as const } : item
          ),
        })),

      confirmItem: (id) =>
        set((state) => ({
          currentParsedItems: state.currentParsedItems.map((item) =>
            item.id === id ? { ...item, status: 'confirmed' as const } : item
          ),
        })),

      confirmAllItems: () =>
        set((state) => ({
          currentParsedItems: state.currentParsedItems.map((item) =>
            item.status !== 'deleted' ? { ...item, status: 'confirmed' as const } : item
          ),
        })),

      setProcessing: (v) => set({ isProcessing: v }),

      startNewSession: () => {
        const { sessions, currentSessionId, messages } = get();

        // Save current session if it has messages
        let updatedSessions = sessions;
        if (currentSessionId && messages.length > 0) {
          updatedSessions = sessions.map((s) =>
            s.id === currentSessionId ? { ...s, messages } : s
          );
        }

        const newId = Date.now().toString() + Math.random().toString(36).slice(2, 7);
        const newSession: ChatSession = {
          id: newId,
          startedAt: new Date(),
          messages: [],
        };

        // LRU eviction: keep only the most recent sessions
        const allSessions = [newSession, ...updatedSessions].slice(0, MAX_SESSIONS);

        set({
          currentSessionId: newId,
          sessions: allSessions,
          messages: [],
          mode: 'chat',
        });
      },

      loadSession: (id) => {
        const { sessions } = get();
        const session = sessions.find((s) => s.id === id);
        if (session) {
          set({
            currentSessionId: id,
            messages: session.messages,
            mode: 'chat',
          });
        }
      },

      endSession: () => {
        const { currentSessionId, messages, sessions } = get();
        if (currentSessionId && messages.length > 0) {
          set({
            sessions: sessions.map((s) =>
              s.id === currentSessionId ? { ...s, messages } : s
            ),
            currentSessionId: null,
          });
        } else {
          set({ currentSessionId: null });
        }
      },
    }),
    {
      name: 'meep-chat',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        messages: state.messages,
        sessions: state.sessions,
      }),
    }
  )
);
