import { useState, useRef } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { addDays, startOfDay } from 'date-fns';
import { useThemeStore } from '@/stores/themeStore';
import { useChatStore } from '@/stores/chatStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useCalendarStore } from '@/stores/calendarStore';
import { useTaskStore } from '@/stores/taskStore';
import { useHabitStore } from '@/stores/habitStore';
import { usePatternStore } from '@/stores/patternStore';
import { parseBrainDump, sendChatCorrection } from '@/lib/ai';
import { confirmAndSaveItem, confirmAndSaveAll } from '@/lib/confirmItems';
import { generateHabitEventsForDate } from '@/lib/habitHelpers';
import { autoScheduleTasks } from '@/lib/scheduler';
import { collectTaskPattern } from '@/lib/patternLearning';
import BrainDumpInput from '@/components/braindump/BrainDumpInput';
import ParsedItemsList from '@/components/braindump/ParsedItemsList';
import ChatBubble from '@/components/braindump/ChatBubble';
import ChatInput from '@/components/braindump/ChatInput';
import ItemEditModal from '@/components/braindump/ItemEditModal';
import ScheduleConfirmModal from '@/components/scheduling/ScheduleConfirmModal';
import type { ParsedItem, ChatMessage, ScheduleResult, CalendarEvent } from '@/types';

type ScreenMode = 'input' | 'review';

export default function MeepScreen() {
  const { theme } = useThemeStore();
  const {
    messages, currentParsedItems, isProcessing,
    addMessage, setParsedItems, updateParsedItem, removeParsedItem,
    confirmItem, confirmAllItems, setProcessing, clearMessages,
  } = useChatStore();
  const { aiPersona, timezone } = useSettingsStore();

  const [screenMode, setScreenMode] = useState<ScreenMode>('input');
  const [summary, setSummary] = useState('');
  const [editingItem, setEditingItem] = useState<ParsedItem | null>(null);
  const [showSchedulePrompt, setShowSchedulePrompt] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleResult, setScheduleResult] = useState<ScheduleResult | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const handleBrainDump = async (text: string) => {
    setProcessing(true);

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };
    addMessage(userMsg);

    try {
      const result = await parseBrainDump(text, aiPersona, timezone);
      setParsedItems(result.items);
      setSummary(result.summary);

      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: result.summary + (result.followUpQuestion ? `\n\n${result.followUpQuestion}` : ''),
        parsedItems: result.items,
        timestamp: new Date(),
      };
      addMessage(assistantMsg);

      setScreenMode('review');
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Sorry, I had trouble processing that. ${err instanceof Error ? err.message : 'Please try again.'}`,
        timestamp: new Date(),
      };
      addMessage(errorMsg);
    } finally {
      setProcessing(false);
    }
  };

  const handleChatCorrection = async (text: string) => {
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };
    addMessage(userMsg);
    setProcessing(true);

    try {
      const result = await sendChatCorrection(
        [...messages, userMsg],
        currentParsedItems,
        aiPersona,
        timezone
      );

      for (const updated of result.updatedItems) {
        if (updated.status === 'deleted') {
          removeParsedItem(updated.id);
        } else {
          updateParsedItem(updated.id, updated);
        }
      }

      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: result.message,
        timestamp: new Date(),
      };
      addMessage(assistantMsg);
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Sorry, I couldn't process that correction. ${err instanceof Error ? err.message : ''}`,
        timestamp: new Date(),
      };
      addMessage(errorMsg);
    } finally {
      setProcessing(false);
    }
  };

  const handleConfirmItem = (id: string) => {
    const item = currentParsedItems.find((i) => i.id === id);
    if (item) {
      confirmAndSaveItem(item);
      confirmItem(id);
    }
  };

  const handleConfirmAll = () => {
    const unconfirmed = currentParsedItems.filter(
      (i) => i.status !== 'deleted' && i.status !== 'confirmed'
    );
    confirmAndSaveAll(unconfirmed);
    confirmAllItems();

    // Show schedule prompt if any confirmed items are tasks
    const hasTasks = unconfirmed.some((i) => i.type === 'task');
    if (hasTasks) {
      setShowSchedulePrompt(true);
    }
  };

  const handleTriggerSchedule = () => {
    setShowSchedulePrompt(false);

    const now = new Date();
    const rangeStart = startOfDay(now);
    const rangeEnd = addDays(rangeStart, 3);

    const allTasks = useTaskStore.getState().tasks;
    const unscheduled = allTasks.filter(
      (t) => t.status === 'todo' && !t.scheduledStart && !t.parentTaskId
    );
    if (unscheduled.length === 0) return;

    const existingEvents = useCalendarStore.getState().getEventsForRange(rangeStart, rangeEnd);
    const activeHabits = useHabitStore.getState().getActiveHabits();

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
    useTaskStore.getState().updateTask(taskId, {
      scheduledStart: placement.proposedStart,
      scheduledEnd: placement.proposedEnd,
      scheduleSource: 'ai',
    });

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

    const pattern = collectTaskPattern({
      ...placement.task,
      scheduledStart: placement.proposedStart,
      scheduledEnd: placement.proposedEnd,
      scheduleSource: 'ai',
    });
    if (pattern) usePatternStore.getState().recordDataPoint(pattern);
  };

  const handleAcceptAllPlacements = () => {
    if (!scheduleResult) return;
    for (const placement of scheduleResult.placements) {
      handleAcceptPlacement(placement.taskId);
    }
  };

  const handleEditSave = (id: string, updates: Partial<ParsedItem>) => {
    updateParsedItem(id, updates);
    setEditingItem(null);
  };

  const handleNewDump = () => {
    clearMessages();
    setSummary('');
    setScreenMode('input');
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Meep</Text>
        {screenMode === 'review' && (
          <TouchableOpacity onPress={handleNewDump}>
            <Text style={[styles.newButton, { color: theme.colors.primary }]}>New</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
      {screenMode === 'input' ? (
        <BrainDumpInput onSubmit={handleBrainDump} isProcessing={isProcessing} />
      ) : (
        <View style={styles.reviewContainer}>
          <ScrollView
            ref={scrollRef}
            style={styles.chatScroll}
            contentContainerStyle={styles.chatContent}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          >
            {messages.map((msg) => (
              <ChatBubble key={msg.id} message={msg} />
            ))}

            {currentParsedItems.length > 0 && (
              <View style={styles.parsedSection}>
                <ParsedItemsList
                  items={currentParsedItems}
                  summary={summary}
                  onEdit={setEditingItem}
                  onDelete={removeParsedItem}
                  onConfirm={handleConfirmItem}
                  onConfirmAll={handleConfirmAll}
                />

                {/* Post-confirmation schedule prompt */}
                {showSchedulePrompt && (
                  <View
                    style={[
                      styles.schedulePrompt,
                      { backgroundColor: theme.colors.primary + '12', borderRadius: theme.borderRadius.md },
                    ]}
                  >
                    <View style={styles.schedulePromptHeader}>
                      <FontAwesome name="magic" size={16} color={theme.colors.primary} />
                      <Text style={[styles.schedulePromptText, { color: theme.colors.text }]}>
                        Want me to schedule your new tasks?
                      </Text>
                    </View>
                    <View style={styles.schedulePromptButtons}>
                      <TouchableOpacity
                        onPress={() => setShowSchedulePrompt(false)}
                        style={[styles.schedulePromptBtn, { borderColor: theme.colors.border, borderWidth: 1 }]}
                      >
                        <Text style={[styles.schedulePromptBtnText, { color: theme.colors.textSecondary }]}>
                          No thanks
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={handleTriggerSchedule}
                        style={[styles.schedulePromptBtn, { backgroundColor: theme.colors.primary }]}
                      >
                        <Text style={[styles.schedulePromptBtnText, { color: '#FFF' }]}>
                          Yes, schedule
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            )}
          </ScrollView>

          <ChatInput
            onSend={handleChatCorrection}
            disabled={isProcessing}
            placeholder="Make corrections... e.g. 'change dentist to 3pm'"
          />
        </View>
      )}

      <ItemEditModal
        item={editingItem}
        visible={editingItem !== null}
        onClose={() => setEditingItem(null)}
        onSave={handleEditSave}
      />

      {scheduleResult && (
        <ScheduleConfirmModal
          visible={showScheduleModal}
          placements={scheduleResult.placements}
          unplaceable={scheduleResult.unplaceable}
          onAccept={handleAcceptPlacement}
          onReject={() => {}}
          onAcceptAll={handleAcceptAllPlacements}
          onClose={() => setShowScheduleModal(false)}
        />
      )}
    </KeyboardAvoidingView>
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
  newButton: {
    fontSize: 16,
    fontWeight: '600',
  },
  reviewContainer: {
    flex: 1,
  },
  chatScroll: {
    flex: 1,
  },
  chatContent: {
    paddingBottom: 16,
  },
  parsedSection: {
    paddingHorizontal: 12,
    marginTop: 12,
  },
  schedulePrompt: {
    padding: 14,
    marginTop: 12,
  },
  schedulePromptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  schedulePromptText: {
    fontSize: 14,
    fontWeight: '600',
  },
  schedulePromptButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  schedulePromptBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  schedulePromptBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
