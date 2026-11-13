import { admin } from './admin.ts';
import { zonedToUtc, zonedYmd } from './time.ts';

// Server-side Google Calendar access. The refresh token was issued to the same
// OAuth client Supabase Auth uses for Google sign-in, so GOOGLE_CLIENT_ID and
// GOOGLE_CLIENT_SECRET must be that client's credentials.

const API = 'https://www.googleapis.com/calendar/v3';

export class GoogleError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export interface GoogleDateTime {
  dateTime?: string;
  date?: string;
  timeZone?: string;
}

export interface GoogleEvent {
  id: string;
  etag?: string;
  summary?: string;
  description?: string;
  location?: string;
  start: GoogleDateTime;
  end: GoogleDateTime;
  status?: 'confirmed' | 'tentative' | 'cancelled';
  colorId?: string;
  attendees?: { email?: string; self?: boolean }[];
}

export interface GoogleCalendarEntry {
  id: string;
  summary: string;
  backgroundColor?: string;
  primary?: boolean;
  accessRole?: string;
}

/** Exchanges the user's stored refresh token for an access token, or null if not connected. */
export async function accessTokenFor(userId: string): Promise<string | null> {
  const { data: refreshToken, error } = await admin.rpc('get_google_refresh_token', { p_user_id: userId });
  if (error) throw error;
  if (!refreshToken) return null;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('GOOGLE_CLIENT_ID')!,
      client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
      refresh_token: refreshToken as string,
      grant_type: 'refresh_token',
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new GoogleError(res.status, `Google token refresh failed: ${body.error ?? res.status}`);
  return body.access_token as string;
}

async function call<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  if (!res.ok) throw new GoogleError(res.status, `Google Calendar ${res.status}: ${await res.text()}`);
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export async function listCalendars(token: string): Promise<GoogleCalendarEntry[]> {
  const data = await call<{ items?: GoogleCalendarEntry[] }>(token, '/users/me/calendarList');
  return data.items ?? [];
}

/**
 * All pages of a calendar's events. With a sync token it returns only changes;
 * a 410 means the token expired and the caller should run a full sync.
 */
export async function listEvents(
  token: string,
  calendarId: string,
  opts: { syncToken?: string | null; timeMin: string; timeMax: string }
): Promise<{ events: GoogleEvent[]; nextSyncToken: string | null }> {
  const events: GoogleEvent[] = [];
  let pageToken: string | undefined;
  let nextSyncToken: string | null = null;

  do {
    const params = new URLSearchParams({ singleEvents: 'true', maxResults: '250' });
    if (opts.syncToken) {
      params.set('syncToken', opts.syncToken);
    } else {
      params.set('timeMin', opts.timeMin);
      params.set('timeMax', opts.timeMax);
    }
    if (pageToken) params.set('pageToken', pageToken);

    const data = await call<{ items?: GoogleEvent[]; nextPageToken?: string; nextSyncToken?: string }>(
      token,
      `/calendars/${encodeURIComponent(calendarId)}/events?${params}`
    );
    if (data.items) events.push(...data.items);
    pageToken = data.nextPageToken;
    if (data.nextSyncToken) nextSyncToken = data.nextSyncToken;
  } while (pageToken);

  return { events, nextSyncToken };
}

export type GoogleEventBody = Partial<Pick<GoogleEvent, 'summary' | 'description' | 'location' | 'start' | 'end'>> & {
  extendedProperties?: { private?: Record<string, string> };
};

export function insertEvent(token: string, calendarId: string, body: GoogleEventBody): Promise<GoogleEvent> {
  return call(token, `/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** Patches with If-Match, so an edit made in Google since our last sync is never clobbered (412). */
export function patchEvent(
  token: string,
  calendarId: string,
  eventId: string,
  body: GoogleEventBody,
  etag?: string | null
): Promise<GoogleEvent> {
  return call(token, `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: etag ? { 'If-Match': etag } : {},
  });
}

export async function deleteEvent(token: string, calendarId: string, eventId: string, etag?: string | null) {
  try {
    await call(token, `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
      method: 'DELETE',
      headers: etag ? { 'If-Match': etag } : {},
    });
  } catch (err) {
    // Already gone in Google: nothing left to do.
    if (err instanceof GoogleError && err.status === 410) return;
    throw err;
  }
}

// ===== Mapping between Google events and our rows =====

const GOOGLE_COLOR_MAP: Record<string, string> = {
  '1': '#AC725E', '2': '#D06B64', '3': '#F83A22', '4': '#FA573C', '5': '#FF7537', '6': '#FFAD46',
  '7': '#42D692', '8': '#16A765', '9': '#7BD148', '10': '#B3DC6C', '11': '#FBE983',
};

/** Deterministic row id for an event first seen through sync. Ids are global, so include the user. */
export const googleRowId = (userId: string, googleEventId: string) => `gcal_${userId}_${googleEventId}`;

/** The Google-owned columns of an event row. Meep-only columns (status, category, task_id, bot_id) are left alone. */
export function googleEventToRow(
  userId: string,
  calendarId: string,
  calendarColor: string,
  ge: GoogleEvent,
  tz: string
) {
  const allDay = Boolean(ge.start.date && !ge.start.dateTime);
  // All-day events are dates in Google; we store them as local midnight to one
  // millisecond before the (exclusive) end date's midnight, like the app did.
  const start = allDay ? zonedToUtc(ge.start.date!, tz) : new Date(ge.start.dateTime!);
  const end = allDay ? new Date(zonedToUtc(ge.end.date!, tz).getTime() - 1) : new Date(ge.end.dateTime!);

  return {
    user_id: userId,
    title: ge.summary ?? '(No title)',
    description: ge.description ?? null,
    start_time: start.toISOString(),
    end_time: end.toISOString(),
    all_day: allDay,
    color: (ge.colorId && GOOGLE_COLOR_MAP[ge.colorId]) || calendarColor,
    location: ge.location ?? null,
    source: 'google',
    google_event_id: ge.id,
    google_calendar_id: calendarId,
    google_etag: ge.etag ?? null,
    has_guests: (ge.attendees ?? []).some((a) => !a.self),
  };
}

/** Google start/end for a row's times, honouring all-day dates in the user's timezone. */
export function rowTimesToGoogle(
  row: { start_time: string; end_time: string; all_day: boolean },
  tz: string
): Pick<GoogleEvent, 'start' | 'end'> {
  if (row.all_day) {
    const endExclusive = new Date(new Date(row.end_time).getTime() + 1);
    return { start: { date: zonedYmd(new Date(row.start_time), tz) }, end: { date: zonedYmd(endExclusive, tz) } };
  }
  return { start: { dateTime: row.start_time }, end: { dateTime: row.end_time } };
}
