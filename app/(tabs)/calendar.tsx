import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { setHours, setMinutes } from 'date-fns';
import { useThemeStore } from '@/stores/themeStore';
import { useCalendarStore } from '@/stores/calendarStore';
import CalendarHeader from '@/components/calendar/CalendarHeader';
import DayView from '@/components/calendar/DayView';
import WeekView from '@/components/calendar/WeekView';
import MonthView from '@/components/calendar/MonthView';
import EventFormModal from '@/components/calendar/EventFormModal';
import type { CalendarEvent } from '@/types';

export default function CalendarScreen() {
  const { theme } = useThemeStore();
  const { currentView } = useCalendarStore();

  const [showEventForm, setShowEventForm] = useState(false);
  const [selectedSlotDate, setSelectedSlotDate] = useState<Date | undefined>();
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

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
