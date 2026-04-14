import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  addDays, addMonths, subDays, subMonths, isWithinInterval, isSameDay,
} from 'date-fns';
import type { CalendarEvent, CalendarView } from '@/types';

interface CalendarState {
  // View state
  currentView: CalendarView;
  selectedDate: Date;
  events: CalendarEvent[];

  // Actions
  setView: (view: CalendarView) => void;
  setSelectedDate: (date: Date) => void;
  goToToday: () => void;
  goForward: () => void;
  goBack: () => void;
  addEvent: (event: CalendarEvent) => void;
  updateEvent: (id: string, updates: Partial<CalendarEvent>) => void;
  deleteEvent: (id: string) => void;
  setEvents: (events: CalendarEvent[]) => void;
  batchUpsertEvents: (events: CalendarEvent[], deletedIds?: string[]) => void;

  // Selectors
  getEventsForDate: (date: Date) => CalendarEvent[];
  getEventsForRange: (start: Date, end: Date) => CalendarEvent[];
}

function syncEvent(event: CalendarEvent) {
  // Lazy imports to avoid circular dependency
  const { useAuthStore } = require('./authStore');
  const { pushEvent } = require('@/lib/sync');
  const user = useAuthStore.getState().user;
  if (user) pushEvent(event, user.id).catch(() => {});
}

function syncDeleteEvent(id: string) {
  const { useAuthStore } = require('./authStore');
  const { deleteRemoteEvent } = require('@/lib/sync');
  const user = useAuthStore.getState().user;
  if (user) deleteRemoteEvent(id).catch(() => {});
}

export const useCalendarStore = create<CalendarState>()(
  persist(
    (set, get) => ({
      currentView: 'week',
      selectedDate: new Date(),
      events: [],

      setView: (view) => set({ currentView: view }),
      setSelectedDate: (date) => set({ selectedDate: date }),
      goToToday: () => set({ selectedDate: new Date() }),

      goForward: () => {
        const { currentView, selectedDate } = get();
        if (currentView === 'day') set({ selectedDate: addDays(selectedDate, 1) });
        else if (currentView === 'week') set({ selectedDate: addDays(selectedDate, 7) });
        else set({ selectedDate: addMonths(selectedDate, 1) });
      },

      goBack: () => {
        const { currentView, selectedDate } = get();
        if (currentView === 'day') set({ selectedDate: subDays(selectedDate, 1) });
        else if (currentView === 'week') set({ selectedDate: subDays(selectedDate, 7) });
        else set({ selectedDate: subMonths(selectedDate, 1) });
      },

      addEvent: (event) => {
        set((state) => ({ events: [...state.events, event] }));
        syncEvent(event);
      },

      updateEvent: (id, updates) => {
        set((state) => ({
          events: state.events.map((e) =>
            e.id === id ? { ...e, ...updates, updatedAt: new Date() } : e
          ),
        }));
        const updated = get().events.find((e) => e.id === id);
        if (updated) syncEvent(updated);
      },

      deleteEvent: (id) => {
        set((state) => ({ events: state.events.filter((e) => e.id !== id) }));
        syncDeleteEvent(id);
      },

      setEvents: (events) => set({ events }),

      batchUpsertEvents: (incoming, deletedIds = []) =>
        set((state) => {
          const deletedSet = new Set(deletedIds);
          const existingById = new Map(state.events.map((e) => [e.id, e]));
          for (const event of incoming) {
            existingById.set(event.id, event);
          }
          const result = [...existingById.values()].filter(
            (e) => !deletedSet.has(e.id)
          );
          return { events: result };
        }),

      getEventsForDate: (date) => {
        const dayStart = startOfDay(date);
        const dayEnd = endOfDay(date);
        return get().events.filter((e) => {
          const eventStart = new Date(e.startTime);
          const eventEnd = new Date(e.endTime);
          return (
            isWithinInterval(eventStart, { start: dayStart, end: dayEnd }) ||
            isWithinInterval(dayStart, { start: eventStart, end: eventEnd })
          );
        });
      },

      getEventsForRange: (start, end) => {
        return get().events.filter((e) => {
          const eventStart = new Date(e.startTime);
          const eventEnd = new Date(e.endTime);
          return (
            isWithinInterval(eventStart, { start, end }) ||
            isWithinInterval(start, { start: eventStart, end: eventEnd })
          );
        });
      },
    }),
    {
      name: 'meep-calendar',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        events: state.events,
        currentView: state.currentView,
      }),
    }
  )
);
