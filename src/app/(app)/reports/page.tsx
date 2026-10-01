import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BarChart3, CalendarRange, Layers, Target, Tv, Users } from 'lucide-react';
import { requireUser } from '@/lib/auth/session';
import { permissionsFor } from '@/lib/auth/permissions';
import { Card } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Reports' };

const REPORTS = [
  {
    href: '/reports/requests',
    label: 'Request report',
    description: 'Every request grouped by stage, priority and deadline state.',
    icon: BarChart3,
  },
  {
    href: '/reports/channels',
    label: 'Channel report',
    description: 'Volume and shift totals per broadcast, digital and live outlet.',
    icon: Layers,
  },
  {
    href: '/reports/programs',
    label: 'Program report',
    description: 'The same breakdown per show, so you can compare like with like.',
    icon: Tv,
  },
  {
    href: '/reports/projects',
    label: 'Project report',
    description: 'Campaign progress, completion rates and team workload.',
    icon: CalendarRange,
  },
  {
    href: '/reports/users',
    label: 'User workload',
    description: 'Who is carrying what, by assigned requests and shifts.',
    icon: Users,
  },
  {
    href: '/reports/shifts',
    label: 'Shift report',
    description: 'Production days by channel and program, including completed shifts.',
    icon: Target,
  },
];

/**
 * Reports index.
 *
 * The sidebar points here, so rather than bouncing visitors straight to one
 * arbitrary report this page explains what each grouping answers — the choice
 * between them is not obvious from the names alone.
 */
export default async function ReportsPage() {
  const session = await requireUser();

  if (!permissionsFor(session.role).canViewReports) {
    return (
      <p className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
        You do not have permission to view reports.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every report shares the same filters and exports — CSV, Excel, or print. Pick the
          grouping that answers your question.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {REPORTS.map((report) => {
          const Icon = report.icon;

          return (
            <Link key={report.href} href={report.href} className="group focus-visible:outline-none">
              <Card className="h-full p-4 shadow-sm transition-colors group-hover:border-primary/40 group-focus-visible:ring-2 group-focus-visible:ring-ring">
                <div className="flex items-start justify-between gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <ArrowRight
                    className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </div>

                <h2 className="mt-3 text-sm font-semibold">{report.label}</h2>
                <p className="mt-1 text-xs text-muted-foreground">{report.description}</p>
              </Card>
            </Link>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        Reports reflect the current access level: you only ever see requests you are allowed to
        see, and the totals match the lists you can open.
      </p>
    </div>
  );
}