import type { TaskPriority } from '@/types';

// Status / category colors tuned for the dark themes. As text on a dark surface
// they clear WCAG AA (4.5:1); as button fills they take dark text (ON_TINT),
// which clears it by a wide margin. The deeper versions (#2563EB, #10B981…)
// failed both ways.

export const TINT = {
  blue: '#93C5FD',
  green: '#86EFAC',
  red: '#FCA5A5',
  amber: '#FCD34D',
  purple: '#C4B5FD',
} as const;

/** Text/icon color for anything drawn on a TINT fill. */
export const ON_TINT = '#0B0B0F';

export const PRIORITY: Record<TaskPriority, { label: string; name: string; color: string }> = {
  1: { label: 'P1', name: 'Urgent', color: '#FF8A8A' },
  2: { label: 'P2', name: 'High', color: '#FBBF24' },
  3: { label: 'P3', name: 'Medium', color: '#93C5FD' },
  4: { label: 'P4', name: 'Low', color: '#CBD5E1' },
};
