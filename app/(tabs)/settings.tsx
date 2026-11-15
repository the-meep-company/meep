import { Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import Constants from 'expo-constants';
import { useThemeStore } from '@/stores/themeStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useAuthStore } from '@/stores/authStore';
import { useSyncStore } from '@/stores/syncStore';
import GlassBackground from '@/components/common/GlassBackground';
import { SettingsGroup, SettingsRow, SettingsSection } from '@/components/ui/Settings';
import { DisplayTitle } from '@/components/ui/Typography';
import ScreenHeader, { GlowAvatar } from '@/components/ui/ScreenHeader';
import { useTabBarClearance } from '@/components/navigation/FloatingTabBar';
import { getBackgroundPreset } from '@/lib/backgrounds';
import { timeZoneCity } from '@/lib/timezones';

/** Settings home: a short list of rows, each opening its own page under /preferences. */
export default function SettingsScreen() {
  const router = useRouter();
  const { theme } = useThemeStore();
  const {
    companionName, ttsEnabled, timezone, timezoneAutoDetect, widgetCategory,
    glassBackground, customBackgroundUri,
    taskCarryOverEnabled, setTaskCarryOverEnabled,
  } = useSettingsStore();
  const { user } = useAuthStore();
  const { googleCalendars, syncState } = useSyncStore();
  const tabClearance = useTabBarClearance();

  const open = (page: string) => () => router.push(`/preferences/${page}` as Href);

  const wallpaper =
    glassBackground === 'custom' && customBackgroundUri
      ? 'Your photo'
      : getBackgroundPreset(glassBackground).name;

  const googleStatus = syncState.isSyncing
    ? 'Syncing'
    : googleCalendars.length > 0
    ? `${googleCalendars.length} calendar${googleCalendars.length > 1 ? 's' : ''}`
    : 'Not connected';

  return (
    <GlassBackground style={styles.container} centered>
      <ScreenHeader />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingHorizontal: theme.spacing.screen, paddingBottom: tabClearance }}
        showsVerticalScrollIndicator={false}
      >
        <DisplayTitle lead="Make it" title="yours" style={styles.title} />

        <SettingsGroup>
          <SettingsRow
            kind="button"
            testID="settings-account"
            title={user ? user.email ?? 'Signed in' : 'Guest mode'}
            description={user ? 'Synced across your devices' : 'Sign in to sync across devices'}
            left={<GlowAvatar initial={user?.email ?? companionName} />}
            onPress={open('account')}
          />
        </SettingsGroup>

        <SettingsSection label="Personalise">
          <SettingsGroup>
            <SettingsRow
              kind="button"
              testID="settings-appearance"
              icon="paint-brush"
              title="Appearance"
              value={wallpaper}
              onPress={open('appearance')}
            />
            <SettingsRow
              kind="button"
              testID="settings-companion"
              icon="magic"
              title="Companion"
              value={companionName}
              onPress={open('companion')}
            />
            <SettingsRow
              kind="button"
              testID="settings-voice"
              icon="volume-up"
              title="Voice"
              value={ttsEnabled ? 'On' : 'Off'}
              onPress={open('voice')}
            />
          </SettingsGroup>
        </SettingsSection>

        <SettingsSection label="Planning">
          <SettingsGroup>
            <SettingsRow
              kind="switch"
              testID="settings-carry-over"
              icon="share"
              title="Carry over unfinished tasks"
              value={taskCarryOverEnabled}
              onValueChange={setTaskCarryOverEnabled}
            />
            <SettingsRow
              kind="button"
              testID="settings-time-zone"
              icon="globe"
              title="Time zone"
              value={timezoneAutoDetect ? 'Automatic' : timeZoneCity(timezone)}
              onPress={open('time-zone')}
            />
            {/* The home screen widget exists on iOS only. */}
            {Platform.OS === 'ios' && (
              <SettingsRow
                kind="button"
                testID="settings-widget"
                icon="th-large"
                title="Widget tasks"
                value={widgetCategory ?? 'All tasks'}
                onPress={open('widget')}
              />
            )}
          </SettingsGroup>
        </SettingsSection>

        <SettingsSection label="Connections">
          <SettingsGroup>
            <SettingsRow
              kind="button"
              testID="settings-google-calendar"
              icon="google"
              iconBackground="#4285F4"
              title="Google Calendar"
              value={googleStatus}
              onPress={() => router.push('/google-calendar' as Href)}
            />
          </SettingsGroup>
        </SettingsSection>

        <Text style={[styles.version, { color: theme.colors.textTertiary }]}>
          Meep {Constants.expoConfig?.version ?? ''}
        </Text>
      </ScrollView>
    </GlassBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1, backgroundColor: 'transparent' },
  title: { marginTop: 4, marginBottom: 20 },
  version: { fontSize: 12, textAlign: 'center', marginTop: 20 },
});
