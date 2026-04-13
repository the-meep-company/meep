import { supabase } from './supabase';
import { addDays, startOfDay, endOfDay } from 'date-fns';
import { useCalendarStore } from '@/stores/calendarStore';
import { useTaskStore } from '@/stores/taskStore';
import type { AIPersona, BrainDumpResponse, ChatAction, ChatMessage, ParsedItem } from '@/types';

export async function parseBrainDump(
  text: string,
  persona: AIPersona,
  timezone: string,
  existingEvents?: { title: string; startTime: string; endTime: string }[]
): Promise<BrainDumpResponse> {
  const { data, error } = await supabase.functions.invoke('parse-brain-dump', {
    body: {
      text,
      persona,
      timezone,
      currentDate: new Date().toISOString(),
      existingEvents,
    },
  });

  if (error) throw new Error(`Brain dump parsing failed: ${error.message}`);
  return data as BrainDumpResponse;
}

export async function sendChatCorrection(
  messages: ChatMessage[],
  currentItems: ParsedItem[],
  persona: AIPersona,
  timezone: string
): Promise<{ updatedItems: ParsedItem[]; message: string }> {
  const { data, error } = await supabase.functions.invoke('chat-correction', {
    body: {
      messages,
      currentItems,
      persona,
      timezone,
      currentDate: new Date().toISOString(),
    },
  });

  if (error) throw new Error(`Chat correction failed: ${error.message}`);
  return data as { updatedItems: ParsedItem[]; message: string };
}

export async function sendChatMessage(
  messages: ChatMessage[],
  persona: AIPersona,
  companionName: string,
  timezone: string
): Promise<{ message: string; actions?: ChatAction[] }> {
  const now = new Date();
  const today = startOfDay(now);
  const tomorrow = addDays(today, 1);
  const threeDaysOut = addDays(today, 4);

  const todayEvents = useCalendarStore.getState().getEventsForDate(now).map((e) => ({
    id: e.id,
    title: e.title,
    startTime: new Date(e.startTime).toISOString(),
    endTime: new Date(e.endTime).toISOString(),
  }));

  const todayTasks = useTaskStore.getState().tasks
    .filter((t) => t.status !== 'done')
    .map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate ? new Date(t.dueDate).toISOString() : undefined,
    }));

  const upcomingEvents = useCalendarStore.getState().getEventsForRange(tomorrow, threeDaysOut).map((e) => ({
    id: e.id,
    title: e.title,
    startTime: new Date(e.startTime).toISOString(),
    endTime: new Date(e.endTime).toISOString(),
  }));

  const { data, error } = await supabase.functions.invoke('chat', {
    body: {
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      persona,
      companionName,
      timezone,
      currentDate: now.toISOString(),
      context: { todayEvents, todayTasks, upcomingEvents },
    },
  });

  if (error) throw new Error(`Chat failed: ${error.message}`);
  return data as { message: string; actions?: ChatAction[] };
}
