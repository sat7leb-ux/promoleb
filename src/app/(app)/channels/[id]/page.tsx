import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Layers } from 'lucide-react';
import { requireUser } from '@/lib/auth/session';
import { permissionsFor } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';
import { getChannelStats } from '@/lib/queries/stats';
import { getRequests } from '@/lib/queries/requests';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { RequestCard } from '@/components/requests/request-card';
import { percentage } from '@/lib/utils';
import type { Channel } from '@/types/database';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from('channels').select('name').eq('id', id).maybeSingle();
  return { title: (data as { name: string } | null)?.name ?? 'Channel' };
}

export default async function ChannelDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await requireUser();
  const permission = permissionsFor(session.role);

  const supabase = await createClient();

  const [channelRes, programsRes, stats, requests] = await Promise.all([
    supabase.from('channels').select('*').eq('id', id).maybeSingle(),
    supabase.from('programs').select('id, name, status').eq('channel_id', id).order('name'),
    getChannelStats(),
    getRequests({ channelIds: [id], currentUserId: session.profile.id, pageSize: 24 }),
  ]);

  if (channelRes.error || !channelRes.data) notFound();

  const channel = channelRes.data as Channel;
  const s = stats[id];
  const programs = (programsRes.data ?? []) as Array<{
    id: string;
    name: string;
    status: string;
  }>;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/channels">
            <ArrowLeft className="size-4" />
            All channels
          </Link>
        </Button>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{channel.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {[channel.code, channel.category].filter(Boolean).join(' · ') || 'Channel'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/reports/channels?channel=${channel.id}`}>Channel report</Link>
            </Button>
            {permission.canCreateRequests && (
              <Button asChild size="sm">
                <Link href={`/requests/new?channel=${channel.id}`}>New request</Link>
              </Button>
            )}
          </div>
        </div>

        {channel.description && (
          <p className="max-w-2xl text-sm text-muted-foreground">{channel.description}</p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Total requests" value={s?.totalRequests ?? 0} />
        <Stat label="Active" value={s?.activeRequests ?? 0} />
        <Stat label="Completed" value={s?.completedRequests ?? 0} tone="emerald" />
        <Stat label="Total shifts" value={s?.totalShifts ?? 0} />
        <Stat
          label="Overdue"
          value={s?.overdueRequests ?? 0}
          tone={s && s.overdueRequests > 0 ? 'rose' : 'slate'}
        />
      </div>

      {s && s.totalRequests > 0 && (
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Completion rate</span>
            <span className="tabular-nums font-semibold">
              {percentage(s.completedRequests, s.totalRequests)}%
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{
                width: `${Math.max(percentage(s.completedRequests, s.totalRequests), 2)}%`,
              }}
            />
          </div>
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Programs on this channel ({programs.length})</h2>

        {programs.length === 0 ? (
          <EmptyState
            icon={<Layers className="size-6" />}
            title="No programs on this channel"
            description="Programs link a channel to the shows it carries, and make promo requests reportable."
            className="border"
          />
        ) : (
          <div className="flex flex-wrap gap-2">
            {programs.map((program) => (
              <Link
                key={program.id}
                href={`/programs/${program.id}`}
                className="rounded-full border bg-card px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {program.name}
                {program.status !== 'active' && (
                  <span className="ml-1.5 text-muted-foreground">({program.status})</span>
                )}
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Recent requests ({requests.total})</h2>
          <Button asChild variant="ghost" size="sm">
            <Link href={`/requests?channel=${channel.id}`}>See all</Link>
          </Button>
        </div>

        {requests.rows.length === 0 ? (
          <EmptyState
            icon={<Layers className="size-6" />}
            title="No requests for this channel"
            description="Requests raised against this channel will appear here."
            className="border"
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {requests.rows.map((request, index) => (
              <RequestCard key={request.id} request={request} index={index} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = 'slate',
}: {
  label: string;
  value: number;
  tone?: 'slate' | 'emerald' | 'rose';
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={
          'mt-1 text-2xl font-semibold tabular-nums ' +
          (tone === 'emerald' ? 'text-emerald-600' : tone === 'rose' ? 'text-rose-600' : '')
        }
      >
        {value}
      </p>
    </div>
  );
}