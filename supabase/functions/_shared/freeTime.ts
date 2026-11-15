import { zonedParts, zonedToUtc, zonedYmd } from './time.ts';

// Free-time math for bots, on the user's wall clock. This mirrors the app's
// lib/scheduler.ts computeFreeSlots (working hours, 15-minute buffers) but works
// in the user's timezone rather than the device's, which a server needs.

export interface Busy {
  start: Date;
  end: Date;
}

export interface Slot {
  start: Date;
  end: Date;
  minutes: number;
}

export const DEFAULT_DAY = { startHour: 8, endHour: 21 };
const BUFFER_MS = 15 * 60000;
const MIN_SLOT_MIN = 25;

/** Free slots between `from` and `to`, inside working hours on each local day. */
export function freeSlots(
  busy: Busy[],
  from: Date,
  to: Date,
  tz: string,
  hours = DEFAULT_DAY
): Slot[] {
  const sorted = busy
    .map((b) => ({ start: b.start.getTime() - BUFFER_MS, end: b.end.getTime() + BUFFER_MS }))
    .sort((a, b) => a.start - b.start);

  const slots: Slot[] = [];
  let ymd = zonedYmd(from, tz);
  for (let i = 0; i < 400; i++) {
    const dayStart = Math.max(zonedToUtc(ymd, tz, hours.startHour).getTime(), from.getTime());
    const dayEnd = Math.min(zonedToUtc(ymd, tz, hours.endHour).getTime(), to.getTime());
    if (zonedToUtc(ymd, tz, hours.startHour).getTime() >= to.getTime()) break;

    let cursor = dayStart;
    for (const b of sorted) {
      if (b.end <= cursor || b.start >= dayEnd) continue;
      if (b.start > cursor) pushSlot(slots, cursor, Math.min(b.start, dayEnd));
      cursor = Math.max(cursor, b.end);
    }
    pushSlot(slots, cursor, dayEnd);

    // Next local day (noon + 24h avoids DST edge cases).
    ymd = zonedYmd(new Date(zonedToUtc(ymd, tz, 12).getTime() + 86400000), tz);
  }
  return slots;
}

function pushSlot(slots: Slot[], start: number, end: number) {
  const minutes = Math.floor((end - start) / 60000);
  if (minutes >= MIN_SLOT_MIN) slots.push({ start: new Date(start), end: new Date(end), minutes });
}

/**
 * Focus blocks for a deadline, worked back from the due date: the latest free
 * time first (finishing two hours before it's due), in sessions of at most
 * `maxSession` minutes and at most one per day. Returns blocks in chronological
 * order; `short` is the minutes that didn't fit.
 */
export function workBackFromDeadline(
  totalMinutes: number,
  due: Date,
  busy: Busy[],
  now: Date,
  tz: string,
  { maxSession = 90, minSession = 30 }: { maxSession?: number; minSession?: number } = {}
): { blocks: Slot[]; short: number } {
  // Aim to be done a little before the deadline.
  const finishBy = new Date(Math.max(now.getTime(), due.getTime() - 2 * 3600000));
  const slots = freeSlots(busy, now, finishBy, tz).reverse();
  const usedDays = new Set<string>();
  const blocks: Slot[] = [];
  let remaining = totalMinutes;

  for (const slot of slots) {
    if (remaining <= 0) break;
    const day = zonedYmd(slot.start, tz);
    if (usedDays.has(day)) continue;
    const minutes = Math.min(maxSession, remaining, slot.minutes);
    if (minutes < Math.min(minSession, remaining)) continue;
    // Late in the slot, so earlier time stays open for the rest of the day.
    const end = slot.end;
    const start = new Date(end.getTime() - minutes * 60000);
    blocks.push({ start: snapDown(start), end: snapDown(end), minutes });
    usedDays.add(day);
    remaining -= minutes;
  }

  return { blocks: blocks.reverse(), short: Math.max(0, remaining) };
}

function snapDown(d: Date): Date {
  const step = 15 * 60000;
  return new Date(Math.floor(d.getTime() / step) * step);
}

/** "Tue 14:30" in the user's zone, for prompts and feed copy. */
export function shortLocal(d: Date, tz: string): string {
  const p = zonedParts(d, tz);
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][p.weekday];
  return `${day} ${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
}
