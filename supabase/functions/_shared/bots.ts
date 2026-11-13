import { admin } from './admin.ts';
import { type Anthropic, runToolLoop, type ToolCall } from './anthropic.ts';
import { userTimezone } from './gcalSync.ts';
import { type EventRow, writeEvent } from './eventWrite.ts';
import { freeSlots, shortLocal, workBackFromDeadline } from './freeTime.ts';
import { zonedYmd } from './time.ts';

// The bot runtime. A bot is a meeple with a kind (scheduled / triggered), a
// trust level and a scope. Its only hands are the user's calendar: it reads
// events and tasks, and submits structured block changes, which the server
// validates and then applies or queues as a proposal according to trust.

export type Trust = 'ask' | 'ask_big' | 'auto';
export type Scope = 'read_calendar' | 'read_tasks' | 'propose_blocks' | 'write_blocks';

export interface BotRow {
  id: string;
  user_id: string;
  name: string;
  role: string;
  instructions: string;
  web_search: boolean;
  kind: 'chat' | 'scheduled' | 'triggered';
  schedule: string | null;
  trigger: string | null;
  trust: Trust;
  scope: Scope[];
  enabled: boolean;
  template: string | null;
}

/** What started a run. */
export type RunTrigger =
  | { type: 'schedule' }
  | { type: 'event'; event: string; payloads: Record<string, unknown>[] }
  | { type: 'chat'; message: string }
  | { type: 'dry_run' }
  | { type: 'manual' };

/** A change as the model submits it. Times are ISO 8601. */
export type BlockChange =
  | { kind: 'create'; title: string; start: string; end: string; task_id?: string; reason: string }
  | { kind: 'move'; event_id: string; start: string; end: string; reason: string }
  | { kind: 'delete'; event_id: string; reason: string };

/** A change as stored on a feed item: enough to apply it later and to undo it. */
export interface StoredChange {
  id: string;
  kind: BlockChange['kind'];
  title: string;
  reason: string;
  /** The event changed, or created once applied. */
  event_id?: string;
  task_id?: string;
  /** Google calendar a new block goes into (null: Meep only). */
  google_calendar_id?: string | null;
  before?: { start: string; end: string } | null;
  after?: { start: string; end: string } | null;
  applied?: boolean;
  /** Full row before the change, for undo. */
  before_row?: EventRow | null;
  /** updated_at right after applying; undo is refused once it moves. */
  applied_updated_at?: string | null;
  error?: string;
}

export interface FeedPayload {
  summary: string;
  changes: StoredChange[];
  /** Local day the changes are about, for the mini day view. */
  day?: string;
}

// Models: planning-heavy bots get the deep model, frequent ones the fast one.
const DEEP_MODEL = Deno.env.get('BOT_MODEL_DEEP') ?? 'claude-opus-5-5';
const FAST_MODEL = Deno.env.get('BOT_MODEL_FAST') ?? 'claude-sonnet-5-5';
const DEEP_TEMPLATES = new Set(['morning', 'weekly']);

const WINDOW_BACK_MS = 86400000;
const WINDOW_AHEAD_MS = 21 * 86400000;
const SMALL_MOVE_MS = 2 * 3600000;

// ===== Context =====

export interface BotContext {
  tz: string;
  now: Date;
  events: (EventRow & { writable: boolean })[];
  tasks: {
    id: string;
    title: string;
    due_date: string | null;
    estimated_minutes: number | null;
    priority: number;
    status: string;
  }[];
  /** Where new blocks go: the primary bot-writable Google calendar, else Meep only. */
  newBlockCalendar: string | null;
}

async function loadContext(userId: string): Promise<BotContext> {
  const now = new Date();
  const [tz, events, tasks, calendars] = await Promise.all([
    userTimezone(userId),
    admin
      .from('events')
      .select('*')
      .eq('user_id', userId)
      .gte('end_time', new Date(now.getTime() - WINDOW_BACK_MS).toISOString())
      .lte('start_time', new Date(now.getTime() + WINDOW_AHEAD_MS).toISOString())
      .order('start_time'),
    admin
      .from('tasks')
      .select('id, title, due_date, estimated_minutes, priority, status')
      .eq('user_id', userId)
      .neq('status', 'done')
      .is('parent_task_id', null)
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(60),
    admin.from('google_calendars').select('calendar_id, is_primary, selected, bots_can_write').eq('user_id', userId),
  ]);
  if (events.error) throw events.error;
  if (tasks.error) throw tasks.error;

  const writableCals = new Set(
    (calendars.data ?? []).filter((c) => c.selected && c.bots_can_write).map((c) => c.calendar_id as string)
  );
  const primaryWritable =
    (calendars.data ?? []).find((c) => c.is_primary && writableCals.has(c.calendar_id))?.calendar_id ??
    [...writableCals][0] ??
    null;

  return {
    tz,
    now,
    events: (events.data as EventRow[]).map((e) => ({
      ...e,
      writable: !e.google_calendar_id || writableCals.has(e.google_calendar_id),
    })),
    tasks: tasks.data ?? [],
    newBlockCalendar: primaryWritable,
  };
}

function describeEvents(ctx: BotContext): string {
  if (!ctx.events.length) return '(nothing scheduled)';
  return ctx.events
    .filter((e) => !e.all_day)
    .map((e) => {
      const flags = [
        !e.writable && 'read-only',
        e.has_guests && 'has guests',
        e.status !== 'planned' && e.status,
        e.bot_id && 'placed by a bot',
      ].filter(Boolean);
      return `- [${e.id}] ${e.title}: ${shortLocal(new Date(e.start_time), ctx.tz)}–${shortLocal(new Date(e.end_time), ctx.tz).slice(4)} (${zonedYmd(new Date(e.start_time), ctx.tz)})${flags.length ? ` {${flags.join(', ')}}` : ''}`;
    })
    .join('\n');
}

function describeTasks(ctx: BotContext): string {
  if (!ctx.tasks.length) return '(no open tasks)';
  return ctx.tasks
    .map((t) => {
      const bits = [
        `priority ${t.priority}`,
        t.due_date && `due ${shortLocal(new Date(t.due_date), ctx.tz)} ${zonedYmd(new Date(t.due_date), ctx.tz)}`,
        t.estimated_minutes && `~${t.estimated_minutes} min`,
      ].filter(Boolean);
      return `- [${t.id}] ${t.title} (${bits.join(', ')})`;
    })
    .join('\n');
}

async function describeTrigger(userId: string, trigger: RunTrigger, ctx: BotContext): Promise<string> {
  switch (trigger.type) {
    case 'schedule':
      return 'You are running on your schedule.';
    case 'manual':
      return 'The user asked you to run now.';
    case 'dry_run':
      return 'The user just created or edited you and wants to see what you would do right now. Do a normal run; nothing will be applied without their approval.';
    case 'chat':
      return 'The user is talking to you in your thread (their message is below). Reply to them, and submit changes if they asked for any.';
    case 'event': {
      const lines = [`You were triggered by: ${trigger.event}.`];
      for (const p of trigger.payloads) {
        if (typeof p.task_id === 'string') {
          const t = ctx.tasks.find((x) => x.id === p.task_id);
          if (t) lines.push(`- Task [${t.id}] ${t.title}${t.due_date ? `, due ${new Date(t.due_date).toISOString()}` : ''}${t.estimated_minutes ? `, ~${t.estimated_minutes} min` : ''}`);
        }
        if (typeof p.event_id === 'string') {
          const e = ctx.events.find((x) => x.id === p.event_id);
          if (e) lines.push(`- Event [${e.id}] ${e.title}, ${shortLocal(new Date(e.start_time), ctx.tz)}`);
        }
      }
      return lines.join('\n');
    }
  }
}

