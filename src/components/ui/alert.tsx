import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

const alertVariants = cva(
  'relative flex w-full gap-3 rounded-lg border p-4 text-sm [&>svg]:size-5 [&>svg]:shrink-0 [&>svg]:translate-y-0.5',
  {
    variants: {
      variant: {
        info: 'border-brand-200 bg-brand-50 text-brand-900 dark:border-brand-900 dark:bg-brand-950/40 dark:text-brand-100',
        success:
          'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100',
        warning:
          'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100',
        error:
          'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100',
      },
    },
    defaultVariants: { variant: 'info' },
  },
);

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  /** Overrides the default icon for the chosen variant. */
  icon?: React.ReactNode;
}

const ALERT_ICONS: Record<NonNullable<AlertProps['variant']>, React.ReactNode> = {
  info: <Info />,
  success: <CheckCircle2 />,
  warning: <TriangleAlert />,
  error: <AlertCircle />,
};

export function Alert({ className, variant = 'info', icon, children, ...props }: AlertProps) {
  return (
    <div role="alert" className={cn(alertVariants({ variant }), className)} {...props}>
      {icon ?? ALERT_ICONS[variant ?? 'info']}
      <div className="min-w-0 flex-1 space-y-1">{children}</div>
    </div>
  );
}

export function AlertTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h5 className={cn('font-semibold leading-none tracking-tight', className)} {...props} />;
}

export function AlertDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm leading-relaxed [&_p]:leading-relaxed', className)} {...props} />;
}

/**
 * Friendly rendering of any thrown value. Never shows a stack trace or raw
 * database message to a normal user.
 */
export function ErrorMessage({
  error,
  fallback = 'Something went wrong. Please try again.',
  className,
}: {
  error: unknown;
  fallback?: string;
  className?: string;
}) {
  const message = extractUserMessage(error);
  return (
    <Alert variant="error" className={className}>
      <AlertTitle>Something went wrong</AlertTitle>
      <AlertDescription>{message ?? fallback}</AlertDescription>
    </Alert>
  );
}

/**
 * Maps technical errors to something a non-technical staff member can act on.
 * Supabase/PostgREST messages are matched to friendly text; anything
 * unrecognised falls back to a generic message.
 */
export function extractUserMessage(error: unknown): string | null {
  if (!error) return null;
  if (typeof error === 'string') return error;

  const raw =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && 'message' in error
        ? String((error as { message: unknown }).message)
        : null;

  if (!raw) return null;

  if (/failed to fetch|networkerror|network request failed/i.test(raw)) {
    return 'We could not reach the server. Check your connection and try again.';
  }
  if (/jwt|token|not authenticated|invalid.*session/i.test(raw)) {
    return 'Your session has expired. Please sign in again.';
  }
  if (/permission denied|row-level security|rls/i.test(raw)) {
    return 'You do not have permission to do that. Contact an administrator if you believe this is a mistake.';
  }
  if (/duplicate key|already exists/i.test(raw)) {
    return 'A record with those details already exists.';
  }
  if (/violates foreign key|violates check constraint/i.test(raw)) {
    return 'That change would break a linked record. Check the related items.';
  }
  if (/storage|upload/i.test(raw)) {
    return 'The file could not be uploaded. Check the file size and try again.';
  }
  if (/supabase.*url|missing required environment/i.test(raw)) {
    return 'The application is not configured correctly. Contact your administrator.';
  }

  // Unknown: do not leak internals.
  return null;
}