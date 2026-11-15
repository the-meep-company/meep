import { useEffect, useMemo, useState } from 'react';
import type { Voice } from 'expo-speech';
import { useSettingsStore } from '@/stores/settingsStore';
import SettingsPage from '@/components/settings/SettingsPage';
import { SettingsGroup, SettingsRow, SettingsSection } from '@/components/ui/Settings';
import { getAvailableVoices, speak, stopSpeaking } from '@/lib/tts';
import { voiceLocaleLabel } from '@/lib/voiceLocales';

const sameLanguage = (a: string, b: string) =>
  a.toLowerCase().replace('_', '-').split('-')[0] === b.toLowerCase().split('-')[0];
const sameLocale = (a: string, b: string) => a.toLowerCase().replace('_', '-') === b.toLowerCase();

/** Picks the text-to-speech voice, limited to voices that speak the chosen language. */
export default function VoicePickerScreen() {
  const { aiPersona, companionName, voiceLocale, ttsVoice, setTtsVoice } = useSettingsStore();
  const [voices, setVoices] = useState<Voice[] | null>(null);

  useEffect(() => {
    getAvailableVoices().then(setVoices);
    return () => stopSpeaking();
  }, []);

  // Exact-locale voices first (e.g. en-GB), then others in the same language.
  const options = useMemo(() => {
    const matching = (voices ?? []).filter((v) => sameLanguage(v.language, voiceLocale));
    const rank = (v: Voice) => (sameLocale(v.language, voiceLocale) ? 0 : 1);
    return matching.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  }, [voices, voiceLocale]);

  // Choosing a voice plays it, so you hear what you picked.
  const choose = (voice: Voice | null) => {
    setTtsVoice(voice?.identifier ?? null);
    stopSpeaking();
    speak(`Hi, I'm ${companionName}!`, aiPersona, {
      voice: voice?.identifier,
      language: voiceLocale,
    });
  };

  return (
    <SettingsPage title="Voice">
      <SettingsSection
        footer={
          voices && options.length === 0
            ? `This device has no extra voices for ${voiceLocaleLabel(voiceLocale)}.`
            : `Voices on this device for ${voiceLocaleLabel(voiceLocale)}. Tap one to hear it.`
        }
      >
        <SettingsGroup accessibilityRole="radiogroup" accessibilityLabel="Voice">
          <SettingsRow
            kind="radio"
            testID="voice-default"
            title="Default"
            description="The system voice for this language"
            selected={ttsVoice === null}
            onPress={() => choose(null)}
          />
          {options.map((voice) => (
            <SettingsRow
              key={voice.identifier}
              kind="radio"
              title={voice.name}
              description={voice.language}
              selected={ttsVoice === voice.identifier}
              onPress={() => choose(voice)}
            />
          ))}
        </SettingsGroup>
      </SettingsSection>
    </SettingsPage>
  );
}
