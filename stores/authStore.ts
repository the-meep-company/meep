import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { syncAll, pushSettings, pullFeed } from '@/lib/sync';
import { seedStarterBots } from '@/lib/bots';
import { registerForPush, unregisterForPush } from '@/lib/push';
import { connectGoogle, loadGoogleCalendars } from '@/lib/googleCalendar';
import { subscribeToChanges, unsubscribeFromChanges } from '@/lib/realtime';
import { useCalendarStore } from './calendarStore';
import { useTaskStore } from './taskStore';
import { useHabitStore } from './habitStore';
import { useGoalStore } from './goalStore';
import { useSettingsStore } from './settingsStore';
import { useThemeStore } from './themeStore';
import { useMeepleStore } from './meepleStore';
import { useFeedStore } from './feedStore';
import { AppState, Platform } from 'react-native';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import type { User, Session } from '@supabase/supabase-js';
import type { AIPersona } from '@/types';

// The short-lived Google access token the app used to keep; Google now lives on
// the server, so this is only cleared on sign-out.
const LEGACY_GOOGLE_TOKEN_KEY = 'meep_google_token';
// Pull again when the app returns to the foreground, at most this often.
const FOREGROUND_SYNC_MS = 30_000;
const ENABLE_APPLE_SIGN_IN = process.env.EXPO_PUBLIC_ENABLE_APPLE_SIGN_IN === 'true';

// Only needed for the native popup OAuth flow — on web the browser handles session
// restoration via detectSessionInUrl and this would throw a cross-origin error.
if (Platform.OS !== 'web') {
  WebBrowser.maybeCompleteAuthSession();
}

interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isGuest: boolean;

  initialize: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string) => Promise<{ error?: string }>;
  resendSignUpEmail: (email: string) => Promise<{ error?: string }>;
  resetPassword: (email: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  continueAsGuest: () => void;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  session: null,
  isLoading: true,
  isGuest: false,

  initialize: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        set({ user: session.user, session, isLoading: false });
        // Sync data on app launch if logged in
        performSync(session.user.id);
        subscribeToChanges(session.user.id);
      } else {
        set({ isLoading: false });
      }

      // Listen for auth changes
      supabase.auth.onAuthStateChange((_event, session) => {
        const prev = get().user;
        set({ user: session?.user ?? null, session: session ?? null });

        // provider_refresh_token is only present right after a Google OAuth sign-in
        // (the web redirect flow lands here); the server keeps it from then on.
        const refreshToken = session?.provider_refresh_token;
        if (refreshToken) connectGoogle(refreshToken).catch((e) => console.warn('[google] connect failed:', e));

        // Sync when user signs in (not on token refresh)
        if (session?.user && !prev) {
          performSync(session.user.id);
          subscribeToChanges(session.user.id);
        }
      });

      // Bots and Google sync change data while the app is in the background.
      let lastForegroundSync = Date.now();
      AppState.addEventListener('change', (state) => {
        const user = get().user;
        if (state !== 'active' || !user || Date.now() - lastForegroundSync < FOREGROUND_SYNC_MS) return;
        lastForegroundSync = Date.now();
        performSync(user.id);
      });
    } catch {
      set({ isLoading: false });
    }
  },

  signInWithGoogle: async () => {
    const scopes = 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events';
    // Offline access + consent makes Google return a refresh token every time,
    // which the server stores so Google sync and bots work while the app is closed.
    const queryParams = { access_type: 'offline', prompt: 'consent' };

    if (Platform.OS === 'web') {
      // Web: full-page redirect — Supabase detects the session from the URL hash on return
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
          scopes,
          queryParams,
        },
      });
      if (error) throw error;
      // Browser redirects away; onAuthStateChange fires on return and connects Google
      return;
    }

    // Native: popup flow via expo-web-browser
    const redirectUrl = AuthSession.makeRedirectUri();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectUrl, scopes, queryParams },
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
        const providerRefreshToken = params.get('provider_refresh_token');
        if (accessToken && refreshToken) {
          await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        }
        if (providerRefreshToken) {
          await connectGoogle(providerRefreshToken);
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

  resendSignUpEmail: async (email) => {
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    if (error) return { error: error.message };
    return {};
  },

  resetPassword: async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) return { error: error.message };
    return {};
  },

  signOut: async () => {
    unsubscribeFromChanges();
    await unregisterForPush();
    await AsyncStorage.removeItem(LEGACY_GOOGLE_TOKEN_KEY);
    await supabase.auth.signOut();
    set({ user: null, session: null, isGuest: false });
  },

  continueAsGuest: () => {
    set({ isGuest: true, isLoading: false });
  },
}));

/** Pull remote data (the server wins), keep new local rows, and update all stores */
async function performSync(userId: string) {
  try {
    const merged = await syncAll(userId);

    useCalendarStore.getState().setEvents(merged.events);
    useTaskStore.getState().setTasks(merged.tasks);
    useHabitStore.getState().setHabits(merged.habits);
    useGoalStore.getState().setGoals(merged.goals);
    useMeepleStore.getState().setMeeples(merged.meeples);
    loadGoogleCalendars().catch(() => {});
    pullFeed(userId).then((items) => useFeedStore.getState().setItems(items)).catch(() => {});

    // Apply remote settings if they exist
    if (merged.settings) {
      const settings = useSettingsStore.getState();
      settings.setPersona(merged.settings.aiPersona as AIPersona);
      settings.setCompanionName(merged.settings.companionName);
      settings.setVoiceLocale(merged.settings.voiceLocale);
      if (merged.settings.theme) {
        useThemeStore.getState().setTheme(merged.settings.theme);
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

    // After settings exist remotely, so the seeded list has a row to live on.
    await seedStarterBots(userId);
    // Keep this device's token fresh if any bot may notify (never prompts here).
    if (useMeepleStore.getState().meeples.some((m) => m.pushEnabled)) registerForPush({ ask: false });
  } catch (err) {
    console.warn('[sync] Initial sync failed:', err);
  }
}
