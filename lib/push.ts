import { useEffect } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { supabase } from './supabase';

// Bot notifications are opt-in per bot ("Notify me"). The server sends them
// through Expo's push service (supabase/functions/_shared/push.ts) to the
// tokens registered here. Quiet by design: no sound, no badge, and nothing
// while the app is open, since the feed updates live.

const native = Platform.OS === 'ios' || Platform.OS === 'android';
let registeredToken: string | null = null;

if (native) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: false,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Registers this device for bot notifications. With `ask`, shows the system
 * prompt if the user hasn't answered it yet; otherwise only refreshes the token
 * when permission is already granted. Returns whether the device is registered.
 */
export async function registerForPush({ ask }: { ask: boolean }): Promise<boolean> {
  if (!native) return false;
  try {
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted' && ask) {
      ({ status } = await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowBadge: false, allowSound: false },
      }));
    }
    if (status !== 'granted') return false;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) {
      console.warn('[push] No EAS projectId in the app config; run `eas init` to enable bot notifications.');
      return false;
    }
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    const { error } = await supabase.rpc('register_push_token', { p_token: token, p_platform: Platform.OS });
    if (error) throw error;
    registeredToken = token;
    return true;
  } catch (err) {
    console.warn('[push] Could not register for notifications:', err);
    return false;
  }
}

/** Stops this device getting the signed-out user's notifications. */
export async function unregisterForPush(): Promise<void> {
  if (!registeredToken) return;
  await supabase.rpc('unregister_push_token', { p_token: registeredToken }).then(
    () => undefined,
    () => undefined
  );
  registeredToken = null;
}

/** Tapping a bot notification opens the feed. */
export function useNotificationTaps() {
  const router = useRouter();
  useEffect(() => {
    if (!native) return;
    const sub = Notifications.addNotificationResponseReceivedListener(() => router.navigate('/(tabs)/chat'));
    return () => sub.remove();
  }, [router]);
}