async function recentFeed(botId: string): Promise<string> {
  const { data } = await admin
    .from('feed_items')
    .select('type, title, status, created_at')
    .eq('meeple_id', botId)
    .order('created_at', { ascending: false })
    .limit(6);
  if (!data?.length) return '(none yet)';
  return data.map((f) => `- ${f.created_at.slice(0, 16)} ${f.type} "${f.title}" → ${f.status}`).join('\n');
}

function systemPrompt(bot: BotRow, ctx: BotContext, triggerText: string, feed: string): string {
  const canChange = bot.scope.includes('propose_blocks') || bot.scope.includes('write_blocks');
  const parts = [
    `You are ${bot.name}, a bot inside Meep, a calendar app for a distracted mind. Your job: ${bot.role}.`,
    `Your brief from the user:\n${bot.instructions}`,
    `Hard rule: your only hands are the user's calendar. You can read their calendar${bot.scope.includes('read_tasks') ? ' and tasks' : ''}${canChange ? ' and submit block changes' : ''}. You never message anyone, never touch other apps, and never browse in the background.`,
    `Now: ${ctx.now.toISOString()} (${shortLocal(ctx.now, ctx.tz)} ${zonedYmd(ctx.now, ctx.tz)} in ${ctx.tz}). Write every time you submit as ISO 8601 with the correct offset for ${ctx.tz}.`,
    triggerText,
  ];

  if (bot.scope.includes('read_calendar')) parts.push(`Calendar (yesterday to three weeks out; ids in brackets):\n${describeEvents(ctx)}`);
  if (bot.scope.includes('read_tasks')) parts.push(`Open tasks:\n${describeTasks(ctx)}`);
  parts.push(`Your recent feed items:\n${feed}`);

  if (canChange) {
    parts.push(
      [
        'To change the calendar, call submit_changes once with every change and a one-line summary. The app decides whether each change is applied now or shown to the user to approve, so always submit what you think is right.',
        'Only move or delete events not marked read-only. Avoid moving events that have guests. Never overlap existing events, never schedule in the past, and keep blocks inside roughly 08:00–21:00 unless the brief says otherwise.',
        'Use find_free_time and suggest_focus_blocks rather than guessing where the gaps are.',
        'If nothing needs to change, do not call submit_changes; just say so in a sentence.',
      ].join(' ')
    );
  }
  parts.push(
    'If you have something worth telling the user that is not a change (a summary, a pattern, a heads-up), call report once.',
    'Tone: calm and neutral, never guilt. Say "moved Write report to 3pm", not "you missed Write report". Plain text only, no markdown, short.'
  );
  return parts.join('\n\n');
}

// ===== Tools =====

const CHANGE_SCHEMA = {
  type: 'object',
  properties: {
    kind: { type: 'string', enum: ['create', 'move', 'delete'] },
    event_id: { type: 'string', description: 'For move/delete: the [id] of an existing event' },
    title: { type: 'string', description: 'For create: the block title' },
    start: { type: 'string', description: 'For create/move: ISO 8601 start' },
    end: { type: 'string', description: 'For create/move: ISO 8601 end' },
    task_id: { type: 'string', description: 'For create: the task this block is time for, if any' },
    reason: { type: 'string', description: 'A few words on why, shown to the user' },
  },
  required: ['kind', 'reason'],
  additionalProperties: false,
} as const;

