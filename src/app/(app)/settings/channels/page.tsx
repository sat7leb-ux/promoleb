import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requireUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { ChannelsView } from '@/components/channels/channels-view';
import { getChannelStats } from '@/lib/queries/stats';
import type { Channel } from '@/types/database';

export const metadata: Metadata = { title: 'Manage channels' };

/**
 * Settings view of channels.
 *
 * The channels list already does everything reference-data management needs —
 * add, edit, archive. This page reuses it with management forced on rather than
 * duplicating that UI, and links back so the two routes do not drift apart.
 */
export default async function SettingsChannelsPage() {
  await requireUser();
  const supabase = await createClient();

  const [channelsRes, stats] = await Promise.all([
    supabase.from('channels').select('*').order('sort_order').order('name'),
    getChannelStats(),
  ]);

  if (channelsRes.error) {
    console.error('[settings/channels] read failed:', channelsRes.error.message);
  }

  return (
    <section className="space-y-4">
      <div>
        <Link
          href="/channels"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          View channels with request counts
        </Link>
      </div>

      <ChannelsView
        channels={(channelsRes.data ?? []) as Channel[]}
        stats={stats}
        canManage
      />
    </section>
  );
}