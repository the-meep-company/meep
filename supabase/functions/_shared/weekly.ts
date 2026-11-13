import { type EventCategory, isEventCategory, suggestCategory } from './categories.ts';
import { zonedParts, zonedToUtc } from './time.ts';

// A week's planned-vs-actual, by category, computed here rather than by the
// model so the numbers are always right. The Weekly bot narrates it; any bot
// that reads the calendar can ask for it (the week_summary tool).

export type WeekCategory = EventCategory | 'other';

export interface CategoryWeek {
  category: WeekCategory;
  /** Minutes on the calendar this week, in every state below. */
  planned: number;
  done: number;
  skipped: number;
  /** Started before now and never checked off. */
  unchecked: number;
  /** Still to come this week. */
  ahead: number;
}

export interface WeekSummary {
  /** Local Monday and the Monday after (YYYY-MM-DD). */
  from: string;
  to: string;
  categories: CategoryWeek[];
  total: Omit<CategoryWeek, 'category'>;
}

export interface WeekEvent {
  title: string;
  start_time: string;
  end_time: string;
  all_day: boolean;
  has_guests: boolean;
  status: 'planned' | 'done' | 'skipped';
  category: string | null;
}

const ymd = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);

/** Local Monday 00:00 to the next Monday 00:00 of the week `weeksBack` weeks before now's. */
export function weekBounds(now: Date, tz: string, weeksBack = 0): { from: string; to: string; start: Date; end: Date } {
  const p = zonedParts(now, tz);
  const sinceMonday = (p.weekday + 6) % 7;
  const from = ymd(p.year, p.month, p.day - sinceMonday - 7 * weeksBack);
  const [y, m, d] = from.split('-').map(Number);
  const to = ymd(y, m, d + 7);
  return { from, to, start: zonedToUtc(from, tz), end: zonedToUtc(to, tz) };
}

export function summarizeWeek(events: WeekEvent[], now: Date, bounds: { from: string; to: string; start: Date; end: Date }): WeekSummary {
  const blank = (): Omit<CategoryWeek, 'category'> => ({ planned: 0, done: 0, skipped: 0, unchecked: 0, ahead: 0 });
  const byCategory = new Map<WeekCategory, Omit<CategoryWeek, 'category'>>();
  const total = blank();

  for (const e of events) {
    if (e.all_day) continue;
    const s = Math.max(new Date(e.start_time).getTime(), bounds.start.getTime());
    const end = Math.min(new Date(e.end_time).getTime(), bounds.end.getTime());
    const minutes = Math.round((end - s) / 60000);
    if (minutes <= 0) continue;

    const category: WeekCategory = isEventCategory(e.category)
      ? e.category
      : suggestCategory(e.title, { hasGuests: e.has_guests }) ?? 'other';
    const state =
      e.status === 'done' ? 'done' : e.status === 'skipped' ? 'skipped' : s < now.getTime() ? 'unchecked' : 'ahead';
    const row = byCategory.get(category) ?? blank();
    row.planned += minutes;
    row[state] += minutes;
    total.planned += minutes;
    total[state] += minutes;
    byCategory.set(category, row);
  }

  const categories = [...byCategory.entries()]
    .map(([category, row]) => ({ category, ...row }))
    .sort((a, b) => b.planned - a.planned);
  return { from: bounds.from, to: bounds.to, categories, total };
}
