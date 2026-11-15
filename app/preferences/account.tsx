import { Alert, Platform } from 'react-native';
import { useThemeStore } from '@/stores/themeStore';
import { useAuthStore } from '@/stores/authStore';
import SettingsPage from '@/components/settings/SettingsPage';
import { SettingsGroup, SettingsRow, SettingsSection } from '@/components/ui/Settings';

/** Who's signed in, and signing in or out. */
export default function AccountScreen() {
  const { theme } = useThemeStore();
  const { user, signOut } = useAuthStore();

  const confirmSignOut = () => {
    // react-native-web's Alert is a no-op, so the browser's own dialog confirms there.
    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to sign out?')) signOut();
      return;
    }
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  return (
    <SettingsPage title="Account">
      <SettingsSection>
        <SettingsGroup>
          {user ? (
            <SettingsRow
              kind="info"
              title={user.email ?? 'Signed in'}
              description="Signed in. Your data syncs across devices."
            />
          ) : (
            <SettingsRow
              kind="info"
              title="Guest mode"
              description="Your data stays on this device. Sign in to sync it across devices."
            />
          )}
        </SettingsGroup>
        <SettingsGroup>
          {user ? (
            <SettingsRow
              kind="button"
              testID="sign-out"
              title="Sign out"
              tone={theme.colors.error}
              chevron={false}
              onPress={confirmSignOut}
            />
          ) : (
            // Leaving guest mode returns to the sign-in screen.
            <SettingsRow
              kind="button"
              testID="sign-in"
              title="Sign in or create an account"
              tone={theme.colors.accent}
              onPress={() => signOut()}
            />
          )}
        </SettingsGroup>
      </SettingsSection>
    </SettingsPage>
  );
}
