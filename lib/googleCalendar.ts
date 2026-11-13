/**
 * lib/googleCalendar.ts
 *
 * Google Calendar lives on the server: the gcal-sync edge function pulls the
 * user's selected calendars into the events table (every 10 minutes and on
 * demand), and edits go back to Google through event-write. The app only
 * connects, picks calendars, and reads rows.
 */

import { supabase } from './supabase';
import { useSyncStore } from '@/stores/syncStore';
import type { GoogleCalendarInfo } from '@/types';

interface DbGoogleCalendar {
  calendar_id: string;
  summary: string;
  background_color: string;
  is_primary: boolean;
  selected: boolean;
  bots_can_write: boolean;
  last_synced_at: string | null;
}

function fromDbCalendar(row: DbGoogleCalendar): GoogleCalendarInfo {
  return {
    id: row.calendar_id,
    summary: row.summary,
    backgroundColor: row.background_color,
    foregroundColor: '#ffffff',
    primary: row.is_primary,
    selected: row.selected,
    botsCanWrite: row.bots_can_write,
  };
}

async function invoke<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    // FunctionsHttpError keeps the function's JSON body on `context`.
    const detail = await (error as any).context?.json?.().catch(() => null);
    throw new Error(detail?.error ?? error.message);
  }
  return data as T;
}

/** Reads the user's Google calendars from Supabase into the sync store. */
export async function loadGoogleCalendars(): Promise<GoogleCalendarInfo[]> {
  const { data, error } = await supabase
    .from('google_calendars')
    .select('calendar_id, summary, background_color, is_primary, selected, bots_can_write, last_synced_at')
    .order('is_primary', { ascending: false })
    .order('summary');
  if (error) throw error;
  const rows = (data ?? []) as DbGoogleCalendar[];
  const calendars = rows.map(fromDbCalendar);
  const store = useSyncStore.getState();
  store.setGoogleCalendars(calendars);
  const synced = rows.map((r) => r.last_synced_at).filter(Boolean).sort().pop();
  if (synced) store.setLastSync(new Date(synced));
  return calendars;
}

/** Hands the refresh token from Google sign-in to the server and runs a first sync. */
export async function connectGoogle(refreshToken: string): Promise<void> {
  await invoke('google-connect', { refreshToken });
  await loadGoogleCalendars();
}

/** Forgets the Google credentials and removes every synced Google event. */
export async function disconnectGoogle(): Promise<void> {
  await invoke('google-connect', { disconnect: true });
  useSyncStore.getState().clearSync();
}

/** Asks the server to sync now. New rows arrive over Realtime and the next pull. */
export async function syncGoogleNow(): Promise<void> {
  const store = useSyncStore.getState();
  store.setSyncing(true);
  try {
    const result = await invoke<{ connected: boolean; results?: Record<string, { error?: string }> }>('gcal-sync', {});
    if (!result.connected) {
      store.setSyncError('Reconnect Google Calendar to keep syncing.');
      return;
    }
    const failed = Object.values(result.results ?? {}).find((r) => r.error);
    await loadGoogleCalendars();
    if (failed?.error) store.setSyncError(failed.error);
  } catch (err) {
    store.setSyncError(err instanceof Error ? err.message : 'Sync failed');
  } finally {
    store.setSyncing(false);
  }
}

async function setCalendarFlag(
  calendarId: string,
  column: 'selected' | 'bots_can_write',
  value: boolean
): Promise<void> {
  const { error } = await supabase
    .from('google_calendars')
    .update({ [column]: value })
    .eq('calendar_id', calendarId);
  if (error) {
    await loadGoogleCalendars().catch(() => {});
    throw error;
  }
}

export async function setCalendarSelected(calendarId: string, selected: boolean): Promise<void> {
  await setCalendarFlag(calendarId, 'selected', selected);
  // The server adds or removes that calendar's events on the next sync; run it now.
  await syncGoogleNow();
}

export function setCalendarBotsCanWrite(calendarId: string, value: boolean): Promise<void> {
  return setCalendarFlag(calendarId, 'bots_can_write', value);
}
