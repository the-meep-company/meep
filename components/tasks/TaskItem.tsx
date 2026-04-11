import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { useThemeStore } from '@/stores/themeStore';
import { useTaskStore } from '@/stores/taskStore';
import type { Task } from '@/types';

const PRIORITY_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: 'P1', color: '#EF4444' },
  2: { label: 'P2', color: '#F59E0B' },
  3: { label: 'P3', color: '#2563EB' },
  4: { label: 'P4', color: '#9CA3AF' },
};

interface TaskItemProps {
  task: Task;
  onPress: (task: Task) => void;
}

export default function TaskItem({ task, onPress }: TaskItemProps) {
  const { theme } = useThemeStore();
  const { toggleStatus, getSubtasks } = useTaskStore();
  const isDone = task.status === 'done';
  const subtasks = getSubtasks(task.id);
  const priority = PRIORITY_LABELS[task.priority];

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.borderRadius.md,
        },
      ]}
      onPress={() => onPress(task)}
      activeOpacity={0.7}
    >
      {/* Checkbox */}
      <TouchableOpacity
        style={[
          styles.checkbox,
          {
            borderColor: isDone ? theme.colors.primary : theme.colors.border,
            backgroundColor: isDone ? theme.colors.primary : 'transparent',
          },
        ]}
        onPress={() => toggleStatus(task.id)}
      >
        {isDone && <Text style={styles.checkmark}>✓</Text>}
      </TouchableOpacity>

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text
            style={[
              styles.title,
              {
                color: isDone ? theme.colors.textTertiary : theme.colors.text,
                textDecorationLine: isDone ? 'line-through' : 'none',
              },
            ]}
            numberOfLines={1}
          >
            {task.title}
          </Text>
          {task.color && (
            <View style={[styles.colorDot, { backgroundColor: task.color }]} />
          )}
        </View>

        <View style={styles.metaRow}>
          <View style={[styles.priorityBadge, { backgroundColor: priority.color + '20' }]}>
            <Text style={[styles.priorityText, { color: priority.color }]}>
              {priority.label}
            </Text>
          </View>
          {task.category && (
            <Text style={[styles.category, { color: theme.colors.textTertiary }]}>
              {task.category}
            </Text>
          )}
          {subtasks.length > 0 && (
            <Text style={[styles.subtaskCount, { color: theme.colors.textTertiary }]}>
              {subtasks.filter((s) => s.status === 'done').length}/{subtasks.length} subtasks
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  colorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  priorityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '700',
  },
  category: {
    fontSize: 12,
  },
  subtaskCount: {
    fontSize: 12,
  },
});
