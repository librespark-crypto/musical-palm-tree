/**
 * Client-side AI helper.
 *
 * The browser NEVER talks to Gemini directly and never holds a key: it posts to
 * our own route handler, which reads the server environment. Every call returns
 * a typed result instead of throwing, so the UI can fall back to the
 * deterministic rule-based coach when the network or the API is unavailable.
 */
import type { AiContext } from '@/lib/ai/context';

export type CoachMode = 'chat' | 'analyze' | 'plan';

export interface CoachTextResult {
  ok: true;
  text: string;
  model: string;
  source: 'gemini' | 'rules';
}

export interface CoachErrorResult {
  ok: false;
  code: 'no-key' | 'disabled' | 'network' | 'api' | 'empty' | 'offline' | 'invalid';
  message: string;
  fallbackUsed?: boolean;
}

export type CoachResult = CoachTextResult | CoachErrorResult;

export interface AiStatus {
  available: boolean;
  model: string;
  reason?: string;
}

const STATUS_TIMEOUT_MS = 8000;
const CHAT_TIMEOUT_MS = 60000;

async function postJson<T>(url: string, body: unknown, timeoutMs: number): Promise<{ ok: true; data: T } | { ok: false; code: CoachErrorResult['code']; message: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const record = (payload ?? {}) as { error?: { code?: string; message?: string } };
      const code = (record.error?.code as CoachErrorResult['code']) ?? 'api';
      return { ok: false, code, message: record.error?.message ?? `Request failed (${response.status}).` };
    }
    return { ok: true, data: payload as T };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { ok: false, code: 'network', message: 'The AI request timed out.' };
    }
    return {
      ok: false,
      code: typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'network',
      message: error instanceof Error ? error.message : 'Network error',
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchAiStatus(): Promise<AiStatus> {
  try {
    const response = await fetch('/api/ai/status', { cache: 'no-store' });
    if (!response.ok) return { available: false, model: '', reason: `http-${response.status}` };
    const payload = (await response.json()) as AiStatus;
    return payload;
  } catch {
    return { available: false, model: '', reason: 'offline' };
  }
}

export interface AskCoachInput {
  mode: CoachMode;
  question: string;
  history?: { role: 'user' | 'model'; text: string }[];
  context: AiContext;
  nodeContext?: string | null;
}

export async function askCoach(input: AskCoachInput): Promise<CoachResult> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { ok: false, code: 'offline', message: 'You are offline - using the built-in rule-based coach.' };
  }
  const result = await postJson<{ text: string; model: string }>(
    '/api/ai/chat',
    {
      mode: input.mode,
      question: input.question,
      history: (input.history ?? []).slice(-8),
      context: input.context,
      nodeContext: input.nodeContext ?? null,
    },
    CHAT_TIMEOUT_MS,
  );
  if (!result.ok) return { ok: false, code: result.code, message: result.message };
  return { ok: true, text: result.data.text, model: result.data.model, source: 'gemini' };
}

export async function testAiConnection(): Promise<{ ok: boolean; model: string; message: string }> {
  const result = await postJson<{ ok: boolean; model: string; message: string }>('/api/ai/test', {}, STATUS_TIMEOUT_MS + 20000);
  if (!result.ok) return { ok: false, model: '', message: result.message };
  return result.data;
}

export const AI_ERROR_COPY: Record<CoachErrorResult['code'], string> = {
  'no-key': 'No server-side Gemini key is configured. The rule-based coach below uses your stored data only.',
  disabled: 'AI features are switched off on this deployment. The rule-based coach below is fully available.',
  network: 'The AI service could not be reached. Check your connection - your tracker keeps working offline.',
  api: 'Gemini returned an error. The rule-based coach below is available in the meantime.',
  empty: 'Gemini returned an empty answer. Try rephrasing the question.',
  offline: 'You are offline. The rule-based coach below uses your stored data only.',
  invalid: 'That request was rejected by the server. Try a shorter question.',
};
