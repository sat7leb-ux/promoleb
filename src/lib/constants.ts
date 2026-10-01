import type { AppRole, DueState, PriorityLevel, ShiftStatus } from '@/types/database';

/**
 * Display metadata for enums and status colours.
 *
 * Colour values are Tailwind class fragments (no `bg-` prefix) so they can be
 * composed as `bg-${tone}-50 text-${tone}-700`. Anything loaded from the
 * database (stage.color, channel.color) is trusted only from the admin UI;
 * production data is written by staff, not end users.
 */

export interface ToneConfig {
  label: string;
  badge: string;
  dot: string;
}

export const PRIORITY_META: Record<PriorityLevel, ToneConfig & { weight: number }> = {
  urgent: {
    label: 'Urgent',
    weight: 4,
    badge: 'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900',
    dot: 'bg-rose-500',
  },
  high: {
    label: 'High',
    weight: 3,
    badge: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900',
    dot: 'bg-amber-500',
  },
  normal: {
    label: 'Normal',
    weight: 2,
    badge: 'bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700',
    dot: 'bg-slate-400',
  },
  low: {
    label: 'Low',
    weight: 1,
    badge: 'bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-900',
    dot: 'bg-sky-400',
  },
};

export const PRIORITY_ORDER: PriorityLevel[] = ['urgent', 'high', 'normal', 'low'];

export const SHIFT_STATUS_META: Record<ShiftStatus, ToneConfig> = {
  planned: {
    label: 'Planned',
    badge: 'bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200 dark:bg-slate-800 dark:text-slate-300',
    dot: 'bg-slate-400',
  },
  in_progress: {
    label: 'In Progress',
    badge: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300',
    dot: 'bg-amber-500',
  },
  done: {
    label: 'Done',
    badge: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300',
    dot: 'bg-emerald-500',
  },
  cancelled: {
    label: 'Cancelled',
    badge: 'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300',
    dot: 'bg-rose-500',
  },
};

export const DUE_STATE_META: Record<DueState, ToneConfig> = {
  on_track: {
    label: 'On Track',
    badge: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300',
    dot: 'bg-emerald-500',
  },
  due_soon: {
    label: 'Due Soon',
    badge: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300',
    dot: 'bg-amber-500',
  },
  overdue: {
    label: 'Overdue',
    badge: 'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300',
    dot: 'bg-rose-500',
  },
  completed: {
    label: 'Completed',
    badge: 'bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200 dark:bg-slate-800 dark:text-slate-400',
    dot: 'bg-slate-400',
  },
};

export const ROLE_META: Record<AppRole, ToneConfig> = {
  administrator: {
    label: 'Administrator',
    badge: 'bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200 dark:bg-brand-950/50 dark:text-brand-300 dark:ring-brand-900',
    dot: 'bg-brand-500',
  },
  promo_manager: {
    label: 'Promo Manager',
    badge: 'bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200 dark:bg-violet-950/40 dark:text-violet-300',
    dot: 'bg-violet-500',
  },
  producer: {
    label: 'Producer',
    badge: 'bg-cyan-50 text-cyan-700 ring-1 ring-inset ring-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300',
    dot: 'bg-cyan-500',
  },
  viewer: {
    label: 'Viewer',
    badge: 'bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200 dark:bg-slate-800 dark:text-slate-400',
    dot: 'bg-slate-400',
  },
};

export const STATUS_META: Record<string, ToneConfig> = {
  active: {
    label: 'Active',
    badge: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300',
    dot: 'bg-emerald-500',
  },
  inactive: {
    label: 'Inactive',
    badge: 'bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200 dark:bg-slate-800 dark:text-slate-400',
    dot: 'bg-slate-400',
  },
  archived: {
    label: 'Archived',
    badge: 'bg-slate-100 text-slate-500 ring-1 ring-inset ring-slate-200 dark:bg-slate-800/60 dark:text-slate-500',
    dot: 'bg-slate-300',
  },
};

/** Default stage colour used when a stage row has no explicit colour. */
export const STAGE_COLOR_FALLBACK = 'slate';

export const PAGE_SIZE = 25;

export const SORTABLE_REQUEST_COLUMNS = [
  'request_code',
  'title',
  'request_date',
  'due_date',
  'priority',
  'stage_position',
  'shift_count',
  'created_at',
] as const;

export type SortableRequestColumn = (typeof SORTABLE_REQUEST_COLUMNS)[number];

export const COMMON_RESPONSIBILITIES = [
  'Direction',
  'Camera',
  'Sound',
  'Lighting',
  'Graphics',
  'Editing',
  'Scripting',
  'Translation',
  'Logistics',
  'Studio Booking',
  'Location Scouting',
  'On-set Support',
] as const;

/**
 * Fallbacks for `public.settings`.
 *
 * Kept here rather than beside the settings action because a `'use server'`
 * module may only export async functions; a plain exported object from one of
 * those files is a build error, not a lint warning.
 *
 * Seeded to match migration 007; `due_soon_days` is the threshold behind the
 * due-soon badge and the deadline notification sweep.
 */
export const ORG_SETTINGS_DEFAULTS = {
  org_name: 'SAT-7 Promo',
  due_soon_days: 3,
  timezone: 'Asia/Beirut',
} as const;