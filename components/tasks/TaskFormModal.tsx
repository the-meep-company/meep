import { useState } from 'react';
import { PRIORITY } from '@/lib/semanticColors';
import {
  StyleSheet, View, Text, TextInput, TouchableOpacity,
  Modal, ScrollView, Platform,
} from 'react-native';
import { useThemeStore } from '@/stores/themeStore';
import { useTaskStore } from '@/stores/taskStore';
import { useColorStore } from '@/stores/colorStore';
import { EVENT_COLORS, type Task, type TaskPriority } from '@/types';
import { useReduceMotion, hitSlopFor, a11yState } from '@/lib/accessibility';

// Spoken names for the swatches in EVENT_COLORS (screen readers can't describe a hex).
const COLOR_NAMES: Record<string, string> = {
  '#6C5CE7': 'purple',
  '#FF6B6B': 'coral',
  '#4ECDC4': 'teal',
  '#FFD93D': 'yellow',
  '#2563EB': 'blue',
  '#10B981': 'green',
  '#F59E0B': 'amber',
  '#EF4444': 'red',
  '#8B5CF6': 'violet',
  '#EC4899': 'pink',
};

interface TaskFormModalProps {
  visible: boolean;
  editTask?: Task | null;
  onClose: () => void;
}

const PRIORITIES: { value: TaskPriority; label: string; color: string }[] = ([1, 2, 3, 4] as const).map(
  (value) => ({ value, label: PRIORITY[value].name, color: PRIORITY[value].color })
);

export default function TaskFormModal({ visible, editTask, onClose }: TaskFormModalProps) {
  const { theme } = useThemeStore();
  const reduceMotion = useReduceMotion();
  const { addTask, updateTask, deleteTask } = useTaskStore();

  const [title, setTitle] = useState(editTask?.title ?? '');
  const [description, setDescription] = useState(editTask?.description ?? '');
  const [priority, setPriority] = useState<TaskPriority>(editTask?.priority ?? 3);
  const [category, setCategory] = useState(editTask?.category ?? '');
  const [selectedColor, setSelectedColor] = useState(editTask?.color ?? EVENT_COLORS[0]);

  const handleSave = () => {
    if (!title.trim()) return;

    const trimmedCategory = category.trim();

    if (editTask) {
      updateTask(editTask.id, {
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        category: trimmedCategory || undefined,
        color: selectedColor,
      });
    } else {
      const newTask: Task = {
        id: Date.now().toString() + Math.random().toString(36).slice(2, 7),
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        category: trimmedCategory || undefined,
        color: selectedColor,
        status: 'todo',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      addTask(newTask);
    }

    // Learn color preference when the user has made a meaningful manual choice
    if (trimmedCategory) {
      const isMeaningfulChange = editTask
        ? selectedColor !== editTask.color
        : selectedColor !== EVENT_COLORS[0];
      if (isMeaningfulChange) {
        useColorStore.getState().learnColorPreference(trimmedCategory, selectedColor);
      }
    }

    resetAndClose();
  };

  const handleDelete = () => {
    if (editTask) {
      deleteTask(editTask.id);
    }
    resetAndClose();
  };

  const resetAndClose = () => {
    setTitle('');
    setDescription('');
    setPriority(3);
    setCategory('');
    setSelectedColor(EVENT_COLORS[0]);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType={reduceMotion ? 'none' : 'slide'}
      transparent
      onRequestClose={resetAndClose}
    >
      <View style={styles.overlay}>
        <View
          accessibilityViewIsModal
          style={[
            styles.modal,
            {
              backgroundColor: theme.colors.surfaceOpaque, // sheets must be solid: glass `surface` is see-through
              borderRadius: theme.borderRadius.lg,
            },
          ]}
        >
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity
                onPress={resetAndClose}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
                hitSlop={hitSlopFor(20)}
              >
                <Text style={{ color: theme.colors.textSecondary, fontSize: 16 }}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <Text
                accessibilityRole="header"
                style={[styles.headerTitle, { color: theme.colors.text }]}
              >
                {editTask ? 'Edit Task' : 'New Task'}
              </Text>
              <TouchableOpacity
                onPress={handleSave}
                accessibilityRole="button"
                accessibilityLabel="Save task"
                {...a11yState({ disabled: !title.trim() })}
                hitSlop={hitSlopFor(20)}
              >
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
              placeholder="Task title"
              accessibilityLabel="Task title"
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
              accessibilityLabel="Description, optional"
              placeholderTextColor={theme.colors.textTertiary}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
            />

            {/* Category */}
            <TextInput
              style={[
                styles.categoryInput,
                {
                  color: theme.colors.text,
                  backgroundColor: theme.colors.surfaceSecondary,
                  borderRadius: theme.borderRadius.sm,
                },
              ]}
              placeholder="Category (optional, e.g. Work, Personal)"
              accessibilityLabel="Category, optional"
              placeholderTextColor={theme.colors.textTertiary}
              value={category}
              onChangeText={setCategory}
            />

            {/* Priority picker */}
            <Text
              accessibilityRole="header"
              style={[styles.label, { color: theme.colors.textSecondary }]}
            >
              Priority
            </Text>
            <View
              style={styles.priorityRow}
              accessibilityRole="radiogroup"
              accessibilityLabel="Priority"
            >
              {PRIORITIES.map((p) => (
                <TouchableOpacity
                  key={p.value}
                  onPress={() => setPriority(p.value)}
                  accessibilityRole="radio"
                  accessibilityLabel={`${p.label} priority`}
                  {...a11yState({ checked: priority === p.value })}
                  hitSlop={hitSlopFor(36)}
                  style={[
                    styles.priorityBtn,
                    {
                      backgroundColor:
                        priority === p.value ? p.color + '20' : theme.colors.surfaceSecondary,
                      borderColor: priority === p.value ? p.color : 'transparent',
                      borderWidth: priority === p.value ? 1.5 : 0,
                      borderRadius: theme.borderRadius.sm,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.priorityLabel,
                      { color: priority === p.value ? p.color : theme.colors.textSecondary },
                    ]}
                  >
                    {p.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Color picker */}
            <Text
              accessibilityRole="header"
              style={[styles.label, { color: theme.colors.textSecondary }]}
            >
              Color
            </Text>
            <View
              style={styles.colorRow}
              accessibilityRole="radiogroup"
              accessibilityLabel="Task color"
            >
              {EVENT_COLORS.map((color) => (
                <TouchableOpacity
                  key={color}
                  onPress={() => setSelectedColor(color)}
                  accessibilityRole="radio"
                  accessibilityLabel={`Color: ${COLOR_NAMES[color] ?? color}`}
                  {...a11yState({ checked: selectedColor === color })}
                  hitSlop={hitSlopFor(28)}
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
            {editTask && (
              <TouchableOpacity
                onPress={handleDelete}
                accessibilityRole="button"
                accessibilityLabel="Delete task"
                style={[
                  styles.deleteBtn,
                  {
                    backgroundColor: theme.colors.error + '15',
                    borderRadius: theme.borderRadius.md,
                  },
                ]}
              >
                <Text style={{ color: theme.colors.error, fontWeight: '600' }}>
                  Delete Task
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
    marginBottom: 12,
  },
  categoryInput: {
    fontSize: 15,
    padding: 12,
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  priorityRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  priorityBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  priorityLabel: {
    fontSize: 13,
    fontWeight: '600',
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
