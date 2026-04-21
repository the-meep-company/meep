/**
 * lib/googleCalendar.ts
 *
 * Client-side Google Calendar sync logic.
 *
 * All functions that need an accessToken are ready to wire up once
 * Person A's auth branch (stores/authStore.ts) lands and provides the
 * real OAuth token. Until then, pass the mock token from your test harness.
 */

import { addMonths, subMonths } from 'date-fns';
import type { CalendarEvent, GoogleCalendarInfo } from '@/types';

// ---- Google API response shapes (mirrored from Edge Function) ----

interface GoogleEventDateTime {
  dateTime?: string;
  date?: string;
  timeZone?: string;
}

interface GoogleEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start: GoogleEventDateTime;
  end: GoogleEventDateTime;
  status?: 'confirmed' | 'tentative' | 'cancelled';
  colorId?: string;
  _calendarId: string; // injected by our Edge Function
}

interface GoogleCalendarListEntry {
  id: string;
  summary: string;
  backgroundColor: string;
  foregroundColor: string;
  primary?: boolean;
  selected?: boolean;
}

// ---- colorId → hex (Google's 11 event colour IDs) ----

const GOOGLE_COLOR_MAP: Record<string, string> = {
  '1': '#AC725E',
  '2': '#D06B64',
  '3': '#F83A22',
  '4': '#FA573C',
  '5': '#FF7537',
  '6': '#FFAD46',
  '7': '#42D692',
  '8': '#16A765',
  '9': '#7BD148',
  '10': '#B3DC6C',
  '11': '#FBE983',
};

// ---- Transform a single Google event into our CalendarEvent shape ----

export function transformGoogleEvent(
  googleEvent: GoogleEvent,
  calendarBackgroundColor: string
): CalendarEvent {
  const allDay = Boolean(googleEvent.start.date && !googleEvent.start.dateTime);

  let startTime: Date;
  let endTime: Date;

  if (allDay) {
    // All-day events use YYYY-MM-DD; interpret at midnight local time
    startTime = new Date(`${googleEvent.start.date}T00:00:00`);
    // Google's end date for all-day is exclusive (next day), so subtract 1ms
    const rawEnd = new Date(`${googleEvent.end.date}T00:00:00`);
    endTime = new Date(rawEnd.getTime() - 1);
  } else {
    startTime = new Date(googleEvent.start.dateTime!);
    endTime = new Date(googleEvent.end.dateTime!);
  }

  const color = googleEvent.colorId
    ? (GOOGLE_COLOR_MAP[googleEvent.colorId] ?? calendarBackgroundColor)
    : calendarBackgroundColor;

  return {
    id: `gcal_${googleEvent.id}`,
    googleEventId: googleEvent.id,
    googleCalendarId: googleEvent._calendarId,
    title: googleEvent.summary ?? '(No title)',
    description: googleEvent.description,
    startTime,
    endTime,
    allDay,
    color,
    location: googleEvent.location,
    source: 'google',
    syncStatus: googleEvent.status === 'cancelled' ? 'pending_delete' : 'synced',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// ---- Merge imported Google events into the existing local event array ----
//
// Rules:
//   - Match on googleEventId
//   - If status === 'cancelled' → mark for deletion (caller removes them)
//   - If matched → update the existing entry (preserving local id)
//   - If new → add to array
//   - Local-only events (source !== 'google') are left untouched

export function mergeGoogleEvents(
  imported: CalendarEvent[],
  existing: CalendarEvent[]
): { merged: CalendarEvent[]; deletedIds: string[] } {
  const localOnly = existing.filter((e) => e.source !== 'google');
  const existingGoogleById = new Map(
    existing
      .filter((e) => e.source === 'google' && e.googleEventId)
      .map((e) => [e.googleEventId!, e])
  );

  const deletedIds: string[] = [];
  const updatedGoogle: CalendarEvent[] = [];

  for (const incoming of imported) {
    if (!incoming.googleEventId) continue;

    if (incoming.syncStatus === 'pending_delete') {
      // Event was cancelled in Google — remove from local store
      const existing = existingGoogleById.get(incoming.googleEventId);
      if (existing) deletedIds.push(existing.id);
      continue;
    }

    const match = existingGoogleById.get(incoming.googleEventId);
    if (match) {
      // Update existing, preserve local id
      updatedGoogle.push({ ...incoming, id: match.id, updatedAt: new Date() });
      existingGoogleById.delete(incoming.googleEventId); // mark as processed
    } else {
      // Brand new event
      updatedGoogle.push(incoming);
    }
  }

  // Any Google events still in the map were NOT returned by the incremental
  // sync — that means they weren't changed, so keep them as-is
  const unchanged = [...existingGoogleById.values()];

  return {
    merged: [...localOnly, ...updatedGoogle, ...unchanged],
    deletedIds,
  };
}

// ---- Fetch user's Google calendar list (calls Google API directly) ----
//
// NOTE: This hits Google's API from the client. Once Person A's auth is
// wired, pass the real accessToken from authStore.
//
// For testing without a real token, call with accessToken = 'mock' and
// the function returns MOCK_CALENDARS below.

const MOCK_CALENDARS: GoogleCalendarInfo[] = [
  {
    id: 'primary@example.com',
    summary: 'My Calendar',
    backgroundColor: '#4285F4',
    foregroundColor: '#ffffff',
    primary: true,
    selected: true,
  },
  {
    id: 'work@example.com',
    summary: 'Work',
    backgroundColor: '#0F9D58',
    foregroundColor: '#ffffff',
    primary: false,
    selected: false,
  },
];

export async function fetchGoogleCalendars(
  accessToken: string
): Promise<GoogleCalendarInfo[]> {
  if (accessToken === 'mock') return MOCK_CALENDARS;

  const res = await fetch(
    'https://www.googleapis.com/calendar/v3/users/me/calendarList',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch calendar list: ${res.status}`);
  }

  const data: { items?: GoogleCalendarListEntry[] } = await res.json();
  return (data.items ?? []).map((c) => ({
    id: c.id,
    summary: c.summary,
    backgroundColor: c.backgroundColor ?? '#4285F4',
    foregroundColor: c.foregroundColor ?? '#ffffff',
    primary: c.primary ?? false,
    selected: c.selected ?? false,
  }));
}

// ---- Fetch all pages for a single calendar directly from Google API ----

async function fetchCalendarEventsFromGoogle(
  accessToken: string,
  calendarId: string,
  timeMin: string,
  timeMax: string,
  syncToken?: string
): Promise<{ events: GoogleEvent[]; nextSyncToken: string | null }> {
  const allEvents: GoogleEvent[] = [];
  let pageToken: string | undefined;
  let nextSyncToken: string | null = null;

  do {
    const params = new URLSearchParams({
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '250',
    });

    if (syncToken) {
      params.set('syncToken', syncToken);
    } else {
      params.set('timeMin', timeMin);
      params.set('timeMax', timeMax);
    }

    if (pageToken) params.set('pageToken', pageToken);

    const encodedId = encodeURIComponent(calendarId);
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodedId}/events?${params}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      if (res.status === 401) {
        throw new Error('Google session expired. Please disconnect and reconnect to refresh your token.');
      }
      const body = await res.text();
      throw new Error(`Google Calendar API error ${res.status} for ${calendarId}: ${body}`);
    }

    const data: { items?: GoogleEvent[]; nextPageToken?: string; nextSyncToken?: string } =
      await res.json();

    if (data.items) allEvents.push(...data.items);
    pageToken = data.nextPageToken;
    if (data.nextSyncToken) nextSyncToken = data.nextSyncToken;
  } while (pageToken);

  return { events: allEvents, nextSyncToken };
}

// ---- Import events from Google Calendar API directly ----

export async function importGoogleEvents(
  accessToken: string,
  calendarIds: string[],
  calendarColorMap: Record<string, string>, // calendarId → backgroundColor
  syncTokens?: Record<string, string>
): Promise<{ events: CalendarEvent[]; nextSyncTokens: Record<string, string> }> {
  if (accessToken === 'mock') {
    return {
      events: generateMockGoogleEvents(calendarColorMap),
      nextSyncTokens: {},
    };
  }

  const now = new Date();
  const timeMin = subMonths(now, 1).toISOString();
  const timeMax = addMonths(now, 3).toISOString();

  const results = await Promise.allSettled(
    calendarIds.map((id) =>
      fetchCalendarEventsFromGoogle(accessToken, id, timeMin, timeMax, syncTokens?.[id]).then(
        (r) => ({ calendarId: id, ...r })
      )
    )
  );

  const allEvents: CalendarEvent[] = [];
  const nextSyncTokens: Record<string, string> = {};

  for (const result of results) {
    if (result.status === 'fulfilled') {
      const { calendarId, events, nextSyncToken } = result.value;
      const color = calendarColorMap[calendarId] ?? '#4285F4';
      for (const e of events) {
        allEvents.push(transformGoogleEvent({ ...e, _calendarId: calendarId }, color));
      }
      if (nextSyncToken) nextSyncTokens[calendarId] = nextSyncToken;
    } else {
      // Re-throw the first individual-calendar error so the UI sees it
      throw result.reason;
    }
  }

  return { events: allEvents, nextSyncTokens };
}

// ---- High-level sync orchestration ----
//
// Import at the call-site to avoid circular deps with stores:
//   import { performSync } from '@/lib/googleCalendar';
//
// Pass store actions as arguments so this lib stays store-agnostic.

export async function performSync({
  accessToken,
  googleCalendars,
  selectedCalendarIds,
  syncTokens,
  existingEvents,
  onSyncStart,
  onSyncSuccess,
  onSyncError,
  batchUpsertEvents,
  setLastSync,
}: {
  accessToken: string;
  googleCalendars: GoogleCalendarInfo[];
  selectedCalendarIds: string[];
  syncTokens?: Record<string, string>;
  existingEvents: CalendarEvent[];
  onSyncStart: () => void;
  onSyncSuccess: (nextSyncTokens: Record<string, string>) => void;
  onSyncError: (err: string) => void;
  batchUpsertEvents: (events: CalendarEvent[], deletedIds: string[]) => void;
  setLastSync: (date: Date) => void;
}): Promise<void> {
  onSyncStart();

  try {
    const calendarColorMap = Object.fromEntries(
      googleCalendars
        .filter((c) => selectedCalendarIds.includes(c.id))
        .map((c) => [c.id, c.backgroundColor])
    );

    const { events: imported, nextSyncTokens } = await importGoogleEvents(
      accessToken,
      selectedCalendarIds,
      calendarColorMap,
      syncTokens
    );

    const { merged, deletedIds } = mergeGoogleEvents(imported, existingEvents);
    batchUpsertEvents(merged, deletedIds);
    setLastSync(new Date());
    onSyncSuccess(nextSyncTokens);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Sync failed';
    onSyncError(msg);
  }
}

// ---- Mock events for UI testing ----

function generateMockGoogleEvents(
  calendarColorMap: Record<string, string>
): CalendarEvent[] {
  const now = new Date();
  const color = Object.values(calendarColorMap)[0] ?? '#4285F4';
  const calendarId = Object.keys(calendarColorMap)[0] ?? 'mock@example.com';

  const start1 = new Date(now);
  start1.setHours(10, 0, 0, 0);
  const end1 = new Date(start1);
  end1.setHours(11, 0, 0, 0);

  const start2 = new Date(now);
  start2.setDate(start2.getDate() + 1);
  start2.setHours(14, 0, 0, 0);
  const end2 = new Date(start2);
  end2.setHours(15, 30, 0, 0);

  return [
    {
      id: 'gcal_mock_001',
      googleEventId: 'mock_001',
      googleCalendarId: calendarId,
      title: 'Team Standup (Google)',
      description: 'Daily team sync',
      startTime: start1,
      endTime: end1,
      allDay: false,
      color,
      source: 'google',
      syncStatus: 'synced',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'gcal_mock_002',
      googleEventId: 'mock_002',
      googleCalendarId: calendarId,
      title: 'Product Review (Google)',
      startTime: start2,
      endTime: end2,
      allDay: false,
      color,
      source: 'google',
      syncStatus: 'synced',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];
}
