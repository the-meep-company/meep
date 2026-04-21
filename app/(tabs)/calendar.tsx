import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { addDays, startOfDay, endOfDay } from 'date-fns';
import { useThemeStore } from '@/stores/themeStore';
import { useAuthStore } from '@/stores/authStore';
import { useCalendarStore } from '@/stores/calendarStore';
import { useSyncStore } from '@/stores/syncStore';
import { performSync } from '@/lib/googleCalendar';
import { useTaskStore } from '@/stores/taskStore';
import { usePatternStore } from '@/stores/patternStore';
import { detectConflictingTasks, autoScheduleTasks } from '@/lib/scheduler';
import CalendarHeader from '@/components/calendar/CalendarHeader';
import DayView from '@/components/calendar/DayView';
import WeekView from '@/components/calendar/WeekView';
import MonthView from '@/components/calendar/MonthView';
import EventFormModal from '@/components/calendar/EventFormModal';
import ReorganizeConfirmModal from '@/components/scheduling/ReorganizeConfirmModal';
import type { CalendarEvent, ReorganizePlacement, Task } from '@/types';

export default function CalendarScreen() {
  const { theme } = useThemeStore();
  const { googleToken } = useAuthStore();
  const { currentView, events, getEventsForRange, updateEvent, batchUpsertEvents } = useCalendarStore();
  const {
    googleCalendars,
    selectedCalendarIds,
    syncState,
    setSyncing,
    setSyncError,
    setLastSync,
  } = useSyncStore();
  const { tasks, updateTask } = useTaskStore();
  const { patterns } = usePatternStore();

  const [showEventForm, setShowEventForm] = useState(false);
  const [selectedSlotDate, setSelectedSlotDate] = useState<Date | undefined>();
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  const [reorganizeVisible, setReorganizeVisible] = useState(false);
  const [reorganizePlacements, setReorganizePlacements] = useState<ReorganizePlacement[]>([]);
  const [reorganizeUnplaceable, setReorganizeUnplaceable] = useState<{ task: Task; reason: string }[]>([]);

  // Persist sync tokens in a ref (survives re-renders, reset on unmount)
  const syncTokensRef = useRef<Record<string, string>>({});

  // Auto-sync on mount when Google is connected
  useEffect(() => {
    const isConnected = googleCalendars.length > 0 && selectedCalendarIds.length > 0;
    if (!isConnected || syncState.isSyncing || !googleToken) return;

    performSync({
      accessToken: googleToken ?? '',
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

  const checkAndReorganize = (newEvent: CalendarEvent) => {
    const conflicting = detectConflictingTasks(newEvent, tasks, events);
    if (conflicting.length === 0) return;

    const eventDay = startOfDay(new Date(newEvent.startTime));
    const windowEnd = endOfDay(addDays(eventDay, 1));
    const windowEvents = getEventsForRange(eventDay, windowEnd);

    const result = autoScheduleTasks({
      tasks: conflicting.map((c) => c.task),
      existingEvents: windowEvents,
      habitEvents: [],
      patterns,
      dateRange: { start: eventDay, end: windowEnd },
      workingHours: { startHour: 8, endHour: 21 },
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });

    if (result.placements.length === 0 && result.unplaceable.length === 0) return;

    setReorganizePlacements(
      result.placements.map((p) => {
        const orig = conflicting.find((c) => c.task.id === p.taskId)!;
        return {
          task: p.task,
          calendarEventId: orig.calendarEventId,
          oldStart: orig.oldStart,
          oldEnd: orig.oldEnd,
          newStart: p.proposedStart,
          newEnd: p.proposedEnd,
          reason: p.reason,
          confidence: p.confidence,
        };
      })
    );
    setReorganizeUnplaceable(
      result.unplaceable.map((u) => ({ task: u.task, reason: u.reason }))
    );
    setReorganizeVisible(true);
  };

  const handleReorganizeAccept = (p: ReorganizePlacement) => {
    updateTask(p.task.id, { scheduledStart: p.newStart, scheduledEnd: p.newEnd });
    if (p.calendarEventId) {
      updateEvent(p.calendarEventId, { startTime: p.newStart, endTime: p.newEnd });
    }
  };

  const handleReorganizeAcceptAll = () => {
    reorganizePlacements.forEach(handleReorganizeAccept);
  };

  const handleReorganizeReject = (_taskId: string) => {
    // task keeps its original times — conflict remains by user choice
  };

  const handleReorganizeClose = () => {
    setReorganizeVisible(false);
    setReorganizePlacements([]);
    setReorganizeUnplaceable([]);
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
        onEventSaved={checkAndReorganize}
      />

      <ReorganizeConfirmModal
        visible={reorganizeVisible}
        placements={reorganizePlacements}
        unplaceable={reorganizeUnplaceable}
        onAccept={handleReorganizeAccept}
        onReject={handleReorganizeReject}
        onAcceptAll={handleReorganizeAcceptAll}
        onClose={handleReorganizeClose}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
