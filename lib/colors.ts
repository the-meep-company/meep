import { EVENT_COLORS } from '@/types';

// Keyword → color mappings for category-based suggestions
const CATEGORY_COLOR_MAP: Record<string, string> = {
  // Work / productivity
  work: '#2563EB',
  meeting: '#2563EB',
  meetings: '#2563EB',
  office: '#2563EB',
  job: '#2563EB',
  career: '#2563EB',
  project: '#6C5CE7',
  projects: '#6C5CE7',
  // Health / fitness
  health: '#10B981',
  gym: '#10B981',
  workout: '#10B981',
  fitness: '#10B981',
  exercise: '#10B981',
  run: '#10B981',
  yoga: '#10B981',
  // Social / personal
  social: '#EC4899',
  friends: '#EC4899',
  family: '#EC4899',
  party: '#EC4899',
  date: '#EC4899',
  // Learning / goals
  study: '#8B5CF6',
  learn: '#8B5CF6',
  course: '#8B5CF6',
  school: '#8B5CF6',
  reading: '#8B5CF6',
  book: '#8B5CF6',
  // Finance / admin
  finance: '#F59E0B',
  budget: '#F59E0B',
  bills: '#F59E0B',
  admin: '#F59E0B',
  // Travel
  travel: '#4ECDC4',
  trip: '#4ECDC4',
  flight: '#4ECDC4',
  vacation: '#4ECDC4',
  // Food
  lunch: '#FFD93D',
  dinner: '#FFD93D',
  breakfast: '#FFD93D',
  food: '#FFD93D',
  // Urgent
  urgent: '#EF4444',
  deadline: '#EF4444',
};

function normaliseCategory(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
}

function matchCategoryKeyword(text: string): string | null {
  const normalised = normaliseCategory(text);
  const words = normalised.split(/\s+/);
  for (const word of words) {
    if (CATEGORY_COLOR_MAP[word]) return CATEGORY_COLOR_MAP[word];
  }
  // Substring match as fallback
  for (const [keyword, color] of Object.entries(CATEGORY_COLOR_MAP)) {
    if (normalised.includes(keyword)) return color;
  }
  return null;
}

function getNextUnusedColor(usedColors: string[]): string {
  const usedSet = new Set(usedColors);
  for (const color of EVENT_COLORS) {
    if (!usedSet.has(color)) return color;
  }
  return EVENT_COLORS[0];
}

/**
 * Suggest a color for a new event/task.
 * Priority: learned preference → category keyword match → least-used palette color.
 */
export function suggestColor(
  title: string,
  category?: string | null,
  learnedPreferences: Record<string, string> = {},
  usedColors: string[] = []
): string {
  const searchText = [title, category].filter(Boolean).join(' ');
  const normalised = normaliseCategory(searchText);

  // 1. Check learned preferences (exact category match first)
  if (category) {
    const catKey = normaliseCategory(category);
    if (learnedPreferences[catKey]) return learnedPreferences[catKey];
  }
  // 2. Check if any learned preference key appears in the title/category text
  for (const [key, color] of Object.entries(learnedPreferences)) {
    if (normalised.includes(key)) return color;
  }

  // 3. Keyword match
  const keywordColor = matchCategoryKeyword(searchText);
  if (keywordColor) return keywordColor;

  // 4. Fall back to least-used color in the palette
  return getNextUnusedColor(usedColors);
}

/**
 * Normalise a category string to a stable key for storage.
 */
export function normaliseCategoryKey(category: string): string {
  return normaliseCategory(category);
}
