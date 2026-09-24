/**
 * Server-side Gemini transport.
 *
 * The API key lives ONLY in the server environment (`GEMINI_API_KEY`). Nothing
 * in this module is importable from a client component: routes call it, the
 * browser never sees the key, and the client always has a working fallback.
 */
import { JEE_SYSTEM_PROMPT } from '@/lib/ai/prompt';

export interface GeminiContent {
  role: 'user' | 'model';
  parts: { text: string }[];
}

export interface GeminiCallInput {
  system?: string;
  contents: GeminiContent[];
  temperature?: number;
  maxOutputTokens?: number;
  expectJson?: boolean;
}

export class AiUnavailableError extends Error {
  readonly code: 'no-key' | 'disabled' | 'network' | 'api' | 'empty';

  constructor(code: AiUnavailableError['code'], message: string) {
    super(message);
    this.name = 'AiUnavailableError';
    this.code = code;
  }
}

export const DEFAULT_MODEL = 'gemini-2.5-flash';
export const SUPPORTED_MODELS = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-flash-latest'];

export function aiEnabled(): boolean {
  return process.env.AI_ENABLED !== 'false';
}

export function apiKeyConfigured(): boolean {
  return Boolean((process.env.GEMINI_API_KEY ?? '').trim());
}

export function configuredModel(): string {
  const model = (process.env.GEMINI_MODEL ?? DEFAULT_MODEL).trim();
  return model || DEFAULT_MODEL;
}

export function aiStatus(): { available: boolean; model: string; reason?: string } {
  if (!aiEnabled()) return { available: false, model: configuredModel(), reason: 'disabled' };
  if (!apiKeyConfigured()) return { available: false, model: configuredModel(), reason: 'no-key' };
  return { available: true, model: configuredModel() };
}

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

export async function callGemini(input: GeminiCallInput): Promise<string> {
  if (!aiEnabled()) {
    throw new AiUnavailableError('disabled', 'AI features are disabled on this deployment (AI_ENABLED=false).');
  }
  const key = (process.env.GEMINI_API_KEY ?? '').trim();
  if (!key) {
    throw new AiUnavailableError('no-key', 'No GEMINI_API_KEY is configured on the server.');
  }
  const model = configuredModel();
  const body: Record<string, unknown> = {
    systemInstruction: { parts: [{ text: input.system ?? JEE_SYSTEM_PROMPT }] },
    contents: input.contents,
    generationConfig: {
      temperature: input.temperature ?? 0.35,
      maxOutputTokens: input.maxOutputTokens ?? 2048,
      topP: 0.95,
      ...(input.expectJson ? { responseMimeType: 'application/json' } : {}),
    },
  };

  let response: Response;
  try {
    response = await fetch(`${ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
  } catch (error) {
    throw new AiUnavailableError('network', error instanceof Error ? error.message : 'Could not reach the Gemini API.');
  }

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'error' in payload
        ? String((payload as { error?: { message?: string } }).error?.message ?? `HTTP ${response.status}`)
        : `HTTP ${response.status}`;
    throw new AiUnavailableError('api', message);
  }

  const text = extractText(payload);
  if (!text) throw new AiUnavailableError('empty', 'The model returned an empty response.');
  return text;
}

function extractText(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const candidates = (payload as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates) || !candidates.length) return '';
  const first = candidates[0] as { content?: { parts?: { text?: string }[] } };
  const parts = first.content?.parts ?? [];
  return parts
    .map((part) => part.text ?? '')
    .join('')
    .trim();
}

/** Lightweight connectivity + configuration probe. */
export async function testConnection(): Promise<{ ok: boolean; model: string; message: string }> {
  const model = configuredModel();
  try {
    const text = await callGemini({
      system: 'Reply with the single word: READY',
      contents: [{ role: 'user', parts: [{ text: 'Connection test.' }] }],
      maxOutputTokens: 16,
      temperature: 0,
    });
    return { ok: true, model, message: text || 'READY' };
  } catch (error) {
    return { ok: false, model, message: error instanceof Error ? error.message : 'Unknown error' };
  }
}
