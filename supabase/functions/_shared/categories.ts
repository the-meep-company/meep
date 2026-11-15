// Event categories, shared by the app (lib/categories.ts re-exports this) and
// the bots. A small fixed set so a week can be compared category by category.
// No imports: this file is bundled for both Deno and the app.

export const EVENT_CATEGORIES = ['work', 'study', 'health', 'social', 'admin', 'personal'] as const;
export type EventCategory = (typeof EVENT_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<EventCategory, string> = {
  work: 'Work',
  study: 'Study',
  health: 'Health',
  social: 'Social',
  admin: 'Admin',
  personal: 'Personal',
};

// Keyword → category, matched against the words of a title.
const KEYWORDS: Record<string, EventCategory> = {
  // Work
  work: 'work', meeting: 'work', meetings: 'work', standup: 'work', sync: 'work', call: 'work', office: 'work',
  client: 'work', project: 'work', review: 'work', interview: 'work', report: 'work', email: 'work', inbox: 'work',
  focus: 'work', deep: 'work', presentation: 'work', deck: 'work',
  // Study
  study: 'study', class: 'study', lecture: 'study', seminar: 'study', course: 'study', homework: 'study',
  essay: 'study', exam: 'study', revision: 'study', revise: 'study', thesis: 'study', paper: 'study',
  learn: 'study', learning: 'study', tutorial: 'study', reading: 'study', read: 'study', school: 'study',
  // Health
  gym: 'health', workout: 'health', run: 'health', running: 'health', yoga: 'health', swim: 'health',
  walk: 'health', doctor: 'health', dentist: 'health', therapy: 'health', physio: 'health',
  meditation: 'health', meditate: 'health', exercise: 'health', climb: 'health', climbing: 'health',
  pilates: 'health', spin: 'health', health: 'health', sleep: 'health',
  // Social
  dinner: 'social', lunch: 'social', drinks: 'social', party: 'social', friends: 'social', family: 'social',
  date: 'social', birthday: 'social', coffee: 'social', brunch: 'social', wedding: 'social', social: 'social',
  // Admin
  admin: 'admin', bills: 'admin', taxes: 'admin', tax: 'admin', bank: 'admin', errands: 'admin',
  groceries: 'admin', shopping: 'admin', laundry: 'admin', cleaning: 'admin', chores: 'admin', budget: 'admin',
  // Personal
  journal: 'personal', hobby: 'personal', guitar: 'personal', piano: 'personal', painting: 'personal',
  personal: 'personal', me: 'personal', rest: 'personal', break: 'personal',
};

export const isEventCategory = (value: unknown): value is EventCategory =>
  typeof value === 'string' && (EVENT_CATEGORIES as readonly string[]).includes(value);

/**
 * Best guess at an event's category, or null when there's nothing to go on.
 * Priority: the linked task's category → the first keyword in the title →
 * work, for anything with guests.
 */
export function suggestCategory(
  title: string,
  opts: { hasGuests?: boolean; taskCategory?: string | null } = {}
): EventCategory | null {
  const fromTask = opts.taskCategory?.toLowerCase().trim();
  if (isEventCategory(fromTask)) return fromTask;
  if (fromTask && KEYWORDS[fromTask]) return KEYWORDS[fromTask];

  const words = title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/);
  for (const word of words) {
    if (Object.hasOwn(KEYWORDS, word)) return KEYWORDS[word];
  }
  return opts.hasGuests ? 'work' : null;
}
