// ===== Calendar Events =====
export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  allDay: boolean;
  color: string;
  location?: string;
  source: 'local' | 'google' | 'outlook';
  calendarId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ===== Tasks =====
export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'deferred';
export type TaskPriority = 1 | 2 | 3 | 4; // 1 = highest

export interface Task {
  id: string;
  title: string;
  description?: string;
  dueDate?: Date;
  scheduledStart?: Date;
  scheduledEnd?: Date;
  priority: TaskPriority;
  category?: string;
  color?: string;
  status: TaskStatus;
  parentTaskId?: string; // for sub-tasks
  subtasks?: Task[];
  estimatedMinutes?: number;
  carryOverFrom?: string; // id of original task if carried over
  createdAt: Date;
  updatedAt: Date;
}

// ===== Goals =====
export interface Goal {
  id: string;
  title: string;
  description?: string;
  targetDate?: Date;
  category?: string;
  status: 'active' | 'completed' | 'paused';
  createdAt: Date;
}

// ===== Calendar Views =====
export type CalendarView = 'day' | 'week' | 'month';

// ===== Utility =====
export interface TimeSlot {
  hour: number;
  minute: number;
  label: string;
}

export const HOURS = Array.from({ length: 24 }, (_, i) => ({
  hour: i,
  minute: 0,
  label: i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`,
}));

// Color palette for events/tasks
export const EVENT_COLORS = [
  '#6C5CE7', // purple
  '#FF6B6B', // coral
  '#4ECDC4', // teal
  '#FFD93D', // yellow
  '#2563EB', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // violet
  '#EC4899', // pink
];
