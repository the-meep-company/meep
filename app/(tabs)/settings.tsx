import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Switch } from 'react-native';
import { useThemeStore } from '@/stores/themeStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { themes, type ThemeName } from '@/themes';
import type { AIPersona } from '@/types';

const PERSONAS: { value: AIPersona; label: string; description: string }[] = [
  { value: 'friendly', label: 'Friendly', description: 'Warm and encouraging, casual language' },
  { value: 'professional', label: 'Professional', description: 'Clear and efficient, straight to the point' },
  { value: 'playful', label: 'Playful', description: 'Fun and energetic, adds personality' },
];

export default function SettingsScreen() {
  const { theme, themeName, setTheme } = useThemeStore();
  const {
    aiPersona, timezone, timezoneAutoDetect,
    setPersona, setTimezoneAutoDetect,
  } = useSettingsStore();

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.title, { color: theme.colors.text }]}>Settings</Text>

      {/* Theme Section */}
      <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
        Theme
      </Text>

      {(Object.keys(themes) as ThemeName[]).map((name) => (
        <TouchableOpacity
          key={name}
          testID={`theme-${name}`}
          accessibilityRole="button"
          style={[
            styles.optionCard,
            {
              backgroundColor: themeName === name ? theme.colors.primaryLight : theme.colors.surface,
              borderColor: themeName === name ? theme.colors.primary : theme.colors.border,
              borderRadius: theme.borderRadius.md,
            },
          ]}
          onPress={() => setTheme(name)}
        >
          <View
            style={[
              styles.themePreview,
              {
                backgroundColor: themes[name].colors.primary,
                borderRadius: theme.borderRadius.sm,
              },
            ]}
          />
          <View style={styles.optionInfo}>
            <Text style={[styles.optionName, { color: theme.colors.text }]}>
              {themes[name].label}
            </Text>
            <Text style={[styles.optionDesc, { color: theme.colors.textSecondary }]}>
              {name === 'minimal' && 'Clean whites, soft blues, lots of space'}
              {name === 'playful' && 'Bold colors, warm tones, rounded shapes'}
              {name === 'sleek' && 'Dark backgrounds, neon accents, modern feel'}
            </Text>
          </View>
          {themeName === name && (
            <Text style={{ color: theme.colors.primary, fontSize: 18 }}>✓</Text>
          )}
        </TouchableOpacity>
      ))}

      {/* AI Persona Section */}
      <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
        AI Persona
      </Text>

      {PERSONAS.map((p) => (
        <TouchableOpacity
          key={p.value}
          style={[
            styles.optionCard,
            {
              backgroundColor: aiPersona === p.value ? theme.colors.primaryLight : theme.colors.surface,
              borderColor: aiPersona === p.value ? theme.colors.primary : theme.colors.border,
              borderRadius: theme.borderRadius.md,
            },
          ]}
          onPress={() => setPersona(p.value)}
        >
          <View style={styles.optionInfo}>
            <Text style={[styles.optionName, { color: theme.colors.text }]}>
              {p.label}
            </Text>
            <Text style={[styles.optionDesc, { color: theme.colors.textSecondary }]}>
              {p.description}
            </Text>
          </View>
          {aiPersona === p.value && (
            <Text style={{ color: theme.colors.primary, fontSize: 18 }}>✓</Text>
          )}
        </TouchableOpacity>
      ))}

      {/* Timezone Section */}
      <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
        Timezone
      </Text>

      <View
        style={[
          styles.optionCard,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            borderRadius: theme.borderRadius.md,
          },
        ]}
      >
        <View style={styles.optionInfo}>
          <Text style={[styles.optionName, { color: theme.colors.text }]}>
            Auto-detect
          </Text>
          <Text style={[styles.optionDesc, { color: theme.colors.textSecondary }]}>
            Currently: {timezone}
          </Text>
        </View>
        <Switch
          value={timezoneAutoDetect}
          onValueChange={setTimezoneAutoDetect}
          trackColor={{ true: theme.colors.primary }}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 24,
    marginTop: 60,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
    marginTop: 24,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginBottom: 10,
    borderWidth: 1.5,
  },
  themePreview: {
    width: 40,
    height: 40,
    marginRight: 14,
  },
  optionInfo: {
    flex: 1,
  },
  optionName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  optionDesc: {
    fontSize: 13,
  },
});
