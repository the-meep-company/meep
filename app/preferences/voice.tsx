import { useEffect, useState } from 'react';
import { useRouter, type Href } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import type { Voice } from 'expo-speech';
import { useThemeStore } from '@/stores/themeStore';
import { useSettingsStore } from '@/stores/settingsStore';
import SettingsPage from '@/components/settings/SettingsPage';
import { SettingsGroup, SettingsRow, SettingsSection } from '@/components/ui/Settings';
import { getAvailableVoices, speak } from '@/lib/tts';
import { voiceLocaleLabel } from '@/lib/voiceLocales';

/** Spoken replies and the language used for speech. */
export default function VoiceScreen() {
  const router = useRouter();
  const { theme } = useThemeStore();
  const {
    aiPersona, companionName, voiceLocale, ttsEnabled, ttsAutoRead, ttsVoice,
    setTtsEnabled, setTtsAutoRead,
  } = useSettingsStore();
  const [voices, setVoices] = useState<Voice[]>([]);

  useEffect(() => {
    getAvailableVoices().then(setVoices);
  }, []);

  const voiceName = ttsVoice ? voices.find((v) => v.identifier === ttsVoice)?.name ?? 'Custom' : 'Default';

  return (
    <SettingsPage title="Voice">
      <SettingsSection label="Spoken replies">
        <SettingsGroup>
          <SettingsRow
            kind="switch"
            testID="tts-enabled"
            title="Read replies aloud"
            value={ttsEnabled}
            onValueChange={setTtsEnabled}
          />
          {ttsEnabled && (
            <SettingsRow
              kind="switch"
              testID="tts-auto-read"
              title="Read new replies automatically"
              value={ttsAutoRead}
              onValueChange={setTtsAutoRead}
            />
          )}
          {ttsEnabled && (
            <SettingsRow
              kind="button"
              testID="tts-voice"
              title="Voice"
              value={voiceName}
              onPress={() => router.push('/preferences/voice-picker' as Href)}
            />
          )}
          {ttsEnabled && (
            <SettingsRow
              kind="button"
              testID="tts-sample"
              title="Play sample"
              chevron={false}
              tone={theme.colors.accent}
              left={<FontAwesome name="volume-up" size={16} color={theme.colors.accent} />}
              onPress={() =>
                speak(`Hi, I'm ${companionName}! How can I help you today?`, aiPersona, {
                  voice: ttsVoice ?? undefined,
                  language: voiceLocale,
                })
              }
            />
          )}
        </SettingsGroup>
      </SettingsSection>

      <SettingsSection
        label="Language"
        footer={`The language ${companionName || 'your companion'} listens for when you dictate, and speaks in.`}
      >
        <SettingsGroup>
          <SettingsRow
            kind="button"
            testID="voice-language"
            title="Language"
            value={voiceLocaleLabel(voiceLocale)}
            onPress={() => router.push('/preferences/language' as Href)}
          />
        </SettingsGroup>
      </SettingsSection>
    </SettingsPage>
  );
}
