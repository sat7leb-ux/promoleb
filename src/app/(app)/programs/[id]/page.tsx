import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Radio, Tv } from 'lucide-react';
import { requireUser } from '@/lib/auth/session';
import { permissionsFor } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';
import { getProgramStats } from '@/lib/queries/stats';
import { getRequests } from '@/lib/queries/requests';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { RequestCard } from '@/components/requests/request-card';
import { percentage } from '@/lib/utils';
import type { Program } from '@/types/database';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from('programs').select('name').eq('id', id).maybeSingle();
  return { title: (data as { name: string } | null)?.name ?? 'Program' };
}

export default async function ProgramDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await requireUser();
  const permission = permissionsFor(session.role);

  const supabase = await createClient();

  const [programRes, channelRes, ownerRes, stats, requests] = await Promise.all([
    supabase.from('programs').select('*').eq('id', id).maybeSingle(),
    supabase.from('channels').select('id, name'),
    supabase.from('profiles').select('id, full_name'),
    getProgramStats(),
    getRequests({ programIds: [id], currentUserId: session.profile.id, pageSize: 24 }),
  ]);

  if (programRes.error || !programRes.data) notFound();

  const program = programRes.data as Program;
  const s = stats[id];

  const channels = channelRes.data ?? [];
  const profiles = ownerRes.data ?? [];
  const channelName = channels.find((c) => c.id === program.channel_id)?.name;
  const ownerName = profiles.find((p) => p.id === program.responsible_id)?.full_name;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/programs">
            <ArrowLeft className="size-4" />
            All programs
          </Link>
        </Button>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{program.name}</h1>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Radio className="size-3.5" aria-hidden />
              {channelName ?? 'No channel'}
              {ownerName && (
                <>
                  <span aria-hidden>·</span>
                  <span>{ownerName}</span>
                </>
              )}
            </p>
          </div>
          {permission.canCreateRequests && (
            <Button asChild size="sm">
              <Link href={`/requests/new?program=${program.id}`}>New request</Link>
            </Button>
          )}
        </div>

        {program.description && (
          <p className="max-w-2xl text-sm text-muted-foreground">{program.description}</p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Total requests" value={s?.totalRequests ?? 0} />
        <Stat label="Pending" value={s?.pendingRequests ?? 0} />
        <Stat label="In progress" value={s?.inProgressRequests ?? 0} />
        <Stat label="Completed" value={s?.completedRequests ?? 0} tone="emerald" />
        <Stat label="Total shifts" value={s?.totalShifts ?? 0} />
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
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Recent requests ({requests.total})</h2>
          <Button asChild variant="ghost" size="sm">
            <Link href={`/requests?program=${program.id}`}>See all</Link>
          </Button>
        </div>

        {requests.rows.length === 0 ? (
          <EmptyState
            icon={<Tv className="size-6" />}
            title="No requests for this program"
            description="Requests raised against this program will appear here."
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
  tone?: 'slate' | 'emerald';
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={
          'mt-1 text-2xl font-semibold tabular-nums ' +
          (tone === 'emerald' ? 'text-emerald-600' : '')
        }
      >
        {value}
      </p>
    </div>
  );
}