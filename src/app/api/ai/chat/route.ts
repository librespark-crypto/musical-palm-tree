import { NextResponse } from 'next/server';
import { AiUnavailableError, aiStatus, callGemini } from '@/lib/ai/gemini';
import { buildCoachPrompt, type CoachMode } from '@/lib/ai/prompt';
import type { AiContext } from '@/lib/ai/context';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_BODY_BYTES = 220_000;
const MAX_QUESTION_CHARS = 4000;
const MODES: readonly CoachMode[] = ['chat', 'analyze', 'plan'];

interface ChatRequest {
  mode?: unknown;
  question?: unknown;
  history?: unknown;
  context?: unknown;
  nodeContext?: unknown;
}

function badRequest(code: string, message: string, status = 400): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status });
}

function parseHistory(value: unknown): { role: 'user' | 'model'; text: string }[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(-8)
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const record = entry as { role?: unknown; text?: unknown };
      const text = typeof record.text === 'string' ? record.text.slice(0, MAX_QUESTION_CHARS) : '';
      if (!text) return null;
      return { role: record.role === 'model' ? ('model' as const) : ('user' as const), text };
    })
    .filter((entry): entry is { role: 'user' | 'model'; text: string } => entry !== null);
}

export async function POST(request: Request): Promise<NextResponse> {
  const status = aiStatus();
  if (!status.available) {
    return NextResponse.json(
      {
        error: {
          code: status.reason === 'disabled' ? 'disabled' : 'no-key',
          message:
            status.reason === 'disabled'
              ? 'AI features are disabled on this deployment.'
              : 'No GEMINI_API_KEY is configured on the server. The rule-based coach is available in the app.',
        },
      },
      { status: 503 },
    );
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return badRequest('invalid', 'The request payload is too large.', 413);
  }

  let body: ChatRequest;
  try {
    body = JSON.parse(raw) as ChatRequest;
  } catch {
    return badRequest('invalid', 'The request body must be JSON.');
  }

  const mode = MODES.includes(body.mode as CoachMode) ? (body.mode as CoachMode) : 'chat';
  const question = typeof body.question === 'string' ? body.question.trim().slice(0, MAX_QUESTION_CHARS) : '';
  if (!question) return badRequest('invalid', 'A question is required.');

  const context = body.context;
  if (!context || typeof context !== 'object') {
    return badRequest('invalid', 'The tracker context is required so answers stay grounded in your data.');
  }

  const nodeContext = typeof body.nodeContext === 'string' ? body.nodeContext.slice(0, 4000) : null;

  try {
    const prompt = buildCoachPrompt({
      mode,
      question,
      history: parseHistory(body.history),
      context: context as AiContext,
      nodeContext,
    });
    const text = await callGemini({
      system: prompt.system,
      contents: prompt.contents,
      temperature: mode === 'analyze' ? 0.25 : 0.4,
      maxOutputTokens: mode === 'analyze' ? 2600 : 2048,
    });
    return NextResponse.json(
      { text, model: status.model, mode },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    if (error instanceof AiUnavailableError) {
      const httpStatus = error.code === 'no-key' || error.code === 'disabled' ? 503 : 502;
      return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: httpStatus });
    }
    return NextResponse.json(
      { error: { code: 'api', message: error instanceof Error ? error.message : 'The AI request failed.' } },
      { status: 502 },
    );
  }
}
