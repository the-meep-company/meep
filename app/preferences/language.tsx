import { useSettingsStore } from '@/stores/settingsStore';
import SettingsPage from '@/components/settings/SettingsPage';
import { SettingsGroup, SettingsRow, SettingsSection } from '@/components/ui/Settings';
import { VOICE_LOCALES } from '@/lib/voiceLocales';

/** Picks the dictation and speech language. */
export default function LanguageScreen() {
  const { voiceLocale, setVoiceLocale, setTtsVoice } = useSettingsStore();

  const choose = (locale: string) => {
    if (locale === voiceLocale) return;
    setVoiceLocale(locale);
    // The chosen voice belongs to the old language; fall back to the new one's default.
    setTtsVoice(null);
  };

  return (
    <SettingsPage title="Language">
      <SettingsSection>
        <SettingsGroup accessibilityRole="radiogroup" accessibilityLabel="Language">
          {VOICE_LOCALES.map((locale) => (
            <SettingsRow
              key={locale.value}
              kind="radio"
              testID={`language-${locale.value}`}
              title={locale.label}
              selected={voiceLocale === locale.value}
              onPress={() => choose(locale.value)}
            />
          ))}
        </SettingsGroup>
      </SettingsSection>
    </SettingsPage>
  );
}
