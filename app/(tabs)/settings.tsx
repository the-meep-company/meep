import { useEffect, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Switch, TextInput, Alert } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useThemeStore } from '@/stores/themeStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useAuthStore } from '@/stores/authStore';
import { useSyncStore } from '@/stores/syncStore';
import { themes, type ThemeName } from '@/themes';
import type { AIPersona } from '@/types';
import { speak, getAvailableVoices } from '@/lib/tts';
import type { Voice } from 'expo-speech';

const VOICE_LOCALES: { value: string; label: string }[] = [
  { value: 'en-US', label: 'English (US)' },
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'es-ES', label: 'Spanish' },
  { value: 'fr-FR', label: 'French' },
  { value: 'de-DE', label: 'German' },
  { value: 'it-IT', label: 'Italian' },
  { value: 'pt-BR', label: 'Portuguese (Brazil)' },
  { value: 'ja-JP', label: 'Japanese' },
];

const PERSONAS: { value: AIPersona; label: string; description: string }[] = [
  { value: 'friendly', label: 'Friendly', description: 'Warm and encouraging, casual language' },
  { value: 'professional', label: 'Professional', description: 'Clear and efficient, straight to the point' },
  { value: 'playful', label: 'Playful', description: 'Fun and energetic, adds personality' },
];

export default function SettingsScreen() {
  const router = useRouter();
  const { theme, themeName, setTheme } = useThemeStore();
  const {
    aiPersona, timezone, timezoneAutoDetect, companionName, voiceLocale,
    ttsEnabled, ttsAutoRead, ttsVoice,
    setPersona, setTimezoneAutoDetect, setCompanionName, setVoiceLocale,
    setTtsEnabled, setTtsAutoRead, setTtsVoice,
  } = useSettingsStore();
  const { user, isGuest, signOut } = useAuthStore();
  const { googleCalendars, syncState } = useSyncStore();
  const [availableVoices, setAvailableVoices] = useState<Voice[]>([]);

  useEffect(() => {
    getAvailableVoices().then(setAvailableVoices);
  }, []);

  const isGoogleConnected = googleCalendars.length > 0;
  const googleStatusLabel = isGoogleConnected
    ? `${googleCalendars.length} calendar${googleCalendars.length > 1 ? 's' : ''} connected`
    : 'Not connected';

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.title, { color: theme.colors.text }]}>Settings</Text>

      {/* Account Section */}
      <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
        Account
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
        {user ? (
          <>
            <View style={styles.optionInfo}>
              <Text style={[styles.optionName, { color: theme.colors.text }]}>
                {user.email}
              </Text>
              <Text style={[styles.optionDesc, { color: theme.colors.textSecondary }]}>
                Signed in — data syncs across devices
              </Text>
            </View>
            <TouchableOpacity onPress={handleSignOut}>
              <Text style={{ color: theme.colors.accent, fontSize: 14, fontWeight: '600' }}>
                Sign Out
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.optionInfo}>
              <Text style={[styles.optionName, { color: theme.colors.text }]}>
                Guest Mode
              </Text>
              <Text style={[styles.optionDesc, { color: theme.colors.textSecondary }]}>
                Sign in to sync your data across devices
              </Text>
            </View>
          </>
        )}
      </View>

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

      {/* Companion Name Section */}
      <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
        Companion Name
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
          <TextInput
            style={[styles.nameInput, { color: theme.colors.text }]}
            value={companionName}
            onChangeText={setCompanionName}
            placeholder="Give your AI a name..."
            placeholderTextColor={theme.colors.textTertiary}
          />
          <Text style={[styles.optionDesc, { color: theme.colors.textSecondary }]}>
            Your AI companion will introduce itself with this name
          </Text>
        </View>
      </View>

      {/* Voice Language Section */}
      <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
        Voice Language
      </Text>

      {VOICE_LOCALES.map((locale) => (
        <TouchableOpacity
          key={locale.value}
          style={[
            styles.optionCard,
            {
              backgroundColor: voiceLocale === locale.value ? theme.colors.primaryLight : theme.colors.surface,
              borderColor: voiceLocale === locale.value ? theme.colors.primary : theme.colors.border,
              borderRadius: theme.borderRadius.md,
            },
          ]}
          onPress={() => setVoiceLocale(locale.value)}
        >
          <View style={styles.optionInfo}>
            <Text style={[styles.optionName, { color: theme.colors.text }]}>
              {locale.label}
            </Text>
          </View>
          {voiceLocale === locale.value && (
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

      {/* Voice / TTS Section */}
      <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
        Voice
      </Text>

      {/* TTS Enabled */}
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
          <Text style={[styles.optionName, { color: theme.colors.text }]}>Text-to-Speech</Text>
          <Text style={[styles.optionDesc, { color: theme.colors.textSecondary }]}>
            Read assistant messages aloud
          </Text>
        </View>
        <Switch
          value={ttsEnabled}
          onValueChange={setTtsEnabled}
          trackColor={{ true: theme.colors.primary }}
        />
      </View>

      {/* Auto-Read */}
      {ttsEnabled && (
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
            <Text style={[styles.optionName, { color: theme.colors.text }]}>Auto-Read</Text>
            <Text style={[styles.optionDesc, { color: theme.colors.textSecondary }]}>
              Automatically read every new reply
            </Text>
          </View>
          <Switch
            value={ttsAutoRead}
            onValueChange={setTtsAutoRead}
            trackColor={{ true: theme.colors.primary }}
          />
        </View>
      )}

      {/* Voice Picker */}
      {ttsEnabled && availableVoices.length > 0 && (
        <>
          <Text style={[styles.voicePickerLabel, { color: theme.colors.textSecondary }]}>
            Voice
          </Text>
          {availableVoices.slice(0, 10).map((v) => (
            <TouchableOpacity
              key={v.identifier}
              style={[
                styles.optionCard,
                {
                  backgroundColor: ttsVoice === v.identifier ? theme.colors.primaryLight : theme.colors.surface,
                  borderColor: ttsVoice === v.identifier ? theme.colors.primary : theme.colors.border,
                  borderRadius: theme.borderRadius.md,
                },
              ]}
              onPress={() => setTtsVoice(v.identifier)}
            >
              <View style={styles.optionInfo}>
                <Text style={[styles.optionName, { color: theme.colors.text }]}>{v.name}</Text>
                <Text style={[styles.optionDesc, { color: theme.colors.textSecondary }]}>{v.language}</Text>
              </View>
              {ttsVoice === v.identifier && (
                <Text style={{ color: theme.colors.primary, fontSize: 18 }}>✓</Text>
              )}
            </TouchableOpacity>
          ))}
        </>
      )}

      {/* Test Voice */}
      {ttsEnabled && (
        <TouchableOpacity
          style={[
            styles.optionCard,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              borderRadius: theme.borderRadius.md,
              justifyContent: 'center',
            },
          ]}
          onPress={() =>
            speak(`Hi, I'm ${companionName}! How can I help you today?`, aiPersona, {
              voice: ttsVoice ?? undefined,
              language: voiceLocale,
            })
          }
        >
          <FontAwesome name="volume-up" size={16} color={theme.colors.primary} style={{ marginRight: 12 }} />
          <Text style={[styles.optionName, { color: theme.colors.primary }]}>Test voice</Text>
        </TouchableOpacity>
      )}

      {/* Google Calendar Section */}
      <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
        Integrations
      </Text>

      <TouchableOpacity
        style={[
          styles.optionCard,
          {
            backgroundColor: theme.colors.surface,
            borderColor: isGoogleConnected ? theme.colors.primary : theme.colors.border,
            borderRadius: theme.borderRadius.md,
          },
        ]}
        onPress={() => router.push('/google-calendar' as Href)}
      >
        <View style={[styles.themePreview, { backgroundColor: '#4285F4', borderRadius: theme.borderRadius.sm, alignItems: 'center', justifyContent: 'center' }]}>
          <FontAwesome name="google" size={20} color="#fff" />
        </View>
        <View style={styles.optionInfo}>
          <Text style={[styles.optionName, { color: theme.colors.text }]}>
            Google Calendar
          </Text>
          <Text style={[styles.optionDesc, { color: isGoogleConnected ? theme.colors.primary : theme.colors.textSecondary }]}>
            {googleStatusLabel}
            {syncState.isSyncing ? ' · Syncing…' : ''}
          </Text>
        </View>
        <FontAwesome name="chevron-right" size={14} color={theme.colors.textTertiary} />
      </TouchableOpacity>
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
  nameInput: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
    padding: 0,
  },
  voicePickerLabel: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 8,
    marginTop: 8,
  },
});
