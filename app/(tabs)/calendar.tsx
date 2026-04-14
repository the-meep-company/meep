import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useThemeStore } from '@/stores/themeStore';
import { useCalendarStore } from '@/stores/calendarStore';
import { useSyncStore } from '@/stores/syncStore';
import { performSync } from '@/lib/googleCalendar';
import CalendarHeader from '@/components/calendar/CalendarHeader';
import DayView from '@/components/calendar/DayView';
import WeekView from '@/components/calendar/WeekView';
import MonthView from '@/components/calendar/MonthView';
import EventFormModal from '@/components/calendar/EventFormModal';
import type { CalendarEvent } from '@/types';

// Placeholder until Person A's authStore provides the real token
const PLACEHOLDER_TOKEN = 'mock';

export default function CalendarScreen() {
  const { theme } = useThemeStore();
  const { currentView, events, batchUpsertEvents } = useCalendarStore();
  const {
    googleCalendars,
    selectedCalendarIds,
    syncState,
    setSyncing,
    setSyncError,
    setLastSync,
  } = useSyncStore();

  const [showEventForm, setShowEventForm] = useState(false);
  const [selectedSlotDate, setSelectedSlotDate] = useState<Date | undefined>();
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  // Persist sync tokens in a ref (survives re-renders, reset on unmount)
  const syncTokensRef = useRef<Record<string, string>>({});

  // Auto-sync on mount when Google is connected
  useEffect(() => {
    const isConnected = googleCalendars.length > 0 && selectedCalendarIds.length > 0;
    if (!isConnected || syncState.isSyncing) return;

    performSync({
      accessToken: PLACEHOLDER_TOKEN,
      googleCalendars,
      selectedCalendarIds,
      syncTokens: syncTokensRef.current,
      existingEvents: events,
      onSyncStart: () => setSyncing(true),
      onSyncSuccess: (nextTokens) => {
        syncTokensRef.current = { ...syncTokensRef.current, ...nextTokens };
        setSyncing(false);
        setLastSync(new Date());
      },
      onSyncError: (err) => {
        setSyncing(false);
        setSyncError(err);
      },
      batchUpsertEvents,
      setLastSync,
    });
    // Run once on mount only — dependency array intentionally empty
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // TODO: add pull-to-refresh by threading RefreshControl into DayView,
  // WeekView, and MonthView ScrollViews (pass onRefresh + refreshing props)

  const handleTimeSlotPress = (date: Date) => {
    setSelectedSlotDate(date);
    setEditingEvent(null);
    setShowEventForm(true);
  };

  const handleEventPress = (event: CalendarEvent) => {
    setEditingEvent(event);
    setSelectedSlotDate(undefined);
    setShowEventForm(true);
  };

  const handleCloseModal = () => {
    setShowEventForm(false);
    setEditingEvent(null);
    setSelectedSlotDate(undefined);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <CalendarHeader />

      {currentView === 'day' && (
        <DayView
          onTimeSlotPress={handleTimeSlotPress}
          onEventPress={handleEventPress}
        />
      )}
      {currentView === 'week' && (
        <WeekView
          onTimeSlotPress={handleTimeSlotPress}
          onEventPress={handleEventPress}
        />
      )}
      {currentView === 'month' && (
        <MonthView />
      )}

      <EventFormModal
        visible={showEventForm}
        initialDate={selectedSlotDate}
        editEvent={editingEvent}
        onClose={handleCloseModal}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
