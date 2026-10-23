import { useState } from 'react';
import { StyleSheet, View, Text, FlatList, AccessibilityInfo } from 'react-native';
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
import GlassBackground from '@/components/common/GlassBackground';
import { useTabBarClearance } from '@/components/navigation/FloatingTabBar';
import ScheduleConfirmModal from '@/components/scheduling/ScheduleConfirmModal';
import Card from '@/components/ui/Card';
import IconButton from '@/components/ui/IconButton';
import PillTabs from '@/components/ui/PillTabs';
import ScreenHeader, { GlowAvatar } from '@/components/ui/ScreenHeader';
import { DisplayTitle, SectionLabel } from '@/components/ui/Typography';
import { decorative } from '@/lib/accessibility';
import type { Task, ScheduleResult, CalendarEvent } from '@/types';

type Filter = 'all' | 'todo' | 'done';

export default function TasksScreen() {
  const { theme } = useThemeStore();
  const tabClearance = useTabBarClearance();
  const { filter, setFilter, getFilteredTasks } = useTaskStore();
  const allTasks = useTaskStore((s) => s.tasks);
  const companionName = useSettingsStore((s) => s.companionName);

  const topLevel = allTasks.filter((t) => !t.parentTaskId);
  const doneCount = topLevel.filter((t) => t.status === 'done').length;
  const todoCount = topLevel.length - doneCount;
  const progress = topLevel.length > 0 ? doneCount / topLevel.length : 0;

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
    if (unscheduled.length === 0) {
      AccessibilityInfo.announceForAccessibility('Everything is already scheduled');
      return;
    }

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


  const filterOptions: { value: Filter; label: string; count: number }[] = [
    { value: 'all', label: 'All', count: topLevel.length },
    { value: 'todo', label: 'To do', count: todoCount },
    { value: 'done', label: 'Done', count: doneCount },
  ];

  const listHeader = (
    <View style={[styles.listHeader, { paddingHorizontal: theme.spacing.screen }]}>
      <DisplayTitle lead="Your" title="tasks" />

      {/* Hero: what's left today */}
      <Card
        variant="glow"
        glow="apricot"
        style={styles.hero}
        accessible
        accessibilityLabel={`${todoCount} ${todoCount === 1 ? 'task' : 'tasks'} to do. ${doneCount} of ${topLevel.length} done.`}
      >
        <SectionLabel style={{ color: theme.colors.text }}>Today</SectionLabel>
        <View style={styles.heroRow}>
          <Text style={[styles.heroNumber, { color: theme.colors.text }]}>{todoCount}</Text>
          <Text style={[styles.heroUnit, { color: theme.colors.textSecondary }]}>
            {todoCount === 1 ? 'task' : 'tasks'} to do
          </Text>
        </View>
        <View style={styles.progressRow} {...decorative}>
          <View
            style={[
              styles.progressFill,
              { flex: Math.max(progress, 0.04), backgroundColor: theme.colors.primary },
            ]}
          />
          {/* Hatched remainder, like a ruler */}
          <View style={[styles.progressRest, { flex: Math.max(1 - progress, 0.0001) }]}>
            {Array.from({ length: 48 }).map((_, i) => (
              <View key={i} style={[styles.tick, { backgroundColor: theme.colors.textTertiary }]} />
            ))}
          </View>
        </View>
        <View style={styles.progressLabels}>
          <Text style={[styles.caption, { color: theme.colors.textSecondary }]}>Done</Text>
          <Text style={[styles.caption, { color: theme.colors.textSecondary }]}>
            {doneCount} of {topLevel.length}
          </Text>
        </View>
      </Card>

      <PillTabs
        options={filterOptions}
        value={filter as Filter}
        onChange={setFilter}
        accessibilityLabel="Filter tasks"
        style={styles.filters}
      />
    </View>
  );

  return (
    <GlassBackground style={styles.container}>
      <ScreenHeader
        left={<GlowAvatar initial={companionName || 'M'} />}
        right={
          <>
            <IconButton
              icon="magic"
              accessibilityLabel="Auto-schedule tasks"
              accessibilityHint="Finds time in your calendar for unscheduled tasks"
              onPress={handleAutoSchedule}
            />
            <IconButton
              icon="plus"
              variant="primary"
              accessibilityLabel="Add task"
              onPress={() => {
                setEditingTask(null);
                setShowTaskForm(true);
              }}
            />
          </>
        }
      />

      <FlatList
        data={tasks}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <TaskItem task={item} onPress={handleTaskPress} />}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: theme.colors.textSecondary }]}>
            {filter === 'done' ? 'No completed tasks yet' : 'No tasks yet. Tap + to add one.'}
          </Text>
        }
        contentContainerStyle={{ paddingBottom: tabClearance }}
        showsVerticalScrollIndicator={false}
      />

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
    </GlassBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listHeader: {
    paddingTop: 8,
    gap: 20,
    marginBottom: 16,
  },
  hero: {
    padding: 22,
    gap: 6,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
  },
  heroNumber: {
    fontSize: 64,
    fontWeight: '200',
    letterSpacing: -2,
    lineHeight: 72,
  },
  heroUnit: {
    fontSize: 17,
    fontWeight: '400',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 18,
    gap: 6,
    marginTop: 10,
  },
  progressFill: {
    height: 18,
    borderRadius: 9,
  },
  progressRest: {
    flexDirection: 'row',
    height: 12,
    gap: 3,
    overflow: 'hidden',
  },
  tick: {
    width: 2,
    height: 12,
    borderRadius: 1,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  caption: {
    fontSize: 12,
  },
  filters: {
    marginTop: 4,
  },
  empty: {
    fontSize: 15,
    textAlign: 'center',
    marginTop: 32,
    paddingHorizontal: 40,
  },
});
