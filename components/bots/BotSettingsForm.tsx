import { Pressable, StyleSheet, Text, View } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useThemeStore } from '@/stores/themeStore';
import PillTabs from '@/components/ui/PillTabs';
import { SectionLabel } from '@/components/ui/Typography';
import { SettingsGroup, SettingsRow } from '@/components/ui/Settings';
import {
  CHANGE_SCOPE, READ_ONLY_SCOPE, TRIGGER_OPTIONS, TRUST_OPTIONS, WEEKDAYS,
  canChangeCalendar, formatTime, fromCron, toCron, type SchedulePreset, type ScheduleSpec,
} from '@/lib/bots';
import { a11yState } from '@/lib/accessibility';
import { registerForPush } from '@/lib/push';
import type { BotFields } from '@/types';

// The "when / how much to trust it / what it may touch" part of a bot, shared by
// the new-bot screen and the edit screen.

export type BotSettings = Pick<BotFields, 'kind' | 'schedule' | 'trigger' | 'trust' | 'scope' | 'enabled' | 'pushEnabled'>;

export const DEFAULT_SCHEDULE: ScheduleSpec = { preset: 'weekdays', hour: 7, minute: 30, weekday: 0 };

export const NEW_BOT_SETTINGS: BotSettings = {
  kind: 'scheduled',
  schedule: toCron(DEFAULT_SCHEDULE),
  trust: 'ask',
  scope: CHANGE_SCOPE,
  enabled: true,
  pushEnabled: false,
};

const PRESETS: { value: SchedulePreset; label: string }[] = [
  { value: 'daily', label: 'Every day' },
  { value: 'weekdays', label: 'Weekdays' },
  { value: 'weekly', label: 'Weekly' },
];