function toolsFor(bot: BotRow, chat: boolean): Anthropic.Beta.BetaToolUnion[] {
  const tools: Anthropic.Beta.BetaToolUnion[] = [];
  if (bot.scope.includes('read_calendar')) {
    tools.push(
      {
        name: 'find_free_time',
        description: 'Free slots (within 08:00–21:00 local, with 15-minute buffers around events) between two times.',
        input_schema: {
          type: 'object',
          properties: {
            from: { type: 'string', description: 'ISO 8601' },
            to: { type: 'string', description: 'ISO 8601' },
            min_minutes: { type: 'integer' },
          },
          required: ['from', 'to'],
        },
      },
      {
        name: 'suggest_focus_blocks',
        description:
          'Works back from a deadline: proposes focus sessions (at most one per day, up to 90 min each) in free time before it. A starting point you can adjust.',
        input_schema: {
          type: 'object',
          properties: {
            total_minutes: { type: 'integer' },
            due: { type: 'string', description: 'ISO 8601 deadline' },
            max_session_minutes: { type: 'integer' },
          },
          required: ['total_minutes', 'due'],
        },
      }
    );
  }
  if (bot.scope.includes('propose_blocks') || bot.scope.includes('write_blocks')) {
    tools.push({
      name: 'submit_changes',
      description: 'Submit every block change for this run, with a one-line summary for the card.',
      input_schema: {
        type: 'object',
        properties: {
          summary: { type: 'string' },
          changes: { type: 'array', items: CHANGE_SCHEMA },
        },
        required: ['summary', 'changes'],
      },
    });
  }
  tools.push({
    name: 'report',
    description: 'Tell the user something that is not a change: a short title and a few sentences.',
    input_schema: {
      type: 'object',
      properties: { title: { type: 'string' }, body: { type: 'string' } },
      required: ['title', 'body'],
    },
  });
  // Live chat turns may browse if the user gave the bot that skill; background runs never do.
  if (chat && bot.web_search) tools.push({ type: 'web_search_20260209', name: 'web_search', max_uses: 4 });
  return tools;
}

// ===== Validation =====

export function validate(raw: BlockChange[], ctx: BotContext): { changes: StoredChange[]; problems: string[] } {
  const problems: string[] = [];
  const changes: StoredChange[] = [];
  const byId = new Map(ctx.events.map((e) => [e.id, e]));
  const touched = new Set(raw.filter((c) => c.kind !== 'create').map((c) => (c as { event_id: string }).event_id));
  // Busy time the new plan must not overlap: untouched timed events plus accepted changes.
  const busy = ctx.events
    .filter((e) => !e.all_day && !touched.has(e.id))
    .map((e) => ({ start: new Date(e.start_time).getTime(), end: new Date(e.end_time).getTime(), title: e.title }));
  const earliest = ctx.now.getTime() - 5 * 60000;

  raw.forEach((c, i) => {
    const label = `change ${i + 1}`;
    if (c.kind === 'move' || c.kind === 'delete') {
      const ev = byId.get(c.event_id);
      if (!ev) return problems.push(`${label}: no event with id ${c.event_id}`);
      if (!ev.writable) return problems.push(`${label}: "${ev.title}" is read-only`);
      if (ev.all_day) return problems.push(`${label}: "${ev.title}" is an all-day event`);
      if (c.kind === 'delete') {
        changes.push({
          id: `c${i}`,
          kind: 'delete',
          title: ev.title,
          reason: c.reason,
          event_id: ev.id,
          before: { start: ev.start_time, end: ev.end_time },
          after: null,
        });
        return;
      }
    }
    if (c.kind === 'create' && !c.title?.trim()) return problems.push(`${label}: a new block needs a title`);

    const { start, end } = c as { start: string; end: string };
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    if (Number.isNaN(s) || Number.isNaN(e)) return problems.push(`${label}: start and end must be ISO 8601`);
    if (e - s < 10 * 60000 || e - s > 8 * 3600000) return problems.push(`${label}: blocks must be 10 minutes to 8 hours`);
    if (s < earliest) return problems.push(`${label}: starts in the past`);
    if (s > ctx.now.getTime() + 60 * 86400000) return problems.push(`${label}: more than 60 days out`);
    const clash = busy.find((b) => s < b.end && e > b.start);
    if (clash) return problems.push(`${label}: overlaps "${clash.title}"`);

    if (c.kind === 'create') {
      if (c.task_id && !ctx.tasks.some((t) => t.id === c.task_id)) {
        return problems.push(`${label}: no open task with id ${c.task_id}`);
      }
      changes.push({
        id: `c${i}`,
        kind: 'create',
        title: c.title.trim(),
        reason: c.reason,
        task_id: c.task_id,
        google_calendar_id: ctx.newBlockCalendar,
        before: null,
        after: { start: new Date(s).toISOString(), end: new Date(e).toISOString() },
      });
      busy.push({ start: s, end: e, title: c.title });
    } else {
      const ev = byId.get(c.event_id)!;
      changes.push({
        id: `c${i}`,
        kind: 'move',
        title: ev.title,
        reason: c.reason,
        event_id: ev.id,
        before: { start: ev.start_time, end: ev.end_time },
        after: { start: new Date(s).toISOString(), end: new Date(e).toISOString() },
      });
      busy.push({ start: s, end: e, title: ev.title });
    }
  });

  return { changes, problems };
}

