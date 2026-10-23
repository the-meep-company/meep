import { StyleSheet, View, Text, Pressable } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useThemeStore } from '@/stores/themeStore';
import { useTaskStore } from '@/stores/taskStore';
import { useGlassPreset } from '@/lib/glass';
import { decorative, hitSlopFor, a11yState } from '@/lib/accessibility';
import { PRIORITY } from '@/lib/semanticColors';
import { GlassLayers, glassFrame } from '@/components/common/GlassCard';
import type { Task } from '@/types';


const CHECKBOX = 26;

interface TaskItemProps {
  task: Task;
  onPress: (task: Task) => void;
}

export default function TaskItem({ task, onPress }: TaskItemProps) {
  const { theme } = useThemeStore();
  const { toggleStatus, getSubtasks } = useTaskStore();
  const glass = useGlassPreset();
  const isDone = task.status === 'done';
  const subtasks = getSubtasks(task.id);
  const subtasksDone = subtasks.filter((s) => s.status === 'done').length;
  const priority = PRIORITY[task.priority];
  const aiScheduled = task.scheduleSource === 'ai' && !!task.scheduledStart;
  const radius = theme.borderRadius.md;

  // One spoken summary for the details button.
  const summary = [
    task.title,
    `${priority.name} priority`,
    task.category,
    subtasks.length > 0 ? `${subtasksDone} of ${subtasks.length} subtasks done` : null,
    aiScheduled ? 'scheduled by AI' : null,
    task.carryOverFrom && !isDone ? 'carried over' : null,
    isDone ? 'done' : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    // The card itself isn't focusable: the checkbox and the details are two
    // sibling controls so VoiceOver can reach both.
    <View
      style={[
        styles.card,
        { marginHorizontal: theme.spacing.screen },
        theme.isGlass
          ? glassFrame(glass, radius)
          : {
              borderRadius: radius,
              backgroundColor: theme.colors.surface,
              borderWidth: 1,
              borderColor: theme.colors.border,
            },
      ]}
    >
      {theme.isGlass && <GlassLayers preset={glass} radius={radius} />}

      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={task.title}
        {...a11yState({ checked: isDone })}
        hitSlop={hitSlopFor(CHECKBOX)}
        onPress={() => toggleStatus(task.id)}
        style={[
          styles.checkbox,
          {
            borderColor: isDone ? theme.colors.primary : theme.colors.textTertiary,
            backgroundColor: isDone ? theme.colors.primary : 'transparent',
          },
        ]}
      >
        {isDone && <FontAwesome name="check" size={13} color={theme.colors.onPrimary} />}
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={summary}
        accessibilityHint="Opens task details"
        onPress={() => onPress(task)}
        style={({ pressed }) => [styles.details, pressed && { opacity: 0.7 }]}
      >
        <View style={styles.titleRow}>
          <Text
            style={[
              styles.title,
              {
                color: isDone ? theme.colors.textTertiary : theme.colors.text,
                textDecorationLine: isDone ? 'line-through' : 'none',
              },
            ]}
            numberOfLines={2}
          >
            {task.title}
          </Text>
          {task.color && (
            <View style={[styles.colorDot, { backgroundColor: task.color }]} {...decorative} />
          )}
        </View>

        <View style={styles.metaRow}>
          <View style={[styles.badge, { backgroundColor: priority.color + '24' }]}>
            <Text style={[styles.badgeText, { color: priority.color }]}>{priority.label}</Text>
          </View>
          {task.category && (
            <Text style={[styles.meta, { color: theme.colors.textSecondary }]}>{task.category}</Text>
          )}
          {subtasks.length > 0 && (
            <Text style={[styles.meta, { color: theme.colors.textSecondary }]}>
              {subtasksDone}/{subtasks.length} subtasks
            </Text>
          )}
          {aiScheduled && (
            <View style={[styles.badge, { backgroundColor: theme.colors.primaryLight }]}>
              <Text style={[styles.badgeText, { color: theme.colors.text }]}>AI scheduled</Text>
            </View>
          )}
          {task.carryOverFrom && !isDone && (
            <View style={[styles.badge, { backgroundColor: theme.colors.primaryLight }]}>
              <Text style={[styles.badgeText, { color: theme.colors.textSecondary }]}>
                Carried over
              </Text>
            </View>
          )}
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    marginBottom: 10,
  },
  checkbox: {
    width: CHECKBOX,
    height: CHECKBOX,
    borderRadius: CHECKBOX / 2,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  details: {
    flex: 1,
    paddingVertical: 16,
    paddingLeft: 14,
    paddingRight: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 21,
  },
  colorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  meta: {
    fontSize: 12,
  },
});
