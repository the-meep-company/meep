import { useState } from 'react';
import {
  StyleSheet, View, Text, TextInput, TouchableOpacity,
  Modal, ScrollView, Platform,
} from 'react-native';
import { format, addHours, setHours, setMinutes } from 'date-fns';
import { useThemeStore } from '@/stores/themeStore';
import { useCalendarStore } from '@/stores/calendarStore';
import { useColorStore } from '@/stores/colorStore';
import { EVENT_COLORS, type CalendarEvent } from '@/types';

interface EventFormModalProps {
  visible: boolean;
  initialDate?: Date;
  editEvent?: CalendarEvent | null;
  onClose: () => void;
}

export default function EventFormModal({
  visible,
  initialDate,
  editEvent,
  onClose,
}: EventFormModalProps) {
  const { theme } = useThemeStore();
  const { addEvent, updateEvent, deleteEvent } = useCalendarStore();

  const defaultStart = initialDate ?? new Date();
  const defaultEnd = addHours(defaultStart, 1);

  const [title, setTitle] = useState(editEvent?.title ?? '');
  const [description, setDescription] = useState(editEvent?.description ?? '');
  const [startHour, setStartHour] = useState(
    editEvent ? new Date(editEvent.startTime).getHours() : defaultStart.getHours()
  );
  const [endHour, setEndHour] = useState(
    editEvent ? new Date(editEvent.endTime).getHours() : defaultEnd.getHours()
  );
  const [selectedColor, setSelectedColor] = useState(
    editEvent?.color ?? EVENT_COLORS[0]
  );

  const handleSave = () => {
    if (!title.trim()) return;

    const baseDate = initialDate ?? (editEvent ? new Date(editEvent.startTime) : new Date());
    const startTime = setMinutes(setHours(baseDate, startHour), 0);
    const endTime = setMinutes(setHours(baseDate, endHour), 0);

    if (editEvent) {
      updateEvent(editEvent.id, {
        title: title.trim(),
        description: description.trim() || undefined,
        startTime,
        endTime,
        color: selectedColor,
      });
    } else {
      const newEvent: CalendarEvent = {
        id: Date.now().toString() + Math.random().toString(36).slice(2, 7),
        title: title.trim(),
        description: description.trim() || undefined,
        startTime,
        endTime,
        allDay: false,
        color: selectedColor,
        source: 'local',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      addEvent(newEvent);
    }

    // Learn color preference when the user has made a meaningful manual choice.
    // Events have no category field, so key learning off the title.
    const trimmedTitle = title.trim();
    if (trimmedTitle) {
      const isMeaningfulChange = editEvent
        ? selectedColor !== editEvent.color
        : selectedColor !== EVENT_COLORS[0];
      if (isMeaningfulChange) {
        useColorStore.getState().learnColorPreference(trimmedTitle, selectedColor);
      }
    }

    resetAndClose();
  };

  const handleDelete = () => {
    if (editEvent) {
      deleteEvent(editEvent.id);
    }
    resetAndClose();
  };

  const resetAndClose = () => {
    setTitle('');
    setDescription('');
    setSelectedColor(EVENT_COLORS[0]);
    onClose();
  };

  const formatHour = (h: number) =>
    h === 0 ? '12:00 AM' : h < 12 ? `${h}:00 AM` : h === 12 ? '12:00 PM' : `${h - 12}:00 PM`;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View
          style={[
            styles.modal,
            {
              backgroundColor: theme.colors.surface,
              borderRadius: theme.borderRadius.lg,
            },
          ]}
        >
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity onPress={resetAndClose}>
                <Text style={{ color: theme.colors.textSecondary, fontSize: 16 }}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
                {editEvent ? 'Edit Event' : 'New Event'}
              </Text>
              <TouchableOpacity onPress={handleSave}>
                <Text
                  style={{
                    color: title.trim() ? theme.colors.primary : theme.colors.textTertiary,
                    fontSize: 16,
                    fontWeight: '600',
                  }}
                >
                  Save
                </Text>
              </TouchableOpacity>
            </View>

            {/* Title */}
            <TextInput
              style={[
                styles.titleInput,
                {
                  color: theme.colors.text,
                  borderBottomColor: theme.colors.border,
                },
              ]}
              placeholder="Event title"
              placeholderTextColor={theme.colors.textTertiary}
              value={title}
              onChangeText={setTitle}
              autoFocus
            />

            {/* Description */}
            <TextInput
              style={[
                styles.descInput,
                {
                  color: theme.colors.text,
                  backgroundColor: theme.colors.surfaceSecondary,
                  borderRadius: theme.borderRadius.sm,
                },
              ]}
              placeholder="Description (optional)"
              placeholderTextColor={theme.colors.textTertiary}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
            />

            {/* Time pickers (simplified hour selectors) */}
            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
              Time
            </Text>
            <View style={styles.timeRow}>
              <View style={styles.timePicker}>
                <Text style={[styles.timeLabel, { color: theme.colors.textTertiary }]}>
                  Start
                </Text>
                <View style={styles.hourButtons}>
                  <TouchableOpacity
                    onPress={() => setStartHour((h) => (h - 1 + 24) % 24)}
                  >
                    <Text style={[styles.hourArrow, { color: theme.colors.primary }]}>
                      ‹
                    </Text>
                  </TouchableOpacity>
                  <Text style={[styles.hourText, { color: theme.colors.text }]}>
                    {formatHour(startHour)}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setStartHour((h) => (h + 1) % 24)}
                  >
                    <Text style={[styles.hourArrow, { color: theme.colors.primary }]}>
                      ›
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={[styles.timeDash, { color: theme.colors.textTertiary }]}>
                –
              </Text>

              <View style={styles.timePicker}>
                <Text style={[styles.timeLabel, { color: theme.colors.textTertiary }]}>
                  End
                </Text>
                <View style={styles.hourButtons}>
                  <TouchableOpacity
                    onPress={() => setEndHour((h) => (h - 1 + 24) % 24)}
                  >
                    <Text style={[styles.hourArrow, { color: theme.colors.primary }]}>
                      ‹
                    </Text>
                  </TouchableOpacity>
                  <Text style={[styles.hourText, { color: theme.colors.text }]}>
                    {formatHour(endHour)}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setEndHour((h) => (h + 1) % 24)}
                  >
                    <Text style={[styles.hourArrow, { color: theme.colors.primary }]}>
                      ›
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Color picker */}
            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
              Color
            </Text>
            <View style={styles.colorRow}>
              {EVENT_COLORS.map((color) => (
                <TouchableOpacity
                  key={color}
                  onPress={() => setSelectedColor(color)}
                  style={[
                    styles.colorDot,
                    {
                      backgroundColor: color,
                      borderWidth: selectedColor === color ? 3 : 0,
                      borderColor: theme.colors.text,
                    },
                  ]}
                />
              ))}
            </View>

            {/* Delete button (edit mode only) */}
            {editEvent && (
              <TouchableOpacity
                onPress={handleDelete}
                style={[
                  styles.deleteBtn,
                  {
                    backgroundColor: theme.colors.error + '15',
                    borderRadius: theme.borderRadius.md,
                  },
                ]}
              >
                <Text style={{ color: theme.colors.error, fontWeight: '600' }}>
                  Delete Event
                </Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modal: {
    maxHeight: '85%',
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  titleInput: {
    fontSize: 22,
    fontWeight: '600',
    paddingVertical: 12,
    borderBottomWidth: 1,
    marginBottom: 16,
  },
  descInput: {
    fontSize: 15,
    padding: 12,
    minHeight: 60,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  timePicker: {
    flex: 1,
    alignItems: 'center',
  },
  timeLabel: {
    fontSize: 11,
    marginBottom: 4,
  },
  hourButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  hourArrow: {
    fontSize: 24,
    fontWeight: '300',
    paddingHorizontal: 8,
  },
  hourText: {
    fontSize: 16,
    fontWeight: '600',
    minWidth: 80,
    textAlign: 'center',
  },
  timeDash: {
    fontSize: 18,
    paddingHorizontal: 8,
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  colorDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  deleteBtn: {
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
});
