import Anthropic from 'npm:@anthropic-ai/sdk';

export { Anthropic };

export const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });

export interface ToolCall {
  name: string;
  input: Record<string, unknown>;
}

export interface ToolLoopResult {
  text: string;
  calls: ToolCall[];
  /** Web pages cited in the reply, url → title. */
  sources: Map<string, string>;
  refused: boolean;
}

/**
 * Runs a Claude turn to completion, answering each client tool call with
 * `onToolCall` and resuming server-tool pauses (web search). Text from every
 * round is concatenated.
 */
export async function runToolLoop({
  model,
  system,
  messages,
  tools,
  onToolCall,
  maxRounds = 6,
  effort = 'medium',
}: {
  model: string;
  system: string;
  messages: Anthropic.Beta.BetaMessageParam[];
  tools: Anthropic.Beta.BetaToolUnion[];
  onToolCall: (call: ToolCall) => string | Promise<string>;
  maxRounds?: number;
  effort?: 'low' | 'medium' | 'high';
}): Promise<ToolLoopResult> {
  const conversation = [...messages];
  const text: string[] = [];
  const calls: ToolCall[] = [];
  const sources = new Map<string, string>();

  for (let round = 0; round < maxRounds; round++) {
    const response = await anthropic.beta.messages.create({
      model,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort },
      system,
      messages: conversation,
      ...(tools.length ? { tools } : {}),
    });

    if (response.stop_reason === 'refusal') {
      return { text: '', calls, sources, refused: true };
    }

    const uses: Anthropic.Beta.BetaToolUseBlock[] = [];
    for (const block of response.content) {
      if (block.type === 'text') {
        text.push(block.text);
        for (const c of block.citations ?? []) {
          if (c.type === 'web_search_result_location' && c.url) sources.set(c.url, c.title || c.url);
        }
      } else if (block.type === 'tool_use') {
        uses.push(block);
      }
    }

    if (response.stop_reason === 'pause_turn') {
      // A long server-tool turn: send it back and the server resumes it.
      conversation.push({ role: 'assistant', content: response.content });
      continue;
    }

    if (response.stop_reason === 'tool_use' && uses.length) {
      const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
      for (const use of uses) {
        const call = { name: use.name, input: use.input as Record<string, unknown> };
        calls.push(call);
        results.push({ type: 'tool_result', tool_use_id: use.id, content: await onToolCall(call) });
      }
      conversation.push({ role: 'assistant', content: response.content });
      conversation.push({ role: 'user', content: results });
      text.push('\n\n');
      continue;
    }

    break;
  }

  return { text: text.join('').replace(/\n{3,}/g, '\n\n').trim(), calls, sources, refused: false };
}

/** Maps SDK errors to the HTTP responses the app already understands. */
export function anthropicErrorResponse(err: unknown): { status: number; error: string } | null {
  if (err instanceof Anthropic.RateLimitError) {
    return { status: 429, error: 'The AI service is busy right now. Try again in a moment.' };
  }
  if (err instanceof Anthropic.APIError) {
    return { status: 502, error: `AI service error ${err.status ?? ''}: ${err.message}` };
  }
  return null;
}
