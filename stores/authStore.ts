import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { syncAll, pushSettings } from '@/lib/sync';
import { useCalendarStore } from './calendarStore';
import { useTaskStore } from './taskStore';
import { useHabitStore } from './habitStore';
import { useGoalStore } from './goalStore';
import { useSettingsStore } from './settingsStore';
import { useThemeStore } from './themeStore';
import { Platform } from 'react-native';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import type { User, Session } from '@supabase/supabase-js';
import type { AIPersona } from '@/types';

const GOOGLE_TOKEN_KEY = 'meep_google_token';
const ENABLE_APPLE_SIGN_IN = process.env.EXPO_PUBLIC_ENABLE_APPLE_SIGN_IN === 'true';

// Only needed for the native popup OAuth flow — on web the browser handles session
// restoration via detectSessionInUrl and this would throw a cross-origin error.
if (Platform.OS !== 'web') {
  WebBrowser.maybeCompleteAuthSession();
}

interface AuthState {
  user: User | null;
  session: Session | null;
  googleToken: string | null;
  isLoading: boolean;
  isGuest: boolean;

  initialize: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  continueAsGuest: () => void;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  session: null,
  googleToken: null,
  isLoading: true,
  isGuest: false,

  initialize: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // provider_token is only present right after OAuth sign-in, not on
        // session restore. Fall back to our persisted copy.
        const freshProviderToken = session.provider_token ?? null;
        const storedToken = await AsyncStorage.getItem(GOOGLE_TOKEN_KEY);
        const googleToken = freshProviderToken ?? storedToken;

        if (freshProviderToken) {
          // Persist the fresh token so it survives reloads
          await AsyncStorage.setItem(GOOGLE_TOKEN_KEY, freshProviderToken);
        }

        set({ user: session.user, session, googleToken, isLoading: false });
        // Sync data on app launch if logged in
        performSync(session.user.id);
      } else {
        set({ isLoading: false });
      }

      // Listen for auth changes
      supabase.auth.onAuthStateChange(async (_event, session) => {
        const prev = get().user;
        const freshProviderToken = session?.provider_token ?? null;

        // Persist new provider token when available (fresh OAuth sign-in)
        if (freshProviderToken) {
          await AsyncStorage.setItem(GOOGLE_TOKEN_KEY, freshProviderToken);
        }

        set({
          user: session?.user ?? null,
          session: session ?? null,
          // Keep existing googleToken if provider_token isn't in this event
          googleToken: freshProviderToken ?? get().googleToken,
        });
        // Sync when user signs in (not on token refresh)
        if (session?.user && !prev) {
          performSync(session.user.id);
        }
      });
    } catch {
      set({ isLoading: false });
    }
  },

  signInWithGoogle: async () => {
    const scopes = 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events';

    if (Platform.OS === 'web') {
      // Web: full-page redirect — Supabase detects the session from the URL hash on return
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
          scopes,
        },
      });
      if (error) throw error;
      // Browser redirects away; onAuthStateChange fires on return and sets googleToken
      return;
    }

    // Native: popup flow via expo-web-browser
    const redirectUrl = AuthSession.makeRedirectUri();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectUrl, scopes },
    });

    if (error) throw error;
    if (data?.url) {
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
      if (result.type === 'success' && result.url) {
        // Extract tokens from the redirect URL hash
        const url = new URL(result.url);
        const params = new URLSearchParams(url.hash.substring(1));
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        const providerToken = params.get('provider_token');
        if (accessToken && refreshToken) {
          await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        }
        if (providerToken) {
          await AsyncStorage.setItem(GOOGLE_TOKEN_KEY, providerToken);
          set({ googleToken: providerToken });
        }
      }
    }
  },

  signInWithApple: async () => {
    if (!ENABLE_APPLE_SIGN_IN) {
      throw new Error('Apple Sign-In is currently disabled.');
    }

    if (Platform.OS !== 'ios') {
      throw new Error('Apple Sign-In is only available on iOS.');
    }

    const rawNonce = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const hashedNonce = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      rawNonce
    );

    let credential: AppleAuthentication.AppleAuthenticationCredential;
    try {
      credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });
    } catch (err: any) {
      if (err?.code === 'ERR_REQUEST_CANCELED') {
        return;
      }
      throw err;
    }

    if (!credential.identityToken) {
      throw new Error('Apple Sign-In did not return an identity token.');
    }

    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
      nonce: rawNonce,
    });

    if (error) throw error;
  },

  signInWithEmail: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return {};
  },

  signUp: async (email, password) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message };
    return {};
  },

  signOut: async () => {
    await AsyncStorage.removeItem(GOOGLE_TOKEN_KEY);
    await supabase.auth.signOut();
    set({ user: null, session: null, googleToken: null, isGuest: false });
  },

  continueAsGuest: () => {
    set({ isGuest: true, isLoading: false });
  },
}));

/** Pull remote data, merge with local, and update all stores */
async function performSync(userId: string) {
  try {
    const merged = await syncAll(userId);

    useCalendarStore.getState().setEvents(merged.events);
    useTaskStore.getState().setTasks(merged.tasks);
    useHabitStore.getState().setHabits(merged.habits);
    useGoalStore.getState().setGoals(merged.goals);

    // Apply remote settings if they exist
    if (merged.settings) {
      const settings = useSettingsStore.getState();
      settings.setPersona(merged.settings.aiPersona as AIPersona);
      settings.setCompanionName(merged.settings.companionName);
      settings.setVoiceLocale(merged.settings.voiceLocale);
      if (merged.settings.theme) {
        useThemeStore.getState().setTheme(merged.settings.theme as any);
      }
    } else {
      // First login — push local settings to remote
      const settings = useSettingsStore.getState();
      const themeName = useThemeStore.getState().themeName;
      await pushSettings(userId, {
        aiPersona: settings.aiPersona,
        timezone: settings.timezone,
        timezoneAutoDetect: settings.timezoneAutoDetect,
        companionName: settings.companionName,
        voiceLocale: settings.voiceLocale,
        theme: themeName,
      });
    }
  } catch (err) {
    console.warn('[sync] Initial sync failed:', err);
  }
}