/** Re-checks stored changes against the calendar as it is now (before approving). */
export async function recheck(userId: string, changes: StoredChange[]): Promise<string | null> {
  const ctx = await loadContext(userId);
  const raw: BlockChange[] = changes.map((c) =>
    c.kind === 'create'
      ? { kind: 'create', title: c.title, start: c.after!.start, end: c.after!.end, task_id: c.task_id, reason: c.reason }
      : c.kind === 'move'
      ? { kind: 'move', event_id: c.event_id!, start: c.after!.start, end: c.after!.end, reason: c.reason }
      : { kind: 'delete', event_id: c.event_id!, reason: c.reason }
  );
  const { problems } = validate(raw, ctx);
  return problems.length ? problems[0].replace(/^change \d+: /, '') : null;
}

/** "Small" for ask_big: a move of under two hours that stays on the same local day. */
export function isSmall(c: StoredChange, tz: string): boolean {
  if (c.kind !== 'move' || !c.before || !c.after) return false;
  const shift = Math.abs(new Date(c.after.start).getTime() - new Date(c.before.start).getTime());
  return (
    shift < SMALL_MOVE_MS &&
    zonedYmd(new Date(c.before.start), tz) === zonedYmd(new Date(c.after.start), tz)
  );
}

// ===== Applying and undoing =====

/** Applies one change on the bot's behalf and records what undo needs. */
export async function applyChange(bot: Pick<BotRow, 'id' | 'name' | 'user_id'>, c: StoredChange): Promise<StoredChange> {
  try {
    if (c.kind === 'create') {
      const id = `bot_${crypto.randomUUID()}`;
      const row = await writeEvent(
        bot.user_id,
        {
          op: 'upsert',
          row: {
            id,
            title: c.title,
            description: c.google_calendar_id ? `Placed by ${bot.name} · Meep` : null,
            start_time: c.after!.start,
            end_time: c.after!.end,
            all_day: false,
            color: '#6C5CE7',
            source: 'local',
            schedule_source: 'ai',
            is_habit: false,
            google_calendar_id: c.google_calendar_id ?? null,
            task_id: c.task_id ?? null,
            bot_id: bot.id,
          },
          extendedProperties: { meepBot: bot.id },
        },
        'bot'
      );
      return { ...c, event_id: id, applied: true, before_row: null, applied_updated_at: row?.updated_at ?? null };
    }

    const { data: before } = await admin
      .from('events')
      .select('*')
      .eq('id', c.event_id!)
      .eq('user_id', bot.user_id)
      .maybeSingle<EventRow>();
    if (!before) return { ...c, applied: false, error: 'That event no longer exists.' };

    if (c.kind === 'delete') {
      await writeEvent(bot.user_id, { op: 'delete', id: before.id }, 'bot');
      return { ...c, applied: true, before_row: before, applied_updated_at: null };
    }

    const row = await writeEvent(
      bot.user_id,
      { op: 'upsert', row: { id: before.id, start_time: c.after!.start, end_time: c.after!.end, bot_id: bot.id } },
      'bot'
    );
    return { ...c, applied: true, before_row: before, applied_updated_at: row?.updated_at ?? null };
  } catch (err) {
    return { ...c, applied: false, error: err instanceof Error ? err.message : String(err) };
  }
}

