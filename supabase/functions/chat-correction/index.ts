import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;

function buildSystemPrompt(persona: string, timezone: string, currentDate: string): string {
  const personaTone =
    persona === 'professional'
      ? 'Be concise and efficient.'
      : persona === 'playful'
      ? 'Be fun and encouraging!'
      : 'Be warm and friendly.';

  return `You are an AI calendar assistant helping a user refine parsed brain dump items.
Current date: ${currentDate}. User's timezone: ${timezone}.
${personaTone}

The user has already parsed their brain dump and is now making corrections or asking questions about the parsed items.

You will receive the current parsed items as context. When the user requests changes (e.g. "change dentist to 3pm", "make that a higher priority", "delete the grocery one"), update the relevant items.

Output ONLY valid JSON:
{
  "updatedItems": [
    {
      "id": "existing-item-id",
      "type": "event" | "task" | "goal" | "habit",
      "confidence": 0.0 to 1.0,
      "raw": "original text",
      "event": { ... } | null,
      "task": { ... } | null,
      "goal": { ... } | null,
      "habit": { ... } | null,
      "status": "pending" | "edited" | "deleted"
    }
  ],
  "message": "Friendly confirmation of what was changed"
}

Rules:
- Only include items that were changed in updatedItems
- Set status to "edited" for modified items, "deleted" for removed ones
- Keep unchanged fields as-is
- If the user's request is unclear, set message to ask for clarification and return empty updatedItems

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
    const { messages, currentItems, persona, timezone, currentDate } = await req.json();

    const systemPrompt = buildSystemPrompt(persona || 'friendly', timezone, currentDate);

    // Build conversation with items context
    const claudeMessages = [
      {
        role: 'user' as const,
        content: `Here are the currently parsed items:\n${JSON.stringify(currentItems, null, 2)}\n\nNow I'll make corrections:`,
      },
      { role: 'assistant' as const, content: 'I can see your parsed items. What would you like to change?' },
      ...messages.slice(-10).map((m: any) => ({
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

    const parsed = JSON.parse(content);

    return new Response(
      JSON.stringify({
        updatedItems: parsed.updatedItems || [],
        message: parsed.message || 'Done!',
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
