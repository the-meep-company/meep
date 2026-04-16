import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://qvqcfkjmflvkochasfdz.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2cWNma2ptZmx2a29jaGFzZmR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNDc5MzAsImV4cCI6MjA5MTcyMzkzMH0.bMne5Q838ZAUa92eb5v8-aXCbYhFgxsiiNt3O8J_Y58';

// Use AsyncStorage on native/web client, but fall back to a no-op store
// during SSR (expo export) where `window` is not defined.
const isSSR = Platform.OS === 'web' && typeof window === 'undefined';

const noopStorage = {
  getItem: () => Promise.resolve(null),
  setItem: () => Promise.resolve(),
  removeItem: () => Promise.resolve(),
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: isSSR ? noopStorage : AsyncStorage,
    autoRefreshToken: !isSSR,
    persistSession: !isSSR,
    detectSessionInUrl: Platform.OS === 'web' && !isSSR,
  },
});