const sameInstant = (a?: string | null, b?: string | null) => !!a && !!b && new Date(a).getTime() === new Date(b).getTime();

/** Reverts applied changes, all or nothing. Returns why it can't, or null when done. */
export async function undoChanges(userId: string, changes: StoredChange[]): Promise<string | null> {
  const applied = changes.filter((c) => c.applied);
  const ids = applied.map((c) => c.event_id).filter(Boolean) as string[];
  const { data: rows } = await admin.from('events').select('id, title, updated_at').eq('user_id', userId).in('id', ids);
  const current = new Map((rows ?? []).map((r) => [r.id, r]));

  for (const c of applied) {
    const now = current.get(c.event_id!);
    if (c.kind === 'delete') {
      if (now) return `"${c.title}" is back already.`;
    } else if (!now || !sameInstant(now.updated_at, c.applied_updated_at)) {
      return `"${c.title}" has changed since, so this can't be undone.`;
    }
  }

  for (const c of applied) {
    if (c.kind === 'create') {
      await writeEvent(userId, { op: 'delete', id: c.event_id! }, 'bot');
    } else if (c.kind === 'move') {
      const b = c.before_row!;
      await writeEvent(
        userId,
        { op: 'upsert', row: { id: b.id, start_time: b.start_time, end_time: b.end_time, bot_id: b.bot_id } },
        'bot'
      );
    } else {
      const { created_at: _c, updated_at: _u, ...b } = c.before_row!;
      await writeEvent(userId, { op: 'upsert', row: b }, 'bot');
    }
  }
  return null;
}

// ===== A run =====

export interface RunResult {
  runId: string;
  status: 'done' | 'error' | 'skipped';
  reply?: string;
  /** The thread message holding the reply, so the app can show it without a duplicate. */
  replyMessageId?: string;
  feedItemIds: string[];
}

async function threadHistory(botId: string): Promise<Anthropic.Beta.BetaMessageParam[]> {
  const { data } = await admin
    .from('meeple_messages')
    .select('role, content')
    .eq('meeple_id', botId)
    .order('created_at', { ascending: false })
    .limit(20);
  const msgs = (data ?? []).reverse().filter((m) => m.content?.trim());
  while (msgs.length && msgs[0].role !== 'user') msgs.shift();
  return msgs.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
}

async function postToThread(bot: BotRow, content: string, markUnread: boolean): Promise<string> {
  const id = `bot_${crypto.randomUUID()}`;
  await admin.from('meeple_messages').insert({
    id,
    meeple_id: bot.id,
    user_id: bot.user_id,
    role: 'assistant',
    content,
  });
  if (markUnread) await admin.from('meeples').update({ unread: true }).eq('id', bot.id);
  return id;
}

async function isPaused(userId: string): Promise<boolean> {
  const [{ data: cfg }, { data: settings }] = await Promise.all([
    admin.from('app_config').select('value').eq('key', 'bots_paused').maybeSingle(),
    admin.from('user_settings').select('bots_paused_until').eq('user_id', userId).maybeSingle(),
  ]);
  if (cfg?.value === true) return true;
  return !!settings?.bots_paused_until && new Date(settings.bots_paused_until) > new Date();
}

export async function loadBot(botId: string): Promise<BotRow | null> {
  const { data } = await admin.from('meeples').select('*').eq('id', botId).maybeSingle<BotRow>();
  return data;
}