export default function BotSettingsForm({
  value,
  onChange,
}: {
  value: BotSettings;
  onChange: (next: BotSettings) => void;
}) {
  const { theme } = useThemeStore();
  const set = (updates: Partial<BotSettings>) => onChange({ ...value, ...updates });
  // Hand-written cron (not one of the presets) shows as-is; picking a preset replaces it.
  const spec = fromCron(value.schedule) ?? DEFAULT_SCHEDULE;
  const setSpec = (updates: Partial<ScheduleSpec>) => set({ schedule: toCron({ ...spec, ...updates }) });
  const customCron = value.kind === 'scheduled' && value.schedule && !fromCron(value.schedule);

  return (
    <View>
      <SectionLabel style={styles.section}>When?</SectionLabel>
      <PillTabs
        semantics="radio"
        accessibilityLabel="When it runs"
        options={[
          { value: 'scheduled', label: 'Schedule' },
          { value: 'triggered', label: 'When something happens' },
        ]}
        value={value.kind === 'triggered' ? 'triggered' : 'scheduled'}
        onChange={(kind) =>
          set(
            kind === 'scheduled'
              ? { kind, schedule: value.schedule ?? toCron(DEFAULT_SCHEDULE) }
              : { kind, trigger: value.trigger ?? 'task.deadline_changed' }
          )
        }
      />

      {value.kind === 'triggered' ? (
        <View style={styles.gap}>
          <SettingsGroup accessibilityRole="radiogroup" accessibilityLabel="Trigger">
            {TRIGGER_OPTIONS.map((t) => (
              <SettingsRow
                key={t.value}
                kind="radio"
                title={t.label}
                selected={value.trigger === t.value}
                onPress={() => set({ trigger: t.value })}
              />
            ))}
          </SettingsGroup>
        </View>
      ) : (
        <View style={styles.gap}>
          {customCron ? (
            <Text style={[styles.hint, { color: theme.colors.textSecondary }]}>
              Runs on a custom schedule ({value.schedule}). Pick an option below to replace it.
            </Text>
          ) : null}
          <PillTabs
            semantics="radio"
            accessibilityLabel="How often"
            options={PRESETS}
            value={spec.preset}
            onChange={(preset) => setSpec({ preset })}
          />
          {spec.preset === 'weekly' && (
            <View accessibilityRole="radiogroup" accessibilityLabel="Day" style={styles.days}>
              {WEEKDAYS.map((d, i) => {
                const selected = spec.weekday === i;
                return (
                  <Pressable
                    key={d}
                    accessibilityRole="radio"
                    accessibilityLabel={d}
                    {...a11yState({ checked: selected })}
                    onPress={() => setSpec({ weekday: i })}
                    style={[
                      styles.day,
                      selected
                        ? { backgroundColor: theme.colors.primary }
                        : { borderWidth: 1, borderColor: theme.colors.border },
                    ]}
                  >
                    <Text style={[styles.dayText, { color: selected ? theme.colors.onPrimary : theme.colors.textSecondary }]}>
                      {d.slice(0, 2)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
          <View style={styles.timeRow}>
            <Text style={[styles.timeLabel, { color: theme.colors.textSecondary }]}>At</Text>
            <Stepper
              label="Hour"
              text={formatTime(spec.hour, 0).replace(':00', '')}
              onLess={() => setSpec({ hour: (spec.hour + 23) % 24 })}
              onMore={() => setSpec({ hour: (spec.hour + 1) % 24 })}
            />
            <Stepper
              label="Minutes"
              text={`:${String(spec.minute).padStart(2, '0')}`}
              onLess={() => setSpec({ minute: (Math.ceil(spec.minute / 15) * 15 + 45) % 60 })}
              onMore={() => setSpec({ minute: (Math.floor(spec.minute / 15) * 15 + 15) % 60 })}
            />
          </View>
        </View>
      )}

      <SectionLabel style={styles.section}>Trust</SectionLabel>
      <PillTabs
        layout="fill"
        semantics="radio"
        accessibilityLabel="Trust"
        options={TRUST_OPTIONS.map(({ value: v, label }) => ({ value: v, label }))}
        value={value.trust}
        onChange={(trust) => set({ trust })}
      />
      <Text style={[styles.hint, { color: theme.colors.textSecondary }]}>
        {TRUST_OPTIONS.find((t) => t.value === value.trust)?.description}
      </Text>

      <View style={styles.gap}>
        <SettingsGroup>
          <SettingsRow
            kind="switch"
            title="Can change my calendar"
            description={
              canChangeCalendar(value.scope)
                ? 'Adds, moves and removes blocks (as trust allows)'
                : 'Only reads your calendar and reports back'
            }
            value={canChangeCalendar(value.scope)}
            onValueChange={(on) => set({ scope: on ? CHANGE_SCOPE : READ_ONLY_SCOPE })}
          />
          <SettingsRow
            kind="switch"
            title="Running"
            description={value.enabled ? 'Runs on its own' : 'Paused: only runs when you ask it to'}
            value={value.enabled}
            onValueChange={(enabled) => set({ enabled })}
          />
          <SettingsRow
            kind="switch"
            title="Notify me"
            description="A quiet notification when it leaves something in your feed"
            value={value.pushEnabled}
            onValueChange={(pushEnabled) => {
              set({ pushEnabled });
              if (pushEnabled) registerForPush({ ask: true });
            }}
          />
        </SettingsGroup>
      </View>
    </View>
  );
}

function Stepper({ label, text, onLess, onMore }: { label: string; text: string; onLess: () => void; onMore: () => void }) {
  const { theme } = useThemeStore();
  const button = (icon: 'minus' | 'plus', onPress: () => void, a11y: string) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [styles.stepButton, { borderColor: theme.colors.border }, pressed && { opacity: 0.6 }]}
    >
      <FontAwesome name={icon} size={11} color={theme.colors.textSecondary} />
    </Pressable>
  );
  return (
    <View style={styles.stepper}>
      {button('minus', onLess, `Earlier ${label.toLowerCase()}`)}
      <Text accessibilityLabel={`${label}: ${text}`} style={[styles.stepText, { color: theme.colors.text }]}>
        {text}
      </Text>
      {button('plus', onMore, `Later ${label.toLowerCase()}`)}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 26, marginBottom: 10 },
  gap: { marginTop: 12, gap: 12 },
  hint: { fontSize: 13, lineHeight: 18, marginTop: 8 },
  days: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  day: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  dayText: { fontSize: 13, fontWeight: '500' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  timeLabel: { fontSize: 15 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepButton: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 16, fontWeight: '500', minWidth: 44, textAlign: 'center' },
});
