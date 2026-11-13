import { zonedParts } from './time.ts';

// Standard 5-field cron (minute hour day-of-month month day-of-week), evaluated
// on the user's wall clock. Supports *, lists, ranges and steps; day-of-week 7
// is also Sunday. When both day fields are restricted, either may match (as in
// classic cron).

interface Field {
  values: Set<number>;
  any: boolean;
}

const RANGES: [number, number][] = [[0, 59], [0, 23], [1, 31], [1, 12], [0, 7]];

function parseField(src: string, [min, max]: [number, number]): Field {
  const values = new Set<number>();
  for (const part of src.split(',')) {
    const [range, stepSrc] = part.split('/');
    const step = stepSrc ? Number(stepSrc) : 1;
    let lo: number;
    let hi: number;
    if (range === '*') {
      lo = min;
      hi = max;
    } else if (range.includes('-')) {
      [lo, hi] = range.split('-').map(Number);
    } else {
      lo = Number(range);
      hi = stepSrc ? max : lo;
    }
    if (![lo, hi, step].every(Number.isInteger) || lo < min || hi > max || lo > hi || step < 1) {
      throw new Error(`Bad cron field "${src}"`);
    }
    for (let v = lo; v <= hi; v += step) values.add(v);
  }
  return { values, any: src === '*' };
}

export function parseCron(expr: string) {
  const fields = expr.trim().split(/\s+/);
  if (fields.length !== 5) throw new Error(`Cron needs 5 fields: "${expr}"`);
  const [minute, hour, dom, month, dow] = fields.map((f, i) => parseField(f, RANGES[i]));
  if (dow.values.has(7)) dow.values.add(0);
  return { minute, hour, dom, month, dow };
}

type Cron = ReturnType<typeof parseCron>;

function dayMatches(c: Cron, day: number, weekday: number): boolean {
  if (c.dom.any && c.dow.any) return true;
  if (c.dom.any) return c.dow.values.has(weekday);
  if (c.dow.any) return c.dom.values.has(day);
  return c.dom.values.has(day) || c.dow.values.has(weekday);
}

/** The first matching minute strictly after `after`, within 366 days, or null. */
export function nextCronTime(expr: string, after: Date, tz: string): Date | null {
  const c = parseCron(expr);
  // Walk forward a minute at a time, but skip whole hours that can't match.
  let t = Math.floor(after.getTime() / 60000) * 60000 + 60000;
  const limit = t + 366 * 86400000;
  while (t < limit) {
    const p = zonedParts(new Date(t), tz);
    if (!c.month.values.has(p.month) || !dayMatches(c, p.day, p.weekday) || !c.hour.values.has(p.hour)) {
      t += (60 - p.minute) * 60000;
      continue;
    }
    if (c.minute.values.has(p.minute)) return new Date(t);
    t += 60000;
  }
  return null;
}

/** "07:30 on weekdays" style presets the app offers, as cron. */
export function isValidCron(expr: string): boolean {
  try {
    parseCron(expr);
    return true;
  } catch {
    return false;
  }
}
