import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;

function buildSystemPrompt(
  persona: string,
  timezone: string,
  currentDate: string,
  existingEvents?: { title: string; startTime: string; endTime: string }[]
): string {
  const personaTone =
    persona === 'professional'
      ? 'Be concise and efficient. No small talk.'
      : persona === 'playful'
      ? 'Be fun and encouraging! Add a little personality.'
      : 'Be warm, friendly, and casual. Like a helpful friend.';

  const eventsContext = existingEvents?.length
    ? `\nThe user already has these events scheduled:\n${existingEvents.map((e) => `- ${e.title}: ${e.startTime} to ${e.endTime}`).join('\n')}\nAvoid scheduling conflicts with these.`
    : '';

  return `You are an AI assistant that parses brain dump text into structured calendar items.
Current date: ${currentDate}. User's timezone: ${timezone}.
${personaTone}

Parse the user's text and output ONLY valid JSON matching this exact schema:
{
  "items": [
    {
      "type": "event" | "task" | "goal" | "habit",
      "confidence": 0.0 to 1.0,
      "raw": "the exact text snippet this item came from",
      "event": { "title": string, "description": string | null, "startTime": "ISO 8601", "endTime": "ISO 8601", "allDay": boolean, "location": string | null, "color": null } | null,
      "task": { "title": string, "description": string | null, "dueDate": "ISO 8601" | null, "priority": 1-4, "estimatedMinutes": number, "category": string | null, "color": null } | null,
      "goal": { "title": string, "description": string | null, "targetDate": "ISO 8601" | null, "category": string | null } | null,
      "habit": { "title": string, "description": string | null, "frequency": "daily" | "weekdays" | "weekends" | "custom", "customDays": [0-6] | null, "startTime": "HH:mm", "durationMinutes": number, "color": null } | null
    }
  ],
  "summary": "Brief summary of what was extracted",
  "followUpQuestion": "Ask if anything is ambiguous, or null"
}

Classification rules:
- EVENT: Has a specific date and time ("dentist Tuesday 2pm", "meeting tomorrow at 10")
- TASK: An action item, may have a deadline but no fixed time ("buy groceries", "finish report by Friday")
- GOAL: Aspirational, longer-term ("run a marathon", "learn Spanish", "read more")
- HABIT: Recurring behavior ("meditate every morning", "gym 3x a week", "walk the dog daily")

Inference rules:
- Resolve relative dates: "tomorrow", "next Tuesday", "this weekend" → specific ISO dates based on current date
- Priority: "urgent"/"ASAP" → 1, "important"/"soon" → 2, default → 3, "someday"/"whenever" → 4
- Duration: meetings → 60min, calls → 15-30min, errands → 30min, workouts → 60min, default → 30min
- If ambiguous between types, prefer task with lower confidence
- For habits with "3x a week", use frequency "custom" with 3 spread-out days (e.g. Mon/Wed/Fri)
- Default habit time: morning habits → "07:00", afternoon → "14:00", evening → "19:00"
- Always set color to null for all items; the client will assign colors based on user preferences
${eventsContext}

Output ONLY the JSON object. No markdown, no explanation, no code fences.`;
}

serve(async (req: Request) => {
  // Handle CORS preflight
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
    const { text, persona, existingEvents, timezone, currentDate } = await req.json();

    if (!text?.trim()) {
      return new Response(JSON.stringify({ error: 'No text provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const systemPrompt = buildSystemPrompt(persona || 'friendly', timezone, currentDate, existingEvents);

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
        messages: [{ role: 'user', content: text }],
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

    // Parse the JSON response from Claude
    const parsed = JSON.parse(content);

    // Add client IDs to each item
    const items = (parsed.items || []).map((item: any, i: number) => ({
      ...item,
      id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
      status: 'pending',
    }));

    return new Response(
      JSON.stringify({
        items,
        summary: parsed.summary || 'Parsed your brain dump!',
        followUpQuestion: parsed.followUpQuestion || null,
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
