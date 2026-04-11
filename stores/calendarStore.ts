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

  // Selectors
  getEventsForDate: (date: Date) => CalendarEvent[];
  getEventsForRange: (start: Date, end: Date) => CalendarEvent[];
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

      addEvent: (event) =>
        set((state) => ({ events: [...state.events, event] })),

      updateEvent: (id, updates) =>
        set((state) => ({
          events: state.events.map((e) =>
            e.id === id ? { ...e, ...updates, updatedAt: new Date() } : e
          ),
        })),

      deleteEvent: (id) =>
        set((state) => ({ events: state.events.filter((e) => e.id !== id) })),

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
