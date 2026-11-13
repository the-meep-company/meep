import { useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useThemeStore } from '@/stores/themeStore';
import { isBot, useMeepleStore, type MeepleDraft } from '@/stores/meepleStore';
import { MEEPLE_ICONS, MEEPLE_TEMPLATES } from '@/lib/meeples';
import { previewBot } from '@/lib/bots';
import BotSettingsForm, { type BotSettings } from '@/components/bots/BotSettingsForm';
import GlassBackground from '@/components/common/GlassBackground';
import IconButton from '@/components/ui/IconButton';
import { SectionLabel } from '@/components/ui/Typography';
import { SettingsGroup, SettingsRow } from '@/components/ui/Settings';
import MeepleAvatar from '@/components/meeples/MeepleAvatar';
import { GlowFill } from '@/components/ui/Card';
import { a11yState } from '@/lib/accessibility';
import type { GlowName } from '@/themes';

type FAName = React.ComponentProps<typeof FontAwesome>['name'];

const GLOWS: GlowName[] = ['ocean', 'plum', 'apricot', 'lime', 'rose', 'sky'];

const BLANK: MeepleDraft = {
  name: '',
  role: '',
  instructions: '',
  icon: 'lightbulb-o',
  glow: 'sky',
  webSearch: true,
  scheduleAccess: false,
};

