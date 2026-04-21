import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;

function buildSystemPrompt(
  persona: string,
  companionName: string,
  timezone: string,
  currentDate: string,
  context: {
    todayEvents: { id: string; title: string; startTime: string; endTime: string }[];
    todayTasks: { id: string; title: string; status: string; priority: number; dueDate?: string }[];
    upcomingEvents: { id: string; title: string; startTime: string; endTime: string }[];
  }
): string {
  const personaTone =
    persona === 'professional'
      ? 'Be concise and efficient. No small talk.'
      : persona === 'playful'
      ? 'Be fun and encouraging! Add a little personality and emojis.'
      : 'Be warm, friendly, and casual. Like a helpful friend.';

  const eventsSection = context.todayEvents.length
    ? `Today's events:\n${context.todayEvents.map((e) => `- [${e.id}] ${e.title}: ${e.startTime} to ${e.endTime}`).join('\n')}`
    : 'No events scheduled for today.';

  const tasksSection = context.todayTasks.length
    ? `Current tasks:\n${context.todayTasks.map((t) => `- [${t.id}] ${t.title} (priority: ${t.priority}, status: ${t.status}${t.dueDate ? `, due: ${t.dueDate}` : ''})`).join('\n')}`
    : 'No pending tasks.';

  const upcomingSection = context.upcomingEvents.length
    ? `Upcoming events (next 3 days):\n${context.upcomingEvents.map((e) => `- [${e.id}] ${e.title}: ${e.startTime} to ${e.endTime}`).join('\n')}`
    : 'No upcoming events in the next 3 days.';

  return `You are ${companionName}, an AI calendar companion.
Current date: ${currentDate}. User's timezone: ${timezone}.
${personaTone}

Here is the user's current schedule:
${eventsSection}

${tasksSection}

${upcomingSection}

You can have a natural conversation with the user about their schedule, productivity, and time management. You can also propose actions to modify their calendar or tasks.

When you want to propose an action, include it in the "actions" array of your JSON response. Supported action types:

1. "create_event" - params: { title, startTime (ISO), endTime (ISO), description?, allDay?, color? }
2. "move_event" - params: { eventId, newStartTime (ISO), newEndTime (ISO) } (use the [id] from the schedule above)
3. "delete_event" - params: { eventId }
4. "create_task" - params: { title, priority? (1-4), dueDate? (ISO), estimatedMinutes?, description? }
5. "complete_task" - params: { taskId } (use the [id] from the tasks above)

Each action must include a "label" field with a short human-readable description of what it does (e.g. "Move 'Dentist' from 2pm to 3pm").

Output ONLY valid JSON:
{
  "message": "Your conversational response to the user",
  "actions": [
    { "type": "action_type", "params": { ... }, "label": "Human-readable description" }
  ]
}

If no actions are needed, omit the "actions" field or set it to null.
Output ONLY the JSON object. No markdown, no explanation, no code fences.`;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
      },
    });
  }

  try {
    const { messages, persona, companionName, timezone, currentDate, context } = await req.json();

    const systemPrompt = buildSystemPrompt(
      persona || 'friendly',
      companionName || 'Meep',
      timezone,
      currentDate,
      context || { todayEvents: [], todayTasks: [], upcomingEvents: [] }
    );

    // Build conversation: context summary + last 20 messages
    const claudeMessages = [
      {
        role: 'user' as const,
        content: 'Hi! I want to chat about my schedule.',
      },
      {
        role: 'assistant' as const,
        content: JSON.stringify({ message: `Hey! I'm ${companionName || 'Meep'}, your calendar companion. I can see your schedule - how can I help?` }),
      },
      ...(messages || []).slice(-20).map((m: any) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ];

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20241022',
        max_tokens: 2048,
        system: systemPrompt,
        messages: claudeMessages,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Anthropic API error ${response.status}: ${errBody}`);
    }

    const data = await response.json();
    const content = data.content?.[0]?.text;

    if (!content) {
      throw new Error('Empty response from Claude');
    }

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      // If the model didn't return valid JSON, wrap the raw text
      parsed = { message: content, actions: null };
    }

    return new Response(
      JSON.stringify({
        message: parsed.message || 'I\'m here to help!',
        actions: parsed.actions || null,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
});
