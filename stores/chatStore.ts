import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ChatMessage, ParsedItem } from '@/types';

type ChatMode = 'braindump' | 'chat';

interface ChatState {
  messages: ChatMessage[];
  currentParsedItems: ParsedItem[];
  isProcessing: boolean;
  mode: ChatMode;

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
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      messages: [],
      currentParsedItems: [],
      isProcessing: false,
      mode: 'braindump',

      setMode: (mode) => set({ mode }),

      addMessage: (msg) =>
        set((state) => ({
          messages: [...state.messages.slice(-49), msg],
        })),

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
    }),
    {
      name: 'meep-chat',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ messages: state.messages }),
    }
  )
);
