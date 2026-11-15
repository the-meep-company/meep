import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useThemeStore } from '@/stores/themeStore';
import { MAX_COMPANION_INSTRUCTIONS, useSettingsStore } from '@/stores/settingsStore';
import SettingsPage from '@/components/settings/SettingsPage';
import Card from '@/components/ui/Card';
import PillTabs from '@/components/ui/PillTabs';
import { SettingsSection } from '@/components/ui/Settings';
import type { AIPersona } from '@/types';

// Ordered from most serious to most playful.
const TONES: { value: AIPersona; label: string; description: string }[] = [
  { value: 'professional', label: 'Professional', description: 'Clear and efficient, straight to the point.' },
  { value: 'friendly', label: 'Friendly', description: 'Warm and encouraging, casual language.' },
  { value: 'playful', label: 'Playful', description: 'Fun and energetic, adds personality.' },
];

/** The companion's name, tone of voice and the user's standing instructions. */
export default function CompanionScreen() {
  const { theme } = useThemeStore();
  const {
    companionName, aiPersona, companionInstructions,
    setCompanionName, setPersona, setCompanionInstructions,
  } = useSettingsStore();
  const tone = TONES.find((t) => t.value === aiPersona) ?? TONES[1];

  return (
    <SettingsPage title="Companion">
      <SettingsSection label="Name" footer="Your companion introduces itself with this name.">
        <Card radius={theme.borderRadius.md} style={styles.card}>
          {/* Inputs sit in a View: on web a bare <input> would paint under the card's glass layers. */}
          <View>
            <TextInput
              testID="companion-name"
              style={[styles.nameInput, { color: theme.colors.text }]}
              value={companionName}
              onChangeText={setCompanionName}
              placeholder="Give your companion a name"
              placeholderTextColor={theme.colors.textTertiary}
              accessibilityLabel="Companion name"
              returnKeyType="done"
              autoCorrect={false}
              maxLength={24}
            />
          </View>
        </Card>
      </SettingsSection>

      <SettingsSection label="Tone" footer={tone.description}>
        <PillTabs
          options={TONES}
          value={aiPersona}
          onChange={setPersona}
          layout="fill"
          semantics="radio"
          accessibilityLabel="Tone"
          style={styles.tabs}
        />
      </SettingsSection>

      <SettingsSection
        label="Instructions"
        footer={`Anything ${companionName || 'your companion'} should know or always do. It follows these in every chat.`}
      >
        <Card radius={theme.borderRadius.md} style={styles.card}>
          <View>
            <TextInput
              testID="companion-instructions"
              style={[styles.instructions, { color: theme.colors.text }]}
              value={companionInstructions}
              onChangeText={setCompanionInstructions}
              placeholder="e.g. Keep replies short. I don’t work Fridays, so never schedule work tasks then."
              placeholderTextColor={theme.colors.textTertiary}
              accessibilityLabel="Instructions for your companion"
              multiline
              maxLength={MAX_COMPANION_INSTRUCTIONS}
              textAlignVertical="top"
            />
          </View>
          <View style={styles.counter}>
            <Text style={[styles.counterText, { color: theme.colors.textTertiary }]}>
              {companionInstructions.length}/{MAX_COMPANION_INSTRUCTIONS}
            </Text>
          </View>
        </Card>
      </SettingsSection>
    </SettingsPage>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 8 },
  tabs: { marginBottom: 8 },
  nameInput: { fontSize: 16, fontWeight: '500', paddingHorizontal: 16, paddingVertical: 16, minHeight: 56 },
  instructions: { fontSize: 16, lineHeight: 22, paddingHorizontal: 16, paddingTop: 14, minHeight: 132 },
  counter: { alignItems: 'flex-end', paddingHorizontal: 16, paddingBottom: 10 },
  counterText: { fontSize: 12 },
});
