import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeStore } from '@/stores/themeStore';
import { useMeepleStore } from '@/stores/meepleStore';
import { previewBot } from '@/lib/bots';
import { MEEPLE_ICONS } from '@/lib/meeples';
import GlassBackground from '@/components/common/GlassBackground';
import IconButton from '@/components/ui/IconButton';
import { SectionLabel } from '@/components/ui/Typography';
import BotSettingsForm, { NEW_BOT_SETTINGS, type BotSettings } from '@/components/bots/BotSettingsForm';
import { a11yState } from '@/lib/accessibility';
import type { Meeple } from '@/types';

// Write a bot in one screen: what it should do, when, and how much to trust it.
// Saving runs it once as a preview, so the first thing it does is a proposal.

const GLOWS: Meeple['glow'][] = ['ocean', 'plum', 'apricot', 'lime', 'rose', 'sky'];
const pick = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)];

/** "Every weekday at 7:30, look at…" → "Every weekday at 7:30". */
function nameFrom(instruction: string): string {
  const words = instruction.replace(/[^\p{L}\p{N}\s:']/gu, ' ').trim().split(/\s+/).slice(0, 4).join(' ');
  return (words.length > 24 ? words.slice(0, 24).trim() : words) || 'My bot';
}

export default function NewBotScreen() {
  const router = useRouter();
  const { theme } = useThemeStore();
  const insets = useSafeAreaInsets();
  const addMeeple = useMeepleStore((s) => s.addMeeple);
  const [instruction, setInstruction] = useState('');
  const [name, setName] = useState('');
  const [settings, setSettings] = useState<BotSettings>(NEW_BOT_SETTINGS);

  const field = { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border };
  const input = [styles.input, field, { color: theme.colors.text, borderRadius: theme.borderRadius.md }];
  const canSave = !!instruction.trim();

  const save = () => {
    if (!canSave) return;
    const id = addMeeple({
      name: name.trim() || nameFrom(instruction),
      role: instruction.trim().split(/[.\n]/)[0].slice(0, 60),
      instructions: instruction.trim(),
      icon: pick(MEEPLE_ICONS),
      glow: pick(GLOWS),
      webSearch: false,
      scheduleAccess: true,
      pushEnabled: false,
      ...settings,
    });
    previewBot(id);
    router.replace({ pathname: '/meeples/[id]', params: { id } });
  };

  return (
    <GlassBackground>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.header, { paddingHorizontal: theme.spacing.screen }]}>
          <IconButton icon="times" accessibilityLabel="Cancel" onPress={() => router.back()} />
          <Text accessibilityRole="header" style={[styles.headerTitle, { color: theme.colors.text }]}>
            New bot
          </Text>
          <Pressable
            testID="bot-save"
            accessibilityRole="button"
            accessibilityLabel="Create bot"
            {...a11yState({ disabled: !canSave })}
            disabled={!canSave}
            onPress={save}
            style={({ pressed }) => [
              styles.save,
              { backgroundColor: canSave ? theme.colors.primary : theme.colors.primaryLight },
              pressed && { opacity: 0.8 },
            ]}
          >
            <Text style={[styles.saveText, { color: canSave ? theme.colors.onPrimary : theme.colors.textTertiary }]}>
              Create
            </Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: theme.spacing.screen, paddingBottom: insets.bottom + 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.intro, { color: theme.colors.textSecondary }]}>
            A bot works on your calendar while you're not looking. Its only hands are your calendar: it reads your
            schedule and tasks, and adds or moves blocks.
          </Text>

          <SectionLabel style={styles.section}>What should it do?</SectionLabel>
          <TextInput
            testID="bot-instruction"
            style={[input, styles.instruction]}
            placeholder="e.g. Every weekday morning, look at my calendar and open tasks and propose focus blocks for today."
            placeholderTextColor={theme.colors.textTertiary}
            accessibilityLabel="What the bot should do"
            value={instruction}
            onChangeText={setInstruction}
            multiline
            textAlignVertical="top"
            autoFocus
          />
          <TextInput
            testID="bot-name"
            style={[input, styles.name]}
            placeholder="Name (optional)"
            placeholderTextColor={theme.colors.textTertiary}
            accessibilityLabel="Name"
            value={name}
            onChangeText={setName}
            maxLength={24}
          />

          <BotSettingsForm value={settings} onChange={setSettings} />

          <Text style={[styles.footnote, { color: theme.colors.textTertiary }]}>
            When you create it, it does one practice run now and leaves what it would do in your feed. Nothing changes
            until you approve.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </GlassBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 16, paddingBottom: 12 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '500' },
  save: { height: 44, paddingHorizontal: 18, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  saveText: { fontSize: 15, fontWeight: '600' },
  intro: { fontSize: 15, lineHeight: 21, marginTop: 4 },
  section: { marginTop: 22, marginBottom: 10 },
  input: { minHeight: 46, paddingHorizontal: 14, paddingVertical: 11, fontSize: 16 },
  instruction: { minHeight: 132, lineHeight: 22 },
  name: { marginTop: 10 },
  footnote: { fontSize: 13, lineHeight: 18, marginTop: 24 },
});