/**
 * Runs a bot once. Background runs (schedule/event) respect enabled, the global
 * kill switch and per-user pauses; runs the user starts (chat, dry run, manual)
 * don't. A dry run never applies anything.
 */
export async function runBot(bot: BotRow, trigger: RunTrigger): Promise<RunResult> {
  const background = trigger.type === 'schedule' || trigger.type === 'event';
  const chat = trigger.type === 'chat';
  const dryRun = trigger.type === 'dry_run';
  const model = DEEP_TEMPLATES.has(bot.template ?? '') ? DEEP_MODEL : FAST_MODEL;

  const { data: run, error } = await admin
    .from('bot_runs')
    .insert({ user_id: bot.user_id, meeple_id: bot.id, trigger, model })
    .select('id')
    .single();
  if (error) throw error;
  const finish = (fields: Record<string, unknown>) =>
    admin.from('bot_runs').update({ ...fields, finished_at: new Date().toISOString() }).eq('id', run.id);

  if (background && (!bot.enabled || (await isPaused(bot.user_id)))) {
    await finish({ status: 'skipped' });
    return { runId: run.id, status: 'skipped', feedItemIds: [] };
  }

  try {
    const ctx = await loadContext(bot.user_id);
    const system = systemPrompt(bot, ctx, await describeTrigger(bot.user_id, trigger, ctx), await recentFeed(bot.id));
    const messages: Anthropic.Beta.BetaMessageParam[] = chat
      ? [...(await threadHistory(bot.id)), { role: 'user', content: trigger.message }]
      : [{ role: 'user', content: 'Do your run now.' }];
    // History already holds the user's message when the app saved it first.
    if (chat && messages.length > 1) {
      const prev = messages[messages.length - 2];
      if (prev.role === 'user' && prev.content === trigger.message) messages.splice(messages.length - 2, 1);
    }

    let submitted: { summary: string; changes: StoredChange[] } | null = null;
    const reports: { title: string; body: string }[] = [];

    const onToolCall = (call: ToolCall): string => {
      const input = call.input as Record<string, any>;
      if (call.name === 'find_free_time') {
        const busy = ctx.events.filter((e) => !e.all_day).map((e) => ({ start: new Date(e.start_time), end: new Date(e.end_time) }));
        const slots = freeSlots(busy, new Date(input.from), new Date(input.to), ctx.tz).filter(
          (s) => s.minutes >= (input.min_minutes ?? 0)
        );
        return JSON.stringify(slots.slice(0, 40).map((s) => ({ start: s.start.toISOString(), end: s.end.toISOString(), minutes: s.minutes, local: shortLocal(s.start, ctx.tz) })));
      }
      if (call.name === 'suggest_focus_blocks') {
        const busy = ctx.events.filter((e) => !e.all_day).map((e) => ({ start: new Date(e.start_time), end: new Date(e.end_time) }));
        const plan = workBackFromDeadline(Number(input.total_minutes), new Date(input.due), busy, ctx.now, ctx.tz, {
          maxSession: input.max_session_minutes ?? 90,
        });
        return JSON.stringify({
          blocks: plan.blocks.map((b) => ({ start: b.start.toISOString(), end: b.end.toISOString(), minutes: b.minutes, local: shortLocal(b.start, ctx.tz) })),
          unplaced_minutes: plan.short,
        });
      }
      if (call.name === 'submit_changes') {
        const { changes, problems } = validate((input.changes ?? []) as BlockChange[], ctx);
        if (problems.length) {
          return `Not accepted. Fix these and call submit_changes again with the full corrected list:\n${problems.join('\n')}`;
        }
        submitted = { summary: String(input.summary ?? '').trim() || 'Calendar changes', changes };
        return `Accepted ${changes.length} change(s).`;
      }
      if (call.name === 'report') {
        reports.push({ title: String(input.title ?? ''), body: String(input.body ?? '') });
        return 'Shown to the user.';
      }
      return 'Unknown tool.';
    };

    const result = await runToolLoop({
      model,
      system,
      messages,
      tools: toolsFor(bot, chat),
      onToolCall,
      maxRounds: 8,
    });

    const feedItemIds: string[] = [];
    const sub = submitted as { summary: string; changes: StoredChange[] } | null;
    if (sub?.changes.length) {
      const day = zonedYmd(new Date(sub.changes[0].after?.start ?? sub.changes[0].before!.start), ctx.tz);
      const autoApply = (c: StoredChange) =>
        !dryRun && (bot.trust === 'auto' || (bot.trust === 'ask_big' && isSmall(c, ctx.tz)));
      const toApply = sub.changes.filter(autoApply);
      const toPropose = sub.changes.filter((c) => !autoApply(c));

      if (toApply.length) {
        const applied = [];
        for (const c of toApply) applied.push(await applyChange(bot, c));
        const ok = applied.filter((c) => c.applied);
        if (ok.length) {
          const { data } = await admin
            .from('feed_items')
            .insert({
              user_id: bot.user_id,
              meeple_id: bot.id,
              run_id: run.id,
              type: 'done',
              title: toPropose.length ? describeApplied(ok, ctx.tz) : sub.summary,
              payload: { summary: sub.summary, changes: applied, day } satisfies FeedPayload,
              status: 'applied',
              applied_at: new Date().toISOString(),
            })
            .select('id')
            .single();
          if (data) feedItemIds.push(data.id);
        }
      }
      if (toPropose.length) {
        const { data } = await admin
          .from('feed_items')
          .insert({
            user_id: bot.user_id,
            meeple_id: bot.id,
            run_id: run.id,
            type: 'proposal',
            title: sub.summary,
            payload: { summary: sub.summary, changes: toPropose, day } satisfies FeedPayload,
            dry_run: dryRun,
          })
          .select('id')
          .single();
        if (data) feedItemIds.push(data.id);
      }
    }

    for (const r of reports) {
      const { data } = await admin
        .from('feed_items')
        .insert({ user_id: bot.user_id, meeple_id: bot.id, run_id: run.id, type: 'insight', title: r.title, body: r.body, dry_run: dryRun })
        .select('id')
        .single();
      if (data) feedItemIds.push(data.id);
    }

    // Chat turns always answer in the thread; background runs leave a line only when they did something.
    let reply = result.refused ? "Sorry, that's not something I can help with." : result.text;
    let replyMessageId: string | undefined;
    if (chat) {
      reply ||= feedItemIds.length ? "Done, it's in your feed." : 'Nothing to change.';
      replyMessageId = await postToThread(bot, reply, false);
    } else if (feedItemIds.length) {
      await postToThread(bot, reply || sub?.summary || 'Left something in your feed.', background);
    }

    await finish({
      status: 'done',
      output: { text: result.text, submitted: sub, reports },
      input_snapshot: { events: ctx.events.length, tasks: ctx.tasks.length, trigger },
      input_tokens: result.usage.input,
      output_tokens: result.usage.output,
    });
    return { runId: run.id, status: 'done', reply, replyMessageId, feedItemIds };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await finish({ status: 'error', error: message });
    const reply = `Sorry, I couldn't get to that. ${message}`;
    const replyMessageId = chat ? await postToThread(bot, reply, false) : undefined;
    return { runId: run.id, status: 'error', reply, replyMessageId, feedItemIds: [] };
  }
}

function describeApplied(changes: StoredChange[], tz: string): string {
  const [first] = changes;
  const what =
    first.kind === 'move'
      ? `Moved ${first.title} to ${shortLocal(new Date(first.after!.start), tz).slice(4)}`
      : first.kind === 'create'
      ? `Added ${first.title}`
      : `Removed ${first.title}`;
  return changes.length > 1 ? `${what} and ${changes.length - 1} more` : what;
}
