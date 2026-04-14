// ===== Schedule Source =====
export type ScheduleSource = 'manual' | 'ai';

// ===== Google Calendar Sync =====
export interface GoogleCalendarInfo {
  id: string;           // Google calendar ID (usually an email)
  summary: string;      // Display name
  backgroundColor: string;
  foregroundColor: string;
  primary: boolean;
  selected: boolean;    // User's choice to sync this calendar
}

export interface SyncState {
  lastSyncAt: Date | null;
  isSyncing: boolean;
  syncError: string | null;
}

export type SyncStatus = 'synced' | 'pending_push' | 'pending_delete' | 'conflict';

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
  scheduleSource?: ScheduleSource;
  isHabit?: boolean;
  // Google Calendar sync fields
  googleEventId?: string;       // Google's event ID, used to match on re-import
  googleCalendarId?: string;    // Which Google calendar it came from
  syncStatus?: SyncStatus;
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
  scheduleSource?: ScheduleSource;
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

// ===== Habits =====
export type HabitFrequency = 'daily' | 'weekdays' | 'weekends' | 'custom';

export interface Habit {
  id: string;
  title: string;
  description?: string;
  frequency: HabitFrequency;
  customDays?: number[]; // 0=Sun..6=Sat, used when frequency='custom'
  startTime: string; // "HH:mm" format, e.g. "07:00"
  durationMinutes: number;
  color: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ===== AI Types =====
export type AIPersona = 'friendly' | 'professional' | 'playful';
export type ParsedItemType = 'event' | 'task' | 'goal' | 'habit';

export interface ParsedItem {
  id: string;
  type: ParsedItemType;
  confidence: number; // 0-1
  raw: string; // original text snippet
  event?: Partial<CalendarEvent>;
  task?: Partial<Task>;
  goal?: Partial<Goal>;
  habit?: Partial<Habit>;
  status: 'pending' | 'confirmed' | 'edited' | 'deleted';
}

export interface BrainDumpResponse {
  items: ParsedItem[];
  summary: string;
  followUpQuestion?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  parsedItems?: ParsedItem[];
  actions?: ChatAction[];
  timestamp: Date;
}

// ===== Chat Actions (Phase 3B) =====
export type ChatActionType =
  | 'move_event'
  | 'delete_event'
  | 'create_event'
  | 'complete_task'
  | 'create_task';

export interface ChatAction {
  type: ChatActionType;
  params: Record<string, any>;
  label: string;
}

export interface ChatSession {
  id: string;
  startedAt: Date;
  messages: ChatMessage[];
}

// ===== Scheduling =====
export interface SchedulingPattern {
  id: string;
  category?: string;
  preferredTimeRange: { startHour: number; endHour: number };
  preferredDays: number[];
  avgDurationMinutes: number;
  sampleSize: number;
  updatedAt: Date;
}

// ===== User Settings =====
export interface UserSettings {
  aiPersona: AIPersona;
  timezone: string;
  timezoneAutoDetect: boolean;
}

// ===== Phase 2c: Auto-Scheduling =====
export interface PatternDataPoint {
  id: string;
  category?: string;
  dayOfWeek: number; // 0=Sun..6=Sat
  startHour: number; // 0-23, fractional (e.g. 14.5 = 2:30 PM)
  endHour: number;
  durationMinutes: number;
  wasAiSuggested: boolean;
  wasModified: boolean;
  recordedAt: Date;
}

export interface ScheduleRequest {
  tasks: Task[];
  existingEvents: CalendarEvent[];
  habitEvents: CalendarEvent[];
  patterns: SchedulingPattern[];
  dateRange: { start: Date; end: Date };
  workingHours: { startHour: number; endHour: number };
  timezone: string;
}

export interface SchedulePlacement {
  taskId: string;
  task: Task;
  proposedStart: Date;
  proposedEnd: Date;
  reason: string;
  confidence: number; // 0-1
}

export interface ScheduleResult {
  placements: SchedulePlacement[];
  unplaceable: { taskId: string; task: Task; reason: string }[];
}

export interface FreeSlot {
  start: Date;
  end: Date;
  durationMinutes: number;
}
