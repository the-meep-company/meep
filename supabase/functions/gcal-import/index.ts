import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
};

// ---- Google API types ----

interface GoogleEventDateTime {
  dateTime?: string; // ISO 8601, present for timed events
  date?: string;     // YYYY-MM-DD, present for all-day events
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
  recurringEventId?: string;
  colorId?: string;
}

interface GoogleEventsListResponse {
  items?: GoogleEvent[];
  nextPageToken?: string;
  nextSyncToken?: string;
}

// ---- Fetch all pages for a single calendar ----

async function fetchCalendarEvents(
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
      // Incremental sync: syncToken replaces timeMin/timeMax
      params.set('syncToken', syncToken);
    } else {
      params.set('timeMin', timeMin);
      params.set('timeMax', timeMax);
    }

    if (pageToken) {
      params.set('pageToken', pageToken);
    }

    const encodedId = encodeURIComponent(calendarId);
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodedId}/events?${params}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const body = await res.text();
      // 410 Gone means the syncToken is expired — caller should do a full sync
      if (res.status === 410) {
        throw new Error(`SYNC_TOKEN_EXPIRED:${calendarId}`);
      }
      throw new Error(`Google API ${res.status} for calendar ${calendarId}: ${body}`);
    }

    const data: GoogleEventsListResponse = await res.json();

    if (data.items) {
      allEvents.push(...data.items);
    }

    pageToken = data.nextPageToken;
    if (data.nextSyncToken) {
      nextSyncToken = data.nextSyncToken;
    }
  } while (pageToken);

  return { events: allEvents, nextSyncToken };
}

// ---- Main handler ----

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const {
      accessToken,
      calendarIds,
      timeMin,
      timeMax,
      syncTokens, // Record<calendarId, syncToken> — optional, for incremental sync
    }: {
      accessToken: string;
      calendarIds: string[];
      timeMin: string;
      timeMax: string;
      syncTokens?: Record<string, string>;
    } = await req.json();

    if (!accessToken) {
      return new Response(JSON.stringify({ error: 'accessToken is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }

    if (!calendarIds?.length) {
      return new Response(JSON.stringify({ error: 'calendarIds must be a non-empty array' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }

    // Fetch all calendars in parallel
    const results = await Promise.allSettled(
      calendarIds.map((id) =>
        fetchCalendarEvents(
          accessToken,
          id,
          timeMin,
          timeMax,
          syncTokens?.[id]
        ).then((r) => ({ calendarId: id, ...r }))
      )
    );

    const allEvents: (GoogleEvent & { _calendarId: string })[] = [];
    const nextSyncTokens: Record<string, string> = {};
    const errors: { calendarId: string; error: string }[] = [];

    for (const result of results) {
      if (result.status === 'fulfilled') {
        const { calendarId, events, nextSyncToken } = result.value;
        allEvents.push(...events.map((e) => ({ ...e, _calendarId: calendarId })));
        if (nextSyncToken) nextSyncTokens[calendarId] = nextSyncToken;
      } else {
        // Extract calendarId from the error message if sync token expired
        const msg: string = result.reason?.message ?? 'Unknown error';
        const expiredMatch = msg.match(/^SYNC_TOKEN_EXPIRED:(.+)$/);
        const calendarId = expiredMatch ? expiredMatch[1] : 'unknown';
        errors.push({ calendarId, error: msg });
      }
    }

    return new Response(
      JSON.stringify({ events: allEvents, nextSyncTokens, errors }),
      {
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }
});
