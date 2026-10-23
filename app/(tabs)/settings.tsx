import { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  Alert,
  Image,
} from 'react-native';
import { useRouter, type Href } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useThemeStore } from '@/stores/themeStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useAuthStore } from '@/stores/authStore';
import { useSyncStore } from '@/stores/syncStore';
import { themes, type ThemeName } from '@/themes';
import type { AIPersona, GrainLevel } from '@/types';
import { speak, getAvailableVoices } from '@/lib/tts';
import type { Voice } from 'expo-speech';
import { WidgetSettingsSection } from '@/components/settings/WidgetSettingsSection';
import GlassBackground, { MeshBackground } from '@/components/common/GlassBackground';
import GlassCard from '@/components/common/GlassCard';
import { GlowFill } from '@/components/ui/Card';
import PillTabs from '@/components/ui/PillTabs';
import { SettingsGroup, SettingsRow } from '@/components/ui/Settings';
import { DisplayTitle, SectionLabel } from '@/components/ui/Typography';
import ScreenHeader from '@/components/ui/ScreenHeader';
import { useTabBarClearance } from '@/components/navigation/FloatingTabBar';
import { GLASS_PRESETS, GLASS_STYLE_ORDER } from '@/lib/glass';
import { BACKGROUND_PRESETS, getBackgroundPreset } from '@/lib/backgrounds';
import { pickBackgroundPhoto } from '@/lib/backgroundPhoto';
import { decorative, a11yState } from '@/lib/accessibility';

const GRAIN_OPTIONS: { value: GrainLevel; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'subtle', label: 'Subtle' },
  { value: 'strong', label: 'Strong' },
];
const SWATCHES_PER_ROW = 5;
const SWATCH_GAP = 8;

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
    ttsEnabled, ttsAutoRead, ttsVoice, glassStyle,
    glassBackground, customBackgroundUri, grain,
    setPersona, setTimezoneAutoDetect, setCompanionName, setVoiceLocale,
    setTtsEnabled, setTtsAutoRead, setTtsVoice, setGlassStyle,
    setGlassBackground, setCustomBackground, setGrain,
    solidSurfaces, setSolidSurfaces,
    taskCarryOverEnabled, setTaskCarryOverEnabled,
  } = useSettingsStore();
  const tabClearance = useTabBarClearance();
  const [swatchGridWidth, setSwatchGridWidth] = useState(0);
  const swatchWidth =
    swatchGridWidth > 0
      ? (swatchGridWidth - SWATCH_GAP * (SWATCHES_PER_ROW - 1)) / SWATCHES_PER_ROW
      : 0;

  const handlePickPhoto = async () => {
    try {
      const uri = await pickBackgroundPhoto();
      if (uri) setCustomBackground(uri);
    } catch {
      Alert.alert('Couldn’t use that photo', 'Please try a different image.');
    }
  };

  // Tapping your photo selects it; tapping it again (or with no photo yet) picks a new one.
  const handlePhotoTile = () => {
    if (customBackgroundUri && glassBackground !== 'custom') setGlassBackground('custom');
    else handlePickPhoto();
  };
  const { user, signOut } = useAuthStore();
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

  const section = (label: string) => <SectionLabel style={styles.section}>{label}</SectionLabel>;

  return (
    <GlassBackground style={styles.container}>
      <ScreenHeader />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingHorizontal: theme.spacing.screen, paddingBottom: tabClearance },
        ]}
      >
        <DisplayTitle lead="Make it" title="yours" />

        {section('Account')}
        <SettingsGroup>
          {user ? (
            <SettingsRow kind="info" title={user.email ?? 'Signed in'} description="Signed in. Your data syncs across devices." />
          ) : (
            <SettingsRow kind="info" title="Guest mode" description="Sign in to sync your data across devices" />
          )}
          {user && (
            <SettingsRow kind="button" title="Sign out" tone={theme.colors.error} chevron={false} onPress={handleSignOut} />
          )}
        </SettingsGroup>

        {section('Theme')}
        <View style={styles.themeRow} accessibilityRole="radiogroup" accessibilityLabel="Theme">
          {(Object.keys(themes) as ThemeName[]).map((name) => {
            const t = themes[name];
            const selected = themeName === name;
            return (
              <Pressable
                key={name}
                testID={`theme-${name}`}
                accessibilityRole="radio"
                accessibilityLabel={t.label}
                accessibilityHint={t.description}
                {...a11yState({ checked: selected })}
                onPress={() => setTheme(name)}
                style={({ pressed }) => [styles.themeTile, pressed && { opacity: 0.8 }]}
              >
                <View
                  style={[
                    styles.themePreview,
                    { borderColor: selected ? theme.colors.primary : theme.colors.border },
                  ]}
                  {...decorative}
                >
                  {t.isGlass ? (
                    <>
                      <MeshBackground preset={getBackgroundPreset(glassBackground)} scale={0.4} />
                      <View style={styles.previewGlassChip} />
                    </>
                  ) : (
                    <>
                      <View style={[StyleSheet.absoluteFill, { backgroundColor: t.colors.background }]} />
                      <View style={styles.previewGlowChip}>
                        <GlowFill name="apricot" radius={14} />
                      </View>
                    </>
                  )}
                  {selected && (
                    <View style={[styles.checkBadge, { backgroundColor: theme.colors.primary }]}>
                      <FontAwesome name="check" size={10} color={theme.colors.onPrimary} />
                    </View>
                  )}
                </View>
                <Text style={[styles.themeName, { color: theme.colors.text }]}>{t.label}</Text>
                <Text style={[styles.themeDesc, { color: theme.colors.textSecondary }]}>
                  {t.description}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Wallpaper (Liquid Glass only) */}
        {theme.isGlass && (
          <>
            {section('Background')}
            <View
              style={styles.swatchGrid}
              accessibilityRole="radiogroup"
              accessibilityLabel="Background"
              onLayout={(e) => setSwatchGridWidth(e.nativeEvent.layout.width)}
            >
              {swatchWidth > 0 &&
                BACKGROUND_PRESETS.map((preset) => {
                  const selected = glassBackground === preset.id;
                  return (
                    <Pressable
                      key={preset.id}
                      testID={`bg-${preset.id}`}
                      accessibilityRole="radio"
                      accessibilityLabel={preset.name}
                      {...a11yState({ checked: selected })}
                      style={{ width: swatchWidth }}
                      onPress={() => setGlassBackground(preset.id)}
                    >
                      <View
                        style={[
                          styles.swatch,
                          { borderColor: selected ? theme.colors.primary : 'rgba(255,255,255,0.14)' },
                        ]}
                      >
                        <MeshBackground preset={preset} scale={swatchWidth / 375} />
                      </View>
                      <Text
                        style={[
                          styles.swatchName,
                          { color: selected ? theme.colors.text : theme.colors.textSecondary },
                        ]}
                        numberOfLines={1}
                      >
                        {preset.name}
                      </Text>
                    </Pressable>
                  );
                })}

              {swatchWidth > 0 && (
                <Pressable
                  testID="bg-custom"
                  accessibilityRole={customBackgroundUri ? 'radio' : 'button'}
                  accessibilityLabel={customBackgroundUri ? 'Your photo' : 'Add your own photo'}
                  {...a11yState(customBackgroundUri ? { checked: glassBackground === 'custom' } : undefined)}
                  style={{ width: swatchWidth }}
                  onPress={handlePhotoTile}
                >
                  <View
                    style={[
                      styles.swatch,
                      styles.photoSwatch,
                      {
                        borderColor:
                          glassBackground === 'custom' ? theme.colors.primary : 'rgba(255,255,255,0.28)',
                        borderStyle: customBackgroundUri ? 'solid' : 'dashed',
                      },
                    ]}
                  >
                    {customBackgroundUri ? (
                      <Image
                        source={{ uri: customBackgroundUri }}
                        resizeMode="cover"
                        style={StyleSheet.absoluteFill}
                      />
                    ) : (
                      <FontAwesome name="plus" size={18} color={theme.colors.textSecondary} />
                    )}
                  </View>
                  <Text
                    style={[
                      styles.swatchName,
                      { color: glassBackground === 'custom' ? theme.colors.text : theme.colors.textSecondary },
                    ]}
                    numberOfLines={1}
                  >
                    {customBackgroundUri ? 'Your photo' : 'Add photo'}
                  </Text>
                </Pressable>
              )}
            </View>

            {customBackgroundUri && (
              <View style={styles.photoActions}>
                <Pressable onPress={handlePickPhoto} accessibilityRole="button" hitSlop={12}>
                  <Text style={[styles.photoAction, { color: theme.colors.accent }]}>Change photo</Text>
                </Pressable>
                <Pressable onPress={() => setCustomBackground(null)} accessibilityRole="button" hitSlop={12}>
                  <Text style={[styles.photoAction, { color: theme.colors.error }]}>Remove photo</Text>
                </Pressable>
              </View>
            )}
          </>
        )}

        {section('Grain')}
        <PillTabs
          options={GRAIN_OPTIONS}
          value={grain}
          onChange={setGrain}
          layout="fill"
          semantics="radio"
          accessibilityLabel="Grain"
        />

        {/* Glass style (Liquid Glass only) */}
        {theme.isGlass && (
          <>
            {section('Glass style')}
            <View style={styles.glassStage} accessibilityRole="radiogroup" accessibilityLabel="Glass style">
              {/* Colorful backdrop so the difference between styles is visible */}
              <View style={StyleSheet.absoluteFill} {...decorative}>
                <View style={[styles.stageShape, { backgroundColor: '#F59E0B', width: 120, height: 120, top: -24, left: 6 }]} />
                <View style={[styles.stageShape, { backgroundColor: '#22D3EE', width: 90, height: 90, bottom: -14, left: 128 }]} />
                <View style={[styles.stageShape, { backgroundColor: '#EC4899', width: 110, height: 110, top: 8, right: -14 }]} />
                <View style={[styles.stageStripe, { top: 52 }]} />
                <View style={[styles.stageStripe, { top: 82 }]} />
              </View>
              {GLASS_STYLE_ORDER.map((style) => {
                const preset = GLASS_PRESETS[style];
                const selected = glassStyle === style;
                return (
                  <Pressable
                    key={style}
                    testID={`glass-${style}`}
                    accessibilityRole="radio"
                    accessibilityLabel={`${preset.label}, ${preset.subtitle.toLowerCase()}`}
                    {...a11yState({ checked: selected })}
                    style={styles.glassTileWrap}
                    onPress={() => setGlassStyle(style)}
                  >
                    <GlassCard
                      variant={style}
                      radius={20}
                      style={[
                        styles.glassTile,
                        selected && {
                          borderWidth: 2,
                          borderColor: theme.colors.primary,
                          borderTopColor: theme.colors.primary,
                          borderLeftColor: theme.colors.primary,
                        },
                      ]}
                    >
                      <Text style={styles.glassTileLabel}>{preset.label}</Text>
                      <Text style={styles.glassTileSub}>{preset.subtitle}</Text>
                    </GlassCard>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        {theme.isGlass && (
          <>
            {section('Readability')}
            <SettingsGroup>
              <SettingsRow
                kind="switch"
                title="Solid surfaces"
                description="Swap see-through glass for solid cards for the clearest text. Also turns on with your device's Increase Contrast or Reduce Transparency setting."
                value={solidSurfaces}
                onValueChange={setSolidSurfaces}
              />
            </SettingsGroup>
          </>
        )}

        {section('Companion')}
        <SettingsGroup accessibilityRole="radiogroup" accessibilityLabel="Personality">
          {PERSONAS.map((p) => (
            <SettingsRow
              key={p.value}
              kind="radio"
              title={p.label}
              description={p.description}
              selected={aiPersona === p.value}
              onPress={() => setPersona(p.value)}
            />
          ))}
        </SettingsGroup>
        <SettingsGroup>
          <View style={styles.inputRow}>
            <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]} {...decorative}>
              Name
            </Text>
            <TextInput
              style={[styles.nameInput, { color: theme.colors.text }]}
              value={companionName}
              onChangeText={setCompanionName}
              placeholder="Give your companion a name"
              placeholderTextColor={theme.colors.textTertiary}
              accessibilityLabel="Companion name"
              accessibilityHint="Your companion introduces itself with this name"
              returnKeyType="done"
              autoCorrect={false}
            />
          </View>
        </SettingsGroup>

        {section('Spoken replies')}
        <SettingsGroup>
          <SettingsRow
            kind="switch"
            title="Read replies aloud"
            description="Your companion can speak its messages"
            value={ttsEnabled}
            onValueChange={setTtsEnabled}
          />
          {ttsEnabled && (
            <SettingsRow
              kind="switch"
              title="Auto-read"
              description="Read every new reply automatically"
              value={ttsAutoRead}
              onValueChange={setTtsAutoRead}
            />
          )}
          {ttsEnabled && (
            <SettingsRow
              kind="button"
              title="Test voice"
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

        {ttsEnabled && availableVoices.length > 0 && (
          <SettingsGroup accessibilityRole="radiogroup" accessibilityLabel="Voice">
            {availableVoices.slice(0, 10).map((v) => (
              <SettingsRow
                key={v.identifier}
                kind="radio"
                title={v.name}
                description={v.language}
                selected={ttsVoice === v.identifier}
                onPress={() => setTtsVoice(v.identifier)}
              />
            ))}
          </SettingsGroup>
        )}

        {section('Voice input language')}
        <SettingsGroup accessibilityRole="radiogroup" accessibilityLabel="Voice input language">
          {VOICE_LOCALES.map((locale) => (
            <SettingsRow
              key={locale.value}
              kind="radio"
              title={locale.label}
              selected={voiceLocale === locale.value}
              onPress={() => setVoiceLocale(locale.value)}
            />
          ))}
        </SettingsGroup>

        {section('Time zone')}
        <SettingsGroup>
          <SettingsRow
            kind="switch"
            title="Set automatically"
            description={`Currently ${timezone}`}
            value={timezoneAutoDetect}
            onValueChange={setTimezoneAutoDetect}
          />
        </SettingsGroup>

        {section('Tasks')}
        <SettingsGroup>
          <SettingsRow
            kind="switch"
            title="Carry over unfinished tasks"
            description="Offer to move past-due, incomplete tasks to today"
            value={taskCarryOverEnabled}
            onValueChange={setTaskCarryOverEnabled}
          />
        </SettingsGroup>

        {section('Widget')}
        <Text style={[styles.hint, { color: theme.colors.textSecondary }]}>
          Choose what appears on your home screen widget.
        </Text>
        <WidgetSettingsSection />

        {section('Integrations')}
        <SettingsGroup>
          <SettingsRow
            kind="button"
            title="Google Calendar"
            description={`${googleStatusLabel}${syncState.isSyncing ? ', syncing' : ''}`}
            left={
              <View style={styles.googleIcon}>
                <FontAwesome name="google" size={16} color="#FFFFFF" />
              </View>
            }
            onPress={() => router.push('/google-calendar' as Href)}
          />
        </SettingsGroup>
      </ScrollView>
    </GlassBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    paddingTop: 4,
  },
  section: {
    marginTop: 30,
    marginBottom: 10,
    marginLeft: 4,
  },
  hint: {
    fontSize: 13,
    marginBottom: 10,
    marginLeft: 4,
  },
  themeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  themeTile: {
    flex: 1,
    gap: 4,
  },
  themePreview: {
    height: 128,
    borderRadius: 24,
    borderWidth: 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  previewGlassChip: {
    width: '62%',
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  previewGlowChip: {
    width: '62%',
    height: 44,
    borderRadius: 14,
    overflow: 'hidden',
  },
  checkBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeName: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 4,
  },
  themeDesc: {
    fontSize: 12,
    lineHeight: 16,
    marginLeft: 4,
  },
  swatchGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: SWATCH_GAP,
    rowGap: 12,
  },
  swatch: {
    aspectRatio: 0.62, // portrait, like a phone wallpaper
    borderRadius: 14,
    borderWidth: 2,
    overflow: 'hidden',
  },
  photoSwatch: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  swatchName: {
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 5,
  },
  photoActions: {
    flexDirection: 'row',
    gap: 24,
    marginTop: 14,
    marginLeft: 4,
  },
  photoAction: {
    fontSize: 14,
    fontWeight: '600',
  },
  glassStage: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#13224A',
  },
  stageShape: {
    position: 'absolute',
    borderRadius: 999,
  },
  stageStripe: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.75)',
  },
  glassTileWrap: {
    flex: 1,
  },
  glassTile: {
    minHeight: 110,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  glassTileLabel: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '500',
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowRadius: 6,
  },
  glassTileSub: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    marginTop: 4,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowRadius: 6,
  },
  inputRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 4,
    minHeight: 56,
    justifyContent: 'center',
  },
  inputLabel: {
    fontSize: 12,
  },
  nameInput: {
    fontSize: 16,
    fontWeight: '500',
    paddingVertical: 4,
  },
  googleIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#4285F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
