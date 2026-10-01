'use client';

import {
  ArrowRight,
  CheckCircle2,
  FilePlus2,
  History,
  Paperclip,
  Pencil,
  PlusCircle,
  Trash2,
  UserMinus,
  UserPlus,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn, formatDateTime, formatRelative, initials } from '@/lib/utils';
import type { ActivityLog } from '@/types/database';

type Icon = React.ComponentType<{ className?: string }>;

/** Maps an activity action to its icon and accent colour. */
const ACTION_META: Record<string, { icon: Icon; tone: string }> = {
  request_created: {
    icon: FilePlus2,
    tone: 'bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-200',
  },
  request_updated: {
    icon: Pencil,
    tone: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  },
  request_archived: {
    icon: Trash2,
    tone: 'bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300',
  },
  request_duplicated: {
    icon: FilePlus2,
    tone: 'bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-200',
  },
  status_changed: {
    icon: ArrowRight,
    tone: 'bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-200',
  },
  assignee_changed: {
    icon: UserPlus,
    tone: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-200',
  },
  participant_added: {
    icon: UserPlus,
    tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200',
  },
  participant_removed: {
    icon: UserMinus,
    tone: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200',
  },
  shift_created: {
    icon: PlusCircle,
    tone: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-200',
  },
  shift_updated: {
    icon: Pencil,
    tone: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  },
  shift_deleted: {
    icon: Trash2,
    tone: 'bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300',
  },
  note_added: {
    icon: Pencil,
    tone: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200',
  },
  attachment_uploaded: {
    icon: Paperclip,
    tone: 'bg-lime-100 text-lime-700 dark:bg-lime-900 dark:text-lime-200',
  },
  attachment_deleted: {
    icon: Trash2,
    tone: 'bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300',
  },
  program_created: {
    icon: PlusCircle,
    tone: 'bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-200',
  },
  program_updated: {
    icon: Pencil,
    tone: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  },
  project_created: {
    icon: PlusCircle,
    tone: 'bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-200',
  },
  project_updated: {
    icon: Pencil,
    tone: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  },
  user_created: {
    icon: UserPlus,
    tone: 'bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-200',
  },
  user_updated: {
    icon: Pencil,
    tone: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  },
  settings_updated: {
    icon: History,
    tone: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  },
};

/**
 * Audit trail for a request, or for the whole system.
 *
 * A vertical timeline reads more naturally than a table for a sequence of
 * changes, and pairs each entry with its actor and exact timestamp.
 */
export function ActivityTimeline({ entries }: { entries: ActivityLog[] }) {
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center">
        <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <History className="size-5" aria-hidden />
        </span>
        <p className="text-sm font-medium">No history yet</p>
        <p className="max-w-xs text-xs text-muted-foreground">
          Every change will be recorded here with who made it and when.
        </p>
      </div>
    );
  }

  return (
    <ol className="relative space-y-4">
      {/* Connecting rail behind the markers. */}
      <span className="absolute bottom-2 left-[15px] top-2 w-px bg-border" aria-hidden />

      {entries.map((entry, index) => {
        const meta = ACTION_META[entry.action] ?? {
          icon: CheckCircle2,
          tone: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
        };
        const Marker = meta.icon;

        return (
          <motion.li
            key={entry.id}
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: Math.min(index * 0.03, 0.3) }}
            className="relative flex gap-3"
          >
            <span
              className={cn(
                'relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full ring-4 ring-card',
                meta.tone,
              )}
            >
              <Marker className="size-4" aria-hidden />
            </span>

            <div className="min-w-0 flex-1 pt-1">
              <p className="text-sm">{entry.summary}</p>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Avatar className="size-4">
                    <AvatarFallback className="bg-muted text-[8px] font-semibold">
                      {initials(entry.actor_name)}
                    </AvatarFallback>
                  </Avatar>
                  {entry.actor_name ?? 'System'}
                </span>
                <span aria-hidden>·</span>
                <time dateTime={entry.created_at} title={formatDateTime(entry.created_at)}>
                  {formatRelative(entry.created_at)}
                </time>
              </div>
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
}