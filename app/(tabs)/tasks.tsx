import { useState } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { addDays, startOfDay } from 'date-fns';
import { useThemeStore } from '@/stores/themeStore';
import { useTaskStore } from '@/stores/taskStore';
import { useCalendarStore } from '@/stores/calendarStore';
import { useHabitStore } from '@/stores/habitStore';
import { usePatternStore } from '@/stores/patternStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { generateHabitEventsForDate } from '@/lib/habitHelpers';
import { autoScheduleTasks } from '@/lib/scheduler';
import { collectTaskPattern } from '@/lib/patternLearning';
import TaskItem from '@/components/tasks/TaskItem';
import TaskFormModal from '@/components/tasks/TaskFormModal';
import ScheduleConfirmModal from '@/components/scheduling/ScheduleConfirmModal';
import type { Task, ScheduleResult, CalendarEvent } from '@/types';

const FILTERS = ['all', 'todo', 'done'] as const;
const FILTER_LABELS = { all: 'All', todo: 'To Do', done: 'Done' };

export default function TasksScreen() {
  const { theme } = useThemeStore();
  const { filter, setFilter, getFilteredTasks } = useTaskStore();

  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleResult, setScheduleResult] = useState<ScheduleResult | null>(null);

  const tasks = getFilteredTasks();

  const handleTaskPress = (task: Task) => {
    setEditingTask(task);
    setShowTaskForm(true);
  };

  const handleCloseModal = () => {
    setShowTaskForm(false);
    setEditingTask(null);
  };

  const handleAutoSchedule = () => {
    const allTasks = useTaskStore.getState().tasks;
    const unscheduled = allTasks.filter(
      (t) => t.status === 'todo' && !t.scheduledStart && !t.parentTaskId
    );
    if (unscheduled.length === 0) return;

    const now = new Date();
    const rangeStart = startOfDay(now);
    const rangeEnd = addDays(rangeStart, 3);
    const existingEvents = useCalendarStore.getState().getEventsForRange(rangeStart, rangeEnd);
    const activeHabits = useHabitStore.getState().getActiveHabits();

    // Generate habit events for each day in range
    const habitEvents: CalendarEvent[] = [];
    let day = rangeStart;
    while (day < rangeEnd) {
      habitEvents.push(...generateHabitEventsForDate(activeHabits, day));
      day = addDays(day, 1);
    }

    const { patterns } = usePatternStore.getState();
    const { timezone } = useSettingsStore.getState();

    const result = autoScheduleTasks({
      tasks: unscheduled,
      existingEvents,
      habitEvents,
      patterns,
      dateRange: { start: rangeStart, end: rangeEnd },
      workingHours: { startHour: 8, endHour: 21 },
      timezone,
    });

    setScheduleResult(result);
    setShowScheduleModal(true);
  };

  const handleAcceptPlacement = (taskId: string) => {
    if (!scheduleResult) return;
    const placement = scheduleResult.placements.find((p) => p.taskId === taskId);
    if (!placement) return;

    const now = new Date();

    // Update the task with scheduled times
    useTaskStore.getState().updateTask(taskId, {
      scheduledStart: placement.proposedStart,
      scheduledEnd: placement.proposedEnd,
      scheduleSource: 'ai',
    });

    // Create a calendar event for this task
    const event: CalendarEvent = {
      id: Date.now().toString() + Math.random().toString(36).slice(2, 7),
      title: placement.task.title,
      description: placement.task.description,
      startTime: placement.proposedStart,
      endTime: placement.proposedEnd,
      allDay: false,
      color: placement.task.color ?? '#6C5CE7',
      source: 'local',
      scheduleSource: 'ai',
      createdAt: now,
      updatedAt: now,
    };
    useCalendarStore.getState().addEvent(event);

    // Record pattern data
    const pattern = collectTaskPattern({
      ...placement.task,
      scheduledStart: placement.proposedStart,
      scheduledEnd: placement.proposedEnd,
      scheduleSource: 'ai',
    });
    if (pattern) usePatternStore.getState().recordDataPoint(pattern);
  };

  const handleAcceptAll = () => {
    if (!scheduleResult) return;
    for (const placement of scheduleResult.placements) {
      handleAcceptPlacement(placement.taskId);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Tasks</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={[styles.scheduleBtn, { backgroundColor: theme.colors.primary + '18' }]}
            onPress={handleAutoSchedule}
          >
            <FontAwesome name="magic" size={16} color={theme.colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: theme.colors.primary }]}
            onPress={() => {
              setEditingTask(null);
              setShowTaskForm(true);
            }}
          >
            <Text style={styles.addBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter tabs */}
      <View style={[styles.filterRow, { borderBottomColor: theme.colors.border }]}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f}
            onPress={() => setFilter(f)}
            style={[
              styles.filterTab,
              filter === f && {
                borderBottomColor: theme.colors.primary,
                borderBottomWidth: 2,
              },
            ]}
          >
            <Text
              style={[
                styles.filterLabel,
                {
                  color: filter === f ? theme.colors.primary : theme.colors.textSecondary,
                  fontWeight: filter === f ? '600' : '400',
                },
              ]}
            >
              {FILTER_LABELS[f]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Task list */}
      {tasks.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: theme.colors.textTertiary }]}>
            {filter === 'done' ? 'No completed tasks yet' : 'No tasks yet — tap + to add one'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TaskItem task={item} onPress={handleTaskPress} />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      <TaskFormModal
        visible={showTaskForm}
        editTask={editingTask}
        onClose={handleCloseModal}
      />

      {scheduleResult && (
        <ScheduleConfirmModal
          visible={showScheduleModal}
          placements={scheduleResult.placements}
          unplaceable={scheduleResult.unplaceable}
          onAccept={handleAcceptPlacement}
          onReject={() => {}}
          onAcceptAll={handleAcceptAll}
          onClose={() => setShowScheduleModal(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scheduleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 24,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    marginBottom: 12,
  },
  filterTab: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  filterLabel: {
    fontSize: 14,
  },
  list: {
    paddingTop: 4,
    paddingBottom: 20,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 15,
  },
});
