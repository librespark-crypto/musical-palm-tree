import { NextResponse } from 'next/server';
import { aiStatus } from '@/lib/ai/gemini';

export const dynamic = 'force-dynamic';

/**
 * Reports whether the AI coach is usable on this deployment.
 * Never returns the key itself - only whether one is present.
 */
export async function GET(): Promise<NextResponse> {
  const status = aiStatus();
  return NextResponse.json(status, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
