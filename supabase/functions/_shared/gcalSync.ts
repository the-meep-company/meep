import { admin } from './admin.ts';
import { accessTokenFor, GoogleError, googleEventToRow, googleRowId, listCalendars, listEvents } from './google.ts';
import { isValidTimeZone } from './time.ts';

// Pulls a user's selected Google calendars into the events table. Supabase is the
// source of truth: the app reads these rows (and Realtime) instead of Google.

const WINDOW_BACK_DAYS = 31;
const WINDOW_AHEAD_DAYS = 92;

export async function userTimezone(userId: string): Promise<string> {
  const { data } = await admin.from('user_settings').select('timezone').eq('user_id', userId).maybeSingle();
  return isValidTimeZone(data?.timezone) ? data!.timezone : 'UTC';
}

interface CalendarRow {
  calendar_id: string;
  background_color: string;
  selected: boolean;
  sync_token: string | null;
}

/** Refreshes the calendar list. New calendars start selected only if primary. */
async function refreshCalendars(userId: string, token: string): Promise<CalendarRow[]> {
  const remote = await listCalendars(token);
  const { data: existing, error } = await admin
    .from('google_calendars')
    .select('calendar_id')
    .eq('user_id', userId);
  if (error) throw error;
  const known = new Set((existing ?? []).map((c) => c.calendar_id));

  const meta = (c: (typeof remote)[number]) => ({
    user_id: userId,
    calendar_id: c.id,
    summary: c.summary,
    background_color: c.backgroundColor ?? '#4285F4',
    is_primary: c.primary ?? false,
    access_role: c.accessRole ?? null,
  });

  const fresh = remote.filter((c) => !known.has(c.id)).map((c) => ({ ...meta(c), selected: c.primary ?? false }));
  const updates = remote.filter((c) => known.has(c.id)).map(meta);
  if (fresh.length) {
    const { error: e } = await admin.from('google_calendars').insert(fresh);
    if (e) throw e;
  }
  if (updates.length) {
    const { error: e } = await admin.from('google_calendars').upsert(updates, { onConflict: 'user_id,calendar_id' });
    if (e) throw e;
  }

  const { data, error: e } = await admin
    .from('google_calendars')
    .select('calendar_id, background_color, selected, sync_token')
    .eq('user_id', userId);
  if (e) throw e;
  return data ?? [];
}

async function syncCalendar(userId: string, token: string, cal: CalendarRow, tz: string) {
  const now = Date.now();
  const timeMin = new Date(now - WINDOW_BACK_DAYS * 86400000).toISOString();
  const timeMax = new Date(now + WINDOW_AHEAD_DAYS * 86400000).toISOString();

  let result;
  let full = !cal.sync_token;
  try {
    result = await listEvents(token, cal.calendar_id, { syncToken: cal.sync_token, timeMin, timeMax });
  } catch (err) {
    if (!(err instanceof GoogleError && err.status === 410)) throw err;
    full = true;
    result = await listEvents(token, cal.calendar_id, { timeMin, timeMax });
  }

  // Rows we already hold for this calendar, so events Meep created in Google
  // (with a Meep id) keep their id instead of getting a second row.
  const { data: existing, error } = await admin
    .from('events')
    .select('id, google_event_id')
    .eq('user_id', userId)
    .eq('google_calendar_id', cal.calendar_id);
  if (error) throw error;
  const idByGoogleId = new Map((existing ?? []).map((r) => [r.google_event_id as string, r.id as string]));

  const upserts = [];
  const deletes: string[] = [];
  for (const ge of result.events) {
    const id = idByGoogleId.get(ge.id);
    if (ge.status === 'cancelled') {
      if (id) deletes.push(id);
      continue;
    }
    upserts.push({ id: id ?? googleRowId(userId, ge.id), ...googleEventToRow(userId, cal.calendar_id, cal.background_color, ge, tz) });
  }

  if (full) {
    // A full listing is complete for the window: anything else we hold in it is gone.
    const seen = new Set(result.events.map((e) => e.id));
    const { data: inWindow } = await admin
      .from('events')
      .select('id, google_event_id')
      .eq('user_id', userId)
      .eq('google_calendar_id', cal.calendar_id)
      .gte('start_time', timeMin)
      .lte('start_time', timeMax);
    for (const r of inWindow ?? []) if (!seen.has(r.google_event_id)) deletes.push(r.id);
  }

  for (let i = 0; i < upserts.length; i += 200) {
    const { error: e } = await admin.from('events').upsert(upserts.slice(i, i + 200));
    if (e) throw e;
  }
  if (deletes.length) {
    const { error: e } = await admin.from('events').delete().eq('user_id', userId).in('id', deletes);
    if (e) throw e;
  }

  const { error: e } = await admin
    .from('google_calendars')
    .update({ sync_token: result.nextSyncToken, last_synced_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('calendar_id', cal.calendar_id);
  if (e) throw e;

  return { upserted: upserts.length, deleted: deletes.length };
}

/** Syncs one user. Returns connected: false when they have no stored Google credentials. */
export async function syncUser(userId: string) {
  const token = await accessTokenFor(userId);
  if (!token) return { connected: false as const };

  const tz = await userTimezone(userId);
  const calendars = await refreshCalendars(userId, token);

  // Calendars the user stopped syncing: drop their events and start fresh next time.
  const unselected = calendars.filter((c) => !c.selected).map((c) => c.calendar_id);
  if (unselected.length) {
    await admin.from('events').delete().eq('user_id', userId).in('google_calendar_id', unselected);
    await admin.from('google_calendars').update({ sync_token: null }).eq('user_id', userId).in('calendar_id', unselected);
  }

  const results: Record<string, { upserted: number; deleted: number } | { error: string }> = {};
  for (const cal of calendars.filter((c) => c.selected)) {
    try {
      results[cal.calendar_id] = await syncCalendar(userId, token, cal, tz);
    } catch (err) {
      results[cal.calendar_id] = { error: err instanceof Error ? err.message : String(err) };
    }
  }
  return { connected: true as const, results };
}
