import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type Tone = 'brand' | 'blue' | 'violet' | 'emerald' | 'rose' | 'amber' | 'cyan' | 'slate';

const TONES: Record<Tone, string> = {
  brand: 'bg-brand-50 text-brand-600 dark:bg-brand-950/50 dark:text-brand-300',
  blue: 'bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300',
  violet: 'bg-violet-50 text-violet-600 dark:bg-violet-950/50 dark:text-violet-300',
  emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300',
  rose: 'bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-300',
  amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300',
  cyan: 'bg-cyan-50 text-cyan-600 dark:bg-cyan-950/50 dark:text-cyan-300',
  slate: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
};

interface KpiCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  hint?: string;
  tone?: Tone;
  size?: 'default' | 'sm';
  href?: string;
  isLoading?: boolean;
}

/**
 * KPI tile. Values animate in so a dashboard refresh reads as a change rather
 * than a flash. `href` makes the whole card a link.
 */
export function KpiCard({
  label,
  value,
  icon: Icon,
  hint,
  tone = 'brand',
  size = 'default',
  href,
  isLoading,
}: KpiCardProps) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <span
          className={cn(
            'flex items-center justify-center rounded-lg',
            size === 'sm' ? 'size-7' : 'size-8',
            TONES[tone],
          )}
        >
          <Icon className={size === 'sm' ? 'size-3.5' : 'size-4'} aria-hidden />
        </span>
      </div>

      <p
        className={cn(
          'mt-2 font-semibold tabular-nums tracking-tight',
          size === 'sm' ? 'text-xl' : 'text-2xl',
        )}
      >
        {isLoading ? <Skeleton className="h-7 w-14" /> : value}
      </p>

      {hint && <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p>}
    </>
  );

  const className = cn(
    'block rounded-xl border bg-card p-4 text-left shadow-sm transition-shadow',
    href && 'hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
  );

  if (!href) {
    return (
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={className}>
        {body}
      </motion.div>
    );
  }

  return (
    <motion.a
      href={href}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={className}
    >
      {body}
    </motion.a>
  );
}