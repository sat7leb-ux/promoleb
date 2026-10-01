import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/lib/env';

/**
 * GET  -> 200 "ok"          (uptime probe)
 * POST -> runs the deadline sweep, creating due-soon / overdue notifications
 *
 * `run_deadline_sweep` is idempotent, so running it more often than necessary
 * is safe. Protected by a bearer token so the sweep cannot be triggered by
 * anyone who finds the URL: set `CRON_SECRET` in the environment to enable it.
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'sat7-promo',
    configured: env.isConfigured,
    timestamp: new Date().toISOString(),
  });
}

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return NextResponse.json(
      { ok: false, error: 'CRON_SECRET is not configured; the sweep endpoint is disabled.' },
      { status: 503 },
    );
  }

  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // A cron request carries no session, so there is no user for RLS to apply
    // to. `run_deadline_sweep` is SECURITY DEFINER and does its own work
    // against the tables directly, which is why this needs neither the service
    // role key nor a signed-in user. The bearer check above is the only gate.
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();

    const { data, error } = await supabase.rpc('run_deadline_sweep');
    if (error) throw error;

    return NextResponse.json({ ok: true, notificationsCreated: data ?? 0 });
  } catch (error) {
    console.error('[cron] deadline sweep failed:', error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}