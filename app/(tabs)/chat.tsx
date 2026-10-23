import { useState, useRef, useCallback } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { addDays, startOfDay } from 'date-fns';
import { useThemeStore } from '@/stores/themeStore';
import { useChatStore } from '@/stores/chatStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useCalendarStore } from '@/stores/calendarStore';
import { useTaskStore } from '@/stores/taskStore';
import { useHabitStore } from '@/stores/habitStore';
import { usePatternStore } from '@/stores/patternStore';
import { parseBrainDump, sendChatCorrection, sendChatMessage } from '@/lib/ai';
import { confirmAndSaveItem, confirmAndSaveAll } from '@/lib/confirmItems';
import { generateHabitEventsForDate } from '@/lib/habitHelpers';
import { autoScheduleTasks } from '@/lib/scheduler';
import { collectTaskPattern } from '@/lib/patternLearning';
import { speak, stopSpeaking } from '@/lib/tts';
import BrainDumpInput from '@/components/braindump/BrainDumpInput';
import ParsedItemsList from '@/components/braindump/ParsedItemsList';
import ChatBubble from '@/components/braindump/ChatBubble';
import ChatInput from '@/components/braindump/ChatInput';
import ActionConfirmCard from '@/components/braindump/ActionConfirmCard';
import ItemEditModal from '@/components/braindump/ItemEditModal';
import ScheduleConfirmModal from '@/components/scheduling/ScheduleConfirmModal';
import GlassBackground from '@/components/common/GlassBackground';
import { useTabBarClearance } from '@/components/navigation/FloatingTabBar';
import ScreenHeader, { GlowAvatar } from '@/components/ui/ScreenHeader';
import IconButton from '@/components/ui/IconButton';
import { useSurfaceStyle } from '@/components/ui/surface';
import { decorative } from '@/lib/accessibility';
import type { ParsedItem, ChatMessage, ChatAction, ScheduleResult, CalendarEvent } from '@/types';

type ScreenMode = 'input' | 'review' | 'chat';

export default function MeepScreen() {
  const { theme } = useThemeStore();
  const tabClearance = useTabBarClearance();
  const surface = useSurfaceStyle('strong');
  const {
    messages, currentParsedItems, isProcessing,
    addMessage, setParsedItems, updateParsedItem, removeParsedItem,
    confirmItem, confirmAllItems, setProcessing, clearMessages,
    startNewSession, endSession,
  } = useChatStore();
  const { aiPersona, timezone, companionName, ttsEnabled, ttsAutoRead, ttsVoice, voiceLocale, setTtsAutoRead } = useSettingsStore();

  const [screenMode, setScreenMode] = useState<ScreenMode>('input');
  const [summary, setSummary] = useState('');
  const [editingItem, setEditingItem] = useState<ParsedItem | null>(null);
  const [showSchedulePrompt, setShowSchedulePrompt] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleResult, setScheduleResult] = useState<ScheduleResult | null>(null);
  const [actionStatuses, setActionStatuses] = useState<Record<string, 'accepted' | 'rejected'>>({});
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  // ===== Brain Dump Handlers (unchanged) =====

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

  // ===== Chat Mode Handlers =====

  const handleStartChat = () => {
    clearMessages();
    startNewSession();
    setActionStatuses({});
    setScreenMode('chat');
  };

  const handleBackFromChat = () => {
    stopSpeaking();
    setSpeakingMessageId(null);
    endSession();
    setScreenMode('input');
  };

  const handleChatSend = async (text: string) => {
    stopSpeaking();
    setSpeakingMessageId(null);

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };
    addMessage(userMsg);
    setProcessing(true);

    try {
      const result = await sendChatMessage(
        [...messages, userMsg],
        aiPersona,
        companionName,
        timezone
      );

      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: result.message,
        actions: result.actions || undefined,
        timestamp: new Date(),
      };
      addMessage(assistantMsg);

      if (ttsEnabled && ttsAutoRead) {
        setSpeakingMessageId(assistantMsg.id);
        speak(assistantMsg.content, aiPersona, {
          voice: ttsVoice ?? undefined,
          language: voiceLocale,
        });
      }
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Sorry, something went wrong. ${err instanceof Error ? err.message : 'Please try again.'}`,
        timestamp: new Date(),
      };
      addMessage(errorMsg);
    } finally {
      setProcessing(false);
    }
  };

  const handleActionAccept = useCallback((action: ChatAction, messageId: string, actionIndex: number) => {
    const key = `${messageId}-${actionIndex}`;
    setActionStatuses((prev) => ({ ...prev, [key]: 'accepted' }));

    const now = new Date();
    switch (action.type) {
      case 'create_event': {
        useCalendarStore.getState().addEvent({
          id: Date.now().toString() + Math.random().toString(36).slice(2, 7),
          title: action.params.title,
          startTime: new Date(action.params.startTime),
          endTime: new Date(action.params.endTime),
          description: action.params.description,
          allDay: action.params.allDay ?? false,
          color: action.params.color ?? '#2563EB',
          source: 'local',
          createdAt: now,
          updatedAt: now,
        });
        break;
      }
      case 'move_event':
        useCalendarStore.getState().updateEvent(action.params.eventId, {
          startTime: new Date(action.params.newStartTime),
          endTime: new Date(action.params.newEndTime),
        });
        break;
      case 'delete_event':
        useCalendarStore.getState().deleteEvent(action.params.eventId);
        break;
      case 'complete_task':
        useTaskStore.getState().toggleStatus(action.params.taskId);
        break;
      case 'create_task': {
        useTaskStore.getState().addTask({
          id: Date.now().toString() + Math.random().toString(36).slice(2, 7),
          title: action.params.title,
          priority: action.params.priority ?? 3,
          status: 'todo',
          description: action.params.description,
          dueDate: action.params.dueDate ? new Date(action.params.dueDate) : undefined,
          estimatedMinutes: action.params.estimatedMinutes,
          createdAt: now,
          updatedAt: now,
        });
        break;
      }
    }
  }, []);

  const handleActionReject = useCallback((action: ChatAction, messageId: string, actionIndex: number) => {
    const key = `${messageId}-${actionIndex}`;
    setActionStatuses((prev) => ({ ...prev, [key]: 'rejected' }));
  }, []);

  return (
    <GlassBackground style={styles.container}>
    {/* Bottom padding keeps the inputs above the floating tab bar */}
    <KeyboardAvoidingView
      style={[styles.container, { paddingBottom: tabClearance }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      {/* Header */}
      {screenMode === 'chat' ? (
        <ScreenHeader
          title={companionName}
          left={
            <IconButton icon="chevron-left" iconSize={14} accessibilityLabel="Back" onPress={handleBackFromChat} />
          }
          right={
            <>
              {ttsEnabled && (
                <IconButton
                  icon="volume-up"
                  variant={ttsAutoRead ? 'primary' : 'plain'}
                  selected={ttsAutoRead}
                  accessibilityLabel={`Auto-read replies, ${ttsAutoRead ? 'on' : 'off'}`}
                  onPress={() => setTtsAutoRead(!ttsAutoRead)}
                />
              )}
              <IconButton icon="plus" accessibilityLabel="New chat" onPress={handleStartChat} />
            </>
          }
        />
      ) : screenMode === 'review' ? (
        <ScreenHeader
          title={companionName}
          left={<GlowAvatar initial={companionName || 'M'} />}
          right={
            <IconButton
              icon="plus"
              variant="primary"
              accessibilityLabel="New brain dump"
              onPress={handleNewDump}
            />
          }
        />
      ) : (
        <ScreenHeader
          left={<Text style={[styles.brand, { color: theme.colors.textSecondary }]}>{companionName.toLowerCase()}</Text>}
          right={
            <Pressable
              testID="chat-button"
              accessibilityRole="button"
              accessibilityLabel={`Chat with ${companionName}`}
              accessibilityHint="Ask about your schedule, tasks, or anything else"
              onPress={handleStartChat}
              style={({ pressed }) => [styles.chatPill, surface, pressed && { opacity: 0.75 }]}
            >
              <FontAwesome name="comment-o" size={15} color={theme.colors.text} {...decorative} />
              <Text style={[styles.chatPillText, { color: theme.colors.text }]}>Chat</Text>
            </Pressable>
          }
        />
      )}

      {/* Content */}
      {screenMode === 'input' ? (
        <View style={[styles.inputContainer, { paddingHorizontal: theme.spacing.screen }]}>
          <Text accessibilityRole="header" style={[styles.hero, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            What can I take off your mind today?
          </Text>
          <View style={styles.flex} />
          <BrainDumpInput onSubmit={handleBrainDump} isProcessing={isProcessing} />
        </View>
      ) : screenMode === 'chat' ? (
        <View style={styles.reviewContainer}>
          <ScrollView
            ref={scrollRef}
            style={styles.chatScroll}
            contentContainerStyle={styles.chatContent}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          >
            {messages.length === 0 && (
              <View style={styles.emptyChat}>
                <FontAwesome name="comments-o" size={48} color={theme.colors.textTertiary} {...decorative} />
                <Text style={[styles.emptyChatText, { color: theme.colors.textSecondary }]}>
                  Ask {companionName} about your schedule, tasks, or anything else!
                </Text>
              </View>
            )}

            {messages.map((msg) => (
              <View key={msg.id}>
                <ChatBubble
                  message={msg}
                  speakingMessageId={speakingMessageId}
                  onSpeakStart={setSpeakingMessageId}
                  onSpeakEnd={() => setSpeakingMessageId(null)}
                />
                {msg.actions && msg.actions.length > 0 && (
                  <View style={styles.actionsSection}>
                    {msg.actions.map((action, idx) => {
                      const key = `${msg.id}-${idx}`;
                      return (
                        <ActionConfirmCard
                          key={key}
                          action={action}
                          onAccept={(a) => handleActionAccept(a, msg.id, idx)}
                          onReject={(a) => handleActionReject(a, msg.id, idx)}
                          status={actionStatuses[key]}
                        />
                      );
                    })}
                  </View>
                )}
              </View>
            ))}
          </ScrollView>

          <ChatInput
            onSend={handleChatSend}
            disabled={isProcessing}
            placeholder={`Chat with ${companionName}...`}
          />
        </View>
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
                      <FontAwesome name="magic" size={16} color={theme.colors.text} {...decorative} />
                      <Text
                        accessibilityRole="header"
                        style={[styles.schedulePromptText, { color: theme.colors.text }]}
                      >
                        Want me to schedule your new tasks?
                      </Text>
                    </View>
                    <View style={styles.schedulePromptButtons}>
                      <TouchableOpacity
                        onPress={() => setShowSchedulePrompt(false)}
                        accessibilityRole="button"
                        style={[styles.schedulePromptBtn, { borderColor: theme.colors.border, borderWidth: 1 }]}
                      >
                        <Text style={[styles.schedulePromptBtnText, { color: theme.colors.textSecondary }]}>
                          No thanks
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={handleTriggerSchedule}
                        accessibilityRole="button"
                        style={[styles.schedulePromptBtn, { backgroundColor: theme.colors.primary }]}
                      >
                        <Text style={[styles.schedulePromptBtnText, { color: theme.colors.onPrimary }]}>
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
    </GlassBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  inputContainer: {
    flex: 1,
    paddingBottom: 12,
  },
  flex: {
    flex: 1,
  },
  brand: {
    fontSize: 15,
    letterSpacing: 0.2,
  },
  hero: {
    fontSize: 46,
    fontWeight: '300',
    letterSpacing: -1.4,
    lineHeight: 50,
    marginTop: 40,
  },
  chatPill: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chatPillText: {
    fontSize: 15,
    fontWeight: '500',
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
  emptyChat: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 40,
    gap: 16,
  },
  emptyChatText: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  actionsSection: {
    paddingHorizontal: 12,
    marginTop: 4,
    marginBottom: 8,
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
