import { NextRequest, NextResponse } from 'next/server';
import { runMaintenance } from '@/lib/maintenance';

/**
 * GET /api/cron/offer-extensions
 * Trigger system maintenance tasks.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const result = await runMaintenance();
  return NextResponse.json(result);
}
