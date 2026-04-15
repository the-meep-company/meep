import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { syncAll, pushSettings } from '@/lib/sync';
import { useCalendarStore } from './calendarStore';
import { useTaskStore } from './taskStore';
import { useHabitStore } from './habitStore';
import { useGoalStore } from './goalStore';
import { useSettingsStore } from './settingsStore';
import { useThemeStore } from './themeStore';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import type { User, Session } from '@supabase/supabase-js';
import type { AIPersona } from '@/types';

WebBrowser.maybeCompleteAuthSession();

interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isGuest: boolean;

  initialize: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string) => Promise<{ error?: string }>;
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
      } else {
        set({ isLoading: false });
      }

      // Listen for auth changes
      supabase.auth.onAuthStateChange((_event, session) => {
        const prev = get().user;
        set({
          user: session?.user ?? null,
          session: session ?? null,
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
    const redirectUrl = AuthSession.makeRedirectUri();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectUrl },
    });

    if (error) throw error;
    if (data?.url) {
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
      if (result.type === 'success' && result.url) {
        // Extract tokens from the redirect URL
        const url = new URL(result.url);
        const params = new URLSearchParams(url.hash.substring(1));
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        if (accessToken && refreshToken) {
          await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        }
      }
    }
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
    await supabase.auth.signOut();
    set({ user: null, session: null, isGuest: false });
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
