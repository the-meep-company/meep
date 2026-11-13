import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { fromDbEvent, fromDbMeeple, fromDbMeepleMessage, fromDbTask } from './sync';
import { loadGoogleCalendars } from './googleCalendar';
import { useCalendarStore } from '@/stores/calendarStore';
import { useTaskStore } from '@/stores/taskStore';
import { useMeepleStore } from '@/stores/meepleStore';

// Keeps the local stores in step with Supabase while the app is open, so changes
// made by the server (Google sync, bots) or another device show up live. Our own
// writes echo back too; applying them again is harmless.
//
// Deletes carry only the primary key under RLS and can't be filtered by user,
// so they're applied by id (ids are unique across users).

let channel: RealtimeChannel | null = null;

type Change = { eventType: 'INSERT' | 'UPDATE' | 'DELETE'; new: any; old: any };

export function subscribeToChanges(userId: string) {
  unsubscribeFromChanges();
  const own = `user_id=eq.${userId}`;
  const upserts = (table: string, handler: (row: any) => void) => (ch: RealtimeChannel) =>
    ch
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table, filter: own }, (p: Change) => handler(p.new))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table, filter: own }, (p: Change) => handler(p.new));
  const deletes = (table: string, handler: (id: string) => void) => (ch: RealtimeChannel) =>
    ch.on('postgres_changes', { event: 'DELETE', schema: 'public', table }, (p: Change) => {
      if (p.old?.id) handler(p.old.id);
    });

  let ch = supabase.channel(`user-${userId}`);
  for (const attach of [
    upserts('events', (row) => useCalendarStore.getState().batchUpsertEvents([fromDbEvent(row)])),
    deletes('events', (id) => useCalendarStore.getState().batchUpsertEvents([], [id])),
    upserts('tasks', (row) => useTaskStore.getState().applyRemote([fromDbTask(row)])),
    deletes('tasks', (id) => useTaskStore.getState().applyRemote([], [id])),
    upserts('meeples', (row) => useMeepleStore.getState().applyRemoteMeeple(fromDbMeeple(row))),
    deletes('meeples', (id) => useMeepleStore.getState().removeRemoteMeeple(id)),
    upserts('meeple_messages', (row) => {
      const { meepleId, ...msg } = fromDbMeepleMessage(row);
      useMeepleStore.getState().applyRemoteMessage(meepleId, msg);
    }),
    deletes('meeple_messages', (id) => useMeepleStore.getState().removeRemoteMessage(id)),
    upserts('google_calendars', () => loadGoogleCalendars().catch(() => {})),
  ]) {
    ch = attach(ch);
  }
  channel = ch.subscribe();
}

export function unsubscribeFromChanges() {
  if (channel) {
    supabase.removeChannel(channel);
    channel = null;
  }
}
