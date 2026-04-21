import * as Speech from 'expo-speech';
import type { AIPersona } from '@/types';

export interface TtsOptions {
  rate?: number;
  pitch?: number;
  language?: string;
  voice?: string;
}

// Persona-aware speech defaults
function getPersonaDefaults(persona: AIPersona): TtsOptions {
  switch (persona) {
    case 'playful':
      return { rate: 1.1, pitch: 1.15 };
    case 'professional':
      return { rate: 1.0, pitch: 1.0 };
    case 'friendly':
    default:
      return { rate: 0.92, pitch: 0.95 };
  }
}

export async function speak(
  text: string,
  persona: AIPersona = 'friendly',
  options: TtsOptions = {}
): Promise<void> {
  const defaults = getPersonaDefaults(persona);
  const merged: Speech.SpeechOptions = {
    rate: options.rate ?? defaults.rate,
    pitch: options.pitch ?? defaults.pitch,
    language: options.language,
    voice: options.voice ?? undefined,
  };
  Speech.speak(text, merged);
}

export function stopSpeaking(): void {
  Speech.stop();
}

export async function isSpeaking(): Promise<boolean> {
  return Speech.isSpeakingAsync();
}

export async function getAvailableVoices(): Promise<Speech.Voice[]> {
  try {
    return await Speech.getAvailableVoicesAsync();
  } catch {
    return [];
  }
}
