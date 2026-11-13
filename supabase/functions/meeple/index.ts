import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { Anthropic, anthropicErrorResponse, runToolLoop } from '../_shared/anthropic.ts';
import { CORS, json } from '../_shared/cors.ts';

// A meeple is a small standing agent: a name, a job, a brief, and the skills the
// user switched on. This function runs one turn of its thread.

const MODEL = Deno.env.get('MEEPLE_MODEL') ?? 'claude-opus-5-5';

interface MeepleConfig {
  name: string;
  role: string;
  instructions: string;
  webSearch: boolean;
  scheduleAccess: boolean;
}

interface ScheduleContext {
  events: { title: string; startTime: string; endTime: string }[];
  tasks: { title: string; status: string; priority: number; dueDate?: string }[];
}

const PROPOSAL_TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: 'propose_task',
    description:
      "Propose adding a task to the user's task list. The app shows it as a card the user accepts or dismisses; nothing is added until they accept.",
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        priority: { type: 'integer', enum: [1, 2, 3, 4], description: '1 is most urgent' },
        dueDate: { type: 'string', description: 'ISO 8601 date-time' },
        estimatedMinutes: { type: 'integer' },
      },
      required: ['title'],
      additionalProperties: false,
    },
  },
  {
    name: 'propose_event',
    description:
      "Propose adding an event to the user's calendar. The app shows it as a card the user accepts or dismisses; nothing is added until they accept.",
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        startTime: { type: 'string', description: 'ISO 8601 date-time' },
        endTime: { type: 'string', description: 'ISO 8601 date-time' },
        description: { type: 'string' },
        allDay: { type: 'boolean' },
      },
      required: ['title', 'startTime', 'endTime'],
      additionalProperties: false,
    },
  },
];

function buildSystemPrompt(
  meeple: MeepleConfig,
  companionName: string,
  timezone: string,
  currentDate: string,
  context?: ScheduleContext
): string {
  const parts = [
    `You are ${meeple.name}, a "meeple": one of the user's personal agents inside ${companionName}, a calendar and task app. Each meeple has one job and keeps a running thread with the user, who drops in to hand you tasks and read what you found.`,
    `Your job: ${meeple.role}.`,
    `Your standing brief from the user:\n${meeple.instructions}`,
    `Current date and time: ${currentDate}. The user's timezone is ${timezone}.`,
  ];

  parts.push(
    meeple.webSearch
      ? 'You can search and read the web. Use it whenever the answer depends on current or specific information, and say where things came from.'
      : 'You cannot browse the web in this thread. If a task needs live information, say so and work from what the user gives you.'
  );

  if (meeple.scheduleAccess && context) {
    const events = context.events.length
      ? context.events.map((e) => `- ${e.title}: ${e.startTime} to ${e.endTime}`).join('\n')
      : '(none)';
    const tasks = context.tasks.length
      ? context.tasks
          .map((t) => `- ${t.title} (priority ${t.priority}, ${t.status}${t.dueDate ? `, due ${t.dueDate}` : ''})`)
          .join('\n')
      : '(none)';
    parts.push(
      `The user's calendar for the next few days:\n${events}\n\nTheir open tasks:\n${tasks}\n\nWhen something should land on their task list or calendar, propose it with propose_task or propose_event rather than only describing it. They confirm each proposal in the app.`
    );
  }

  parts.push(
    "You have no access to the user's email, messages, files or accounts, and you only run when they message you or tap Check in: you are not working in the background between turns. Be straightforward about both. If the brief asks for something you can't reach, do the part you can (for example, working from text they paste in) and say plainly what is out of reach.",
    'When the user asks you to check in, do a fresh pass of your standing brief now and report what is new or worth their attention, leading with the most important thing. If nothing changed, say so briefly.',
    'Your replies appear in a phone chat bubble that shows plain text only, so write short conversational prose without markdown syntax. Simple line breaks and "-" lists are fine.'
  );

  return parts.join('\n\n');
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  try {
    const { meeple, messages, companionName, timezone, currentDate, context } = (await req.json()) as {
      meeple: MeepleConfig;
      messages: { role: 'user' | 'assistant'; content: string }[];
      companionName?: string;
      timezone: string;
      currentDate: string;
      context?: ScheduleContext;
    };

    if (!meeple?.name || !meeple?.instructions) return json({ error: 'Missing meeple' }, 400);

    // Recent history, starting on a user turn and skipping empty messages.
    const history = (messages ?? []).filter((m) => m.content?.trim()).slice(-30);
    while (history.length && history[0].role !== 'user') history.shift();
    if (!history.length) return json({ error: 'No message to answer' }, 400);

    const conversation: Anthropic.Beta.BetaMessageParam[] = history.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const tools: Anthropic.Beta.BetaToolUnion[] = [];
    if (meeple.webSearch) tools.push({ type: 'web_search_20260209', name: 'web_search', max_uses: 6 });
    if (meeple.scheduleAccess) tools.push(...PROPOSAL_TOOLS);

    const system = buildSystemPrompt(meeple, companionName || 'Meep', timezone, currentDate, context);

    const result = await runToolLoop({
      model: MODEL,
      system,
      messages: conversation,
      tools,
      onToolCall: () => 'Shown to the user as a card. They will accept or dismiss it in the app.',
    });

    if (result.refused) {
      return json({ message: "Sorry, that's not something I can help with.", actions: null, sources: [] });
    }

    const actions = result.calls.map((p) => {
      const isTask = p.name === 'propose_task';
      return {
        type: isTask ? 'create_task' : 'create_event',
        params: p.input,
        label: `${isTask ? 'Add task' : 'Add event'}: ${String(p.input.title ?? '')}`,
      };
    });

    return json({
      message: result.text || (actions.length ? "Here's what I'd suggest:" : "I didn't come up with anything. Try asking again?"),
      actions: actions.length ? actions : null,
      sources: [...result.sources].slice(0, 8).map(([url, title]) => ({ url, title })),
    });
  } catch (err) {
    const apiError = anthropicErrorResponse(err);
    if (apiError) return json({ error: apiError.error }, apiError.status);
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
  }
});
