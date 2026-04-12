import { useState, useEffect } from 'react';
import {
  StyleSheet, View, Text, TextInput, TouchableOpacity, Modal, ScrollView,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useThemeStore } from '@/stores/themeStore';
import type { ParsedItem, HabitFrequency, TaskPriority } from '@/types';

interface ItemEditModalProps {
  item: ParsedItem | null;
  visible: boolean;
  onClose: () => void;
  onSave: (id: string, updates: Partial<ParsedItem>) => void;
}

const PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: 1, label: 'P1 - Urgent' },
  { value: 2, label: 'P2 - Important' },
  { value: 3, label: 'P3 - Normal' },
  { value: 4, label: 'P4 - Low' },
];

const FREQUENCIES: { value: HabitFrequency; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekdays', label: 'Weekdays' },
  { value: 'weekends', label: 'Weekends' },
  { value: 'custom', label: 'Custom' },
];

export default function ItemEditModal({ item, visible, onClose, onSave }: ItemEditModalProps) {
  const { theme } = useThemeStore();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>(3);
  const [frequency, setFrequency] = useState<HabitFrequency>('daily');
  const [startTime, setStartTime] = useState('07:00');
  const [durationMinutes, setDurationMinutes] = useState('30');

  useEffect(() => {
    if (!item) return;
    switch (item.type) {
      case 'event':
        setTitle(item.event?.title || '');
        setDescription(item.event?.description || '');
        break;
      case 'task':
        setTitle(item.task?.title || '');
        setDescription(item.task?.description || '');
        setPriority(item.task?.priority ?? 3);
        break;
      case 'goal':
        setTitle(item.goal?.title || '');
        setDescription(item.goal?.description || '');
        break;
      case 'habit':
        setTitle(item.habit?.title || '');
        setDescription(item.habit?.description || '');
        setFrequency(item.habit?.frequency ?? 'daily');
        setStartTime(item.habit?.startTime ?? '07:00');
        setDurationMinutes(String(item.habit?.durationMinutes ?? 30));
        break;
    }
  }, [item]);

  const handleSave = () => {
    if (!item) return;
    const updates: Partial<ParsedItem> = {};

    switch (item.type) {
      case 'event':
        updates.event = { ...item.event, title, description: description || undefined };
        break;
      case 'task':
        updates.task = { ...item.task, title, description: description || undefined, priority };
        break;
      case 'goal':
        updates.goal = { ...item.goal, title, description: description || undefined };
        break;
      case 'habit':
        updates.habit = {
          ...item.habit,
          title,
          description: description || undefined,
          frequency,
          startTime,
          durationMinutes: parseInt(durationMinutes) || 30,
        };
        break;
    }

    onSave(item.id, updates);
    onClose();
  };

  if (!item) return null;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View
          style={[
            styles.modal,
            {
              backgroundColor: theme.colors.background,
              borderTopLeftRadius: theme.borderRadius.lg,
              borderTopRightRadius: theme.borderRadius.lg,
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
              Edit {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <FontAwesome name="times" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Title */}
            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Title</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.colors.surface,
                  color: theme.colors.text,
                  borderColor: theme.colors.border,
                  borderRadius: theme.borderRadius.sm,
                },
              ]}
              value={title}
              onChangeText={setTitle}
              placeholder="Title"
              placeholderTextColor={theme.colors.textTertiary}
            />

            {/* Description */}
            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Description</Text>
            <TextInput
              style={[
                styles.input,
                styles.multilineInput,
                {
                  backgroundColor: theme.colors.surface,
                  color: theme.colors.text,
                  borderColor: theme.colors.border,
                  borderRadius: theme.borderRadius.sm,
                },
              ]}
              value={description}
              onChangeText={setDescription}
              placeholder="Description (optional)"
              placeholderTextColor={theme.colors.textTertiary}
              multiline
            />

            {/* Task-specific: Priority */}
            {item.type === 'task' && (
              <>
                <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Priority</Text>
                <View style={styles.optionRow}>
                  {PRIORITIES.map((p) => (
                    <TouchableOpacity
                      key={p.value}
                      onPress={() => setPriority(p.value)}
                      style={[
                        styles.optionButton,
                        {
                          backgroundColor: priority === p.value ? theme.colors.primary : theme.colors.surface,
                          borderRadius: theme.borderRadius.sm,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          { color: priority === p.value ? '#FFF' : theme.colors.textSecondary },
                        ]}
                      >
                        {p.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {/* Habit-specific fields */}
            {item.type === 'habit' && (
              <>
                <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Frequency</Text>
                <View style={styles.optionRow}>
                  {FREQUENCIES.map((f) => (
                    <TouchableOpacity
                      key={f.value}
                      onPress={() => setFrequency(f.value)}
                      style={[
                        styles.optionButton,
                        {
                          backgroundColor: frequency === f.value ? theme.colors.primary : theme.colors.surface,
                          borderRadius: theme.borderRadius.sm,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          { color: frequency === f.value ? '#FFF' : theme.colors.textSecondary },
                        ]}
                      >
                        {f.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Time (HH:MM)</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.colors.surface,
                      color: theme.colors.text,
                      borderColor: theme.colors.border,
                      borderRadius: theme.borderRadius.sm,
                    },
                  ]}
                  value={startTime}
                  onChangeText={setStartTime}
                  placeholder="07:00"
                  placeholderTextColor={theme.colors.textTertiary}
                />

                <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Duration (minutes)</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.colors.surface,
                      color: theme.colors.text,
                      borderColor: theme.colors.border,
                      borderRadius: theme.borderRadius.sm,
                    },
                  ]}
                  value={durationMinutes}
                  onChangeText={setDurationMinutes}
                  placeholder="30"
                  placeholderTextColor={theme.colors.textTertiary}
                  keyboardType="numeric"
                />
              </>
            )}
          </ScrollView>

          {/* Save button */}
          <TouchableOpacity
            onPress={handleSave}
            style={[
              styles.saveButton,
              { backgroundColor: theme.colors.primary, borderRadius: theme.borderRadius.md },
            ]}
          >
            <Text style={styles.saveText}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modal: {
    maxHeight: '80%',
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 6,
    marginTop: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    padding: 12,
    fontSize: 15,
    borderWidth: 1,
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  optionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  saveButton: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  saveText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
