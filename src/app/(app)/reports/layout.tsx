import Link from 'next/link';
import type { Metadata } from 'next';
import { BarChart3, Layers, Users, CalendarRange } from 'lucide-react';
import { requireUser } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Reports' };

const REPORTS = [
  { href: '/reports/requests', label: 'Request report', icon: BarChart3 },
  { href: '/reports/channels', label: 'Channel report', icon: Layers },
  { href: '/reports/programs', label: 'Program report', icon: BarChart3 },
  { href: '/reports/projects', label: 'Project report', icon: CalendarRange },
  { href: '/reports/users', label: 'User report', icon: Users },
  { href: '/reports/shifts', label: 'Shift report', icon: CalendarRange },
];

/**
 * Reports shell.
 *
 * Every report is the same table over a different grouping, so this only lays
 * out the navigation; the grouping itself lives in each page.
 */
export default async function ReportsLayout({ children }: { children: React.ReactNode }) {
  await requireUser();

  return (
    <div className="space-y-6">
      <nav aria-label="Reports" className="no-scrollbar -mx-1 overflow-x-auto px-1">
        <ul className="flex w-max gap-2 pb-1">
          {REPORTS.map((report) => (
            <li key={report.href}>
              <Link
                href={report.href}
                className="flex items-center gap-2 rounded-full border bg-card px-3.5 py-2 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <report.icon className="size-4 text-muted-foreground" aria-hidden />
                {report.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {children}
    </div>
  );
}