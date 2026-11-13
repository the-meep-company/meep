import { admin } from './admin.ts';
import { userTimezone } from './gcalSync.ts';
import {
  accessTokenFor,
  deleteEvent,
  GoogleError,
  type GoogleEventBody,
  insertEvent,
  patchEvent,
  rowTimesToGoogle,
} from './google.ts';

// The one path for changing an event. It updates the events row and, when the
// event lives in Google, writes the change to Google first so the two never drift.
// Bots may only touch calendars the user marked "Bots can edit"; the user may
// touch any calendar they sync (Google itself refuses read-only ones).

export interface EventRow {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  all_day: boolean;
  color: string;
  location: string | null;
  source: string;
  calendar_id: string | null;
  schedule_source: string | null;
  is_habit: boolean;
  google_event_id: string | null;
  google_calendar_id: string | null;
  google_etag: string | null;
  has_guests: boolean;
  status: 'planned' | 'done' | 'skipped';
  category: string | null;
  task_id: string | null;
  bot_id: string | null;
  created_at: string;
  updated_at: string;
}

export type Actor = 'user' | 'bot';

export type EventChange =
  | { op: 'upsert'; row: Partial<EventRow> & { id: string }; extendedProperties?: Record<string, string> }
  | { op: 'delete'; id: string };

export class WriteError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// Columns Google owns; changing any of them on a Google event means a Google write.
const GOOGLE_FIELDS = ['title', 'description', 'location', 'start_time', 'end_time', 'all_day'] as const;

async function assertWritable(userId: string, calendarId: string, actor: Actor) {
  const { data } = await admin
    .from('google_calendars')
    .select('selected, bots_can_write')
    .eq('user_id', userId)
    .eq('calendar_id', calendarId)
    .maybeSingle();
  if (!data?.selected) throw new WriteError(403, 'That Google calendar is not synced to Meep.');
  if (actor === 'bot' && !data.bots_can_write) {
    throw new WriteError(403, 'Bots are not allowed to edit that Google calendar.');
  }
}

function googleBody(row: EventRow, tz: string, extendedProperties?: Record<string, string>): GoogleEventBody {
  return {
    summary: row.title,
    description: row.description ?? undefined,
    location: row.location ?? undefined,
    ...rowTimesToGoogle(row, tz),
    ...(extendedProperties ? { extendedProperties: { private: extendedProperties } } : {}),
  };
}

async function googleToken(userId: string): Promise<string> {
  const token = await accessTokenFor(userId);
  if (!token) throw new WriteError(409, 'Google Calendar is not connected.');
  return token;
}

function mapGoogleError(err: unknown): never {
  if (err instanceof GoogleError) {
    if (err.status === 412) throw new WriteError(409, 'This event changed in Google since Meep last synced. Sync and try again.');
    if (err.status === 403) throw new WriteError(403, "Google won't let Meep edit this event.");
    throw new WriteError(502, err.message);
  }
  throw err;
}

/** Applies one change for `userId` and returns the row as it now stands (null after a delete). */
export async function writeEvent(userId: string, change: EventChange, actor: Actor): Promise<EventRow | null> {
  const id = change.op === 'delete' ? change.id : change.row.id;
  const { data: existing, error } = await admin
    .from('events')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle<EventRow>();
  if (error) throw error;

  if (change.op === 'delete') {
    if (!existing) return null;
    if (existing.google_event_id && existing.google_calendar_id) {
      await assertWritable(userId, existing.google_calendar_id, actor);
      await deleteEvent(
        await googleToken(userId),
        existing.google_calendar_id,
        existing.google_event_id,
        existing.google_etag
      ).catch(mapGoogleError);
    }
    const { error: e } = await admin.from('events').delete().eq('id', id).eq('user_id', userId);
    if (e) throw e;
    return null;
  }

  if (existing && change.row.user_id && change.row.user_id !== userId) {
    throw new WriteError(403, 'Not your event.');
  }

  // Google identity can't be changed by a write; it only comes from sync or insert.
  const { google_event_id: _g, google_etag: _e, ...incoming } = change.row;
  const next = { ...(existing ?? {}), ...incoming, user_id: userId } as EventRow;
  if (existing?.google_calendar_id) next.google_calendar_id = existing.google_calendar_id;

  const googleChanged = !existing || GOOGLE_FIELDS.some((f) => incoming[f] !== undefined && incoming[f] !== existing[f]);

  if (existing?.google_event_id && existing.google_calendar_id && googleChanged) {
    await assertWritable(userId, existing.google_calendar_id, actor);
    const tz = await userTimezone(userId);
    const ge = await patchEvent(
      await googleToken(userId),
      existing.google_calendar_id,
      existing.google_event_id,
      googleBody(next, tz, change.extendedProperties),
      existing.google_etag
    ).catch(mapGoogleError);
    next.google_etag = ge.etag ?? null;
  } else if (!existing && next.google_calendar_id) {
    // A new event placed straight into a Google calendar.
    await assertWritable(userId, next.google_calendar_id, actor);
    const tz = await userTimezone(userId);
    const ge = await insertEvent(
      await googleToken(userId),
      next.google_calendar_id,
      googleBody(next, tz, change.extendedProperties)
    ).catch(mapGoogleError);
    next.google_event_id = ge.id;
    next.google_etag = ge.etag ?? null;
    next.source = 'google';
  }

  // updated_at is set by the trigger; created_at keeps its default on insert.
  const { updated_at: _u, ...row } = next;
  const { data, error: e } = await admin.from('events').upsert(row).select('*').single<EventRow>();
  if (e) throw e;
  return data;
}