export default function MeepleEditScreen() {
  const { id, template } = useLocalSearchParams<{ id?: string; template?: string }>();
  const router = useRouter();
  const { theme } = useThemeStore();
  const insets = useSafeAreaInsets();
  // A plain fill rather than system glass: a TextInput can't host the glass layer.
  const field = { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border };
  const existing = useMeepleStore((s) => s.meeples.find((m) => m.id === id));
  const { addMeeple, updateMeeple, deleteMeeple, clearThread } = useMeepleStore();

  const [draft, setDraft] = useState<MeepleDraft>(() => {
    if (existing) {
      const { name, role, instructions, icon, glow, webSearch, scheduleAccess } = existing;
      return { name, role, instructions, icon, glow, webSearch, scheduleAccess };
    }
    const t = template != null ? MEEPLE_TEMPLATES[Number(template)] : undefined;
    if (!t) return BLANK;
    const { blurb: _blurb, ...rest } = t;
    return rest;
  });
  const set = (updates: Partial<MeepleDraft>) => setDraft((d) => ({ ...d, ...updates }));
  const bot = existing ? isBot(existing) : false;
  const [botSettings, setBotSettings] = useState<BotSettings | null>(() =>
    existing && isBot(existing)
      ? {
          kind: existing.kind,
          schedule: existing.schedule,
          trigger: existing.trigger,
          trust: existing.trust,
          scope: existing.scope,
          enabled: existing.enabled,
        }
      : null
  );

  const canSave = !!draft.name.trim() && !!draft.instructions.trim();

  const save = () => {
    if (!canSave) return;
    const clean: MeepleDraft = {
      ...draft,
      name: draft.name.trim(),
      role: draft.role.trim() || 'Helper',
      instructions: draft.instructions.trim(),
    };
    if (existing) {
      updateMeeple(existing.id, botSettings ? { ...clean, ...botSettings } : clean);
      // A bot whose job or timing changed shows what it would now do.
      if (
        botSettings &&
        (clean.instructions !== existing.instructions ||
          botSettings.kind !== existing.kind ||
          botSettings.schedule !== existing.schedule ||
          botSettings.trigger !== existing.trigger ||
          botSettings.scope.join() !== existing.scope.join())
      ) {
        previewBot(existing.id);
      }
      router.back();
    } else {
      const newId = addMeeple(clean);
      router.replace({ pathname: '/meeples/[id]', params: { id: newId } });
    }
  };

  const confirm = (title: string, message: string, action: string, onConfirm: () => void) => {
    if (Platform.OS === 'web') {
      if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    } else {
      Alert.alert(title, message, [
        { text: 'Cancel', style: 'cancel' },
        { text: action, style: 'destructive', onPress: onConfirm },
      ]);
    }
  };

  const input = [styles.input, field, { color: theme.colors.text, borderRadius: theme.borderRadius.md }];

  return (
    <GlassBackground>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.header, { paddingHorizontal: theme.spacing.screen }]}>
          <IconButton icon="times" accessibilityLabel="Cancel" onPress={() => router.back()} />
          <Text accessibilityRole="header" style={[styles.headerTitle, { color: theme.colors.text }]}>
            {existing ? `Edit ${existing.name}` : 'New meeple'}
          </Text>
          <Pressable
            testID="meeple-save"
            accessibilityRole="button"
            accessibilityLabel={existing ? 'Save' : 'Create meeple'}
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
              {existing ? 'Save' : 'Create'}
            </Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: theme.spacing.screen, paddingBottom: insets.bottom + 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.identity}>
            <MeepleAvatar icon={draft.icon} glow={draft.glow} size={72} />
            <View style={styles.identityFields}>
              <TextInput
                testID="meeple-name"
                style={input}
                placeholder="Name"
                placeholderTextColor={theme.colors.textTertiary}
                accessibilityLabel="Name"
                value={draft.name}
                onChangeText={(name) => set({ name })}
                maxLength={24}
              />
              <TextInput
                testID="meeple-role"
                style={input}
                placeholder="Job, e.g. Web lookout"
                placeholderTextColor={theme.colors.textTertiary}
                accessibilityLabel="Job"
                value={draft.role}
                onChangeText={(role) => set({ role })}
                maxLength={32}
              />
            </View>
          </View>

          <SectionLabel style={styles.section}>Brief</SectionLabel>
          <TextInput
            testID="meeple-brief"
            style={[input, styles.brief]}
            placeholder="What is this meeple in charge of? What should it look for, and what's worth telling you about?"
            placeholderTextColor={theme.colors.textTertiary}
            accessibilityLabel="Brief"
            accessibilityHint="What this meeple is in charge of"
            value={draft.instructions}
            onChangeText={(instructions) => set({ instructions })}
            multiline
            textAlignVertical="top"
          />

          {botSettings && <BotSettingsForm value={botSettings} onChange={setBotSettings} />}

          <SectionLabel style={styles.section}>Skills</SectionLabel>
          <SettingsGroup>
            <SettingsRow
              kind="switch"
              title="Search the web"
              description={
                bot
                  ? 'Only while you chat with it; it never browses when running on its own'
                  : 'Look things up and read pages online'
              }
              value={draft.webSearch}
              onValueChange={(webSearch) => set({ webSearch })}
            />
            {!bot && (
              <SettingsRow
                kind="switch"
                title="See my schedule"
                description="Read your calendar and tasks, and suggest new ones for you to accept"
                value={draft.scheduleAccess}
                onValueChange={(scheduleAccess) => set({ scheduleAccess })}
              />
            )}
          </SettingsGroup>

          <SectionLabel style={styles.section}>Look</SectionLabel>
          <View accessibilityRole="radiogroup" accessibilityLabel="Icon" style={styles.swatches}>
            {MEEPLE_ICONS.map((icon) => {
              const selected = draft.icon === icon;
              return (
                <Pressable
                  key={icon}
                  accessibilityRole="radio"
                  accessibilityLabel={icon.replace(/-o$/, '').replace(/-/g, ' ')}
                  {...a11yState({ checked: selected })}
                  onPress={() => set({ icon })}
                  style={[
                    styles.swatch,
                    selected ? { backgroundColor: theme.colors.primary } : field,
                  ]}
                >
                  <FontAwesome
                    name={icon as FAName}
                    size={17}
                    color={selected ? theme.colors.onPrimary : theme.colors.textSecondary}
                  />
                </Pressable>
              );
            })}
          </View>
          <View accessibilityRole="radiogroup" accessibilityLabel="Colour" style={[styles.swatches, styles.glows]}>
            {GLOWS.map((glow) => {
              const selected = draft.glow === glow;
              return (
                <Pressable
                  key={glow}
                  accessibilityRole="radio"
                  accessibilityLabel={glow}
                  {...a11yState({ checked: selected })}
                  onPress={() => set({ glow })}
                  style={[styles.swatch, selected && { borderWidth: 2, borderColor: theme.colors.primary }]}
                >
                  <View style={styles.glowInner}>
                    <GlowFill name={glow} radius={16} />
                  </View>
                </Pressable>
              );
            })}
          </View>

          {existing && (
            <>
              <SectionLabel style={styles.section}>Manage</SectionLabel>
              <SettingsGroup>
                <SettingsRow
                  kind="button"
                  title="Clear conversation"
                  chevron={false}
                  description="Keeps the meeple and its brief"
                  onPress={() =>
                    confirm('Clear conversation?', `This removes everything in ${existing.name}'s thread.`, 'Clear', () => {
                      clearThread(existing.id);
                      router.back();
                    })
                  }
                />
                <SettingsRow
                  kind="button"
                  title={`Delete ${existing.name}`}
                  chevron={false}
                  tone={theme.colors.error}
                  testID="meeple-delete"
                  onPress={() =>
                    confirm(`Delete ${existing.name}?`, 'The meeple and its conversation will be removed.', 'Delete', () => {
                      router.back();
                      deleteMeeple(existing.id);
                    })
                  }
                />
              </SettingsGroup>
            </>
          )}
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
  identity: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 8 },
  identityFields: { flex: 1, gap: 8 },
  input: { minHeight: 46, paddingHorizontal: 14, paddingVertical: 11, fontSize: 16 },
  brief: { minHeight: 132, lineHeight: 22 },
  section: { marginTop: 26, marginBottom: 10 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  glows: { marginTop: 14 },
  swatch: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  glowInner: { width: 32, height: 32, borderRadius: 16, overflow: 'hidden' },
});
