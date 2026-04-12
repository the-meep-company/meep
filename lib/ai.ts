import { supabase } from './supabase';
import type { AIPersona, BrainDumpResponse, ChatMessage, ParsedItem } from '@/types';

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
