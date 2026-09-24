import { NextResponse } from 'next/server';
import { testConnection } from '@/lib/ai/gemini';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/** "Test connection" button in Settings. Never exposes the key. */
export async function POST(): Promise<NextResponse> {
  const result = await testConnection();
  return NextResponse.json(result, { status: result.ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } });
}
