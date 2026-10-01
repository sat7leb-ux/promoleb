import * as React from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from './skeleton';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

/**
 * Standard empty state. Every list and board in the app uses this so an empty
 * result always explains itself instead of showing a blank panel.
 */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-6 py-14 text-center',
        className,
      )}
    >
      {icon && (
        <div
          className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground [&_svg]:size-6"
          aria-hidden
        >
          {icon}
        </div>
      )}
      <div className="space-y-1.5">
        <p className="text-base font-semibold">{title}</p>
        {description && (
          <p className="mx-auto max-w-md text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/** Error state with a retry affordance. */
export function ErrorState({
  title = 'We could not load this',
  description = 'Something went wrong while loading the data. Please try again.',
  onRetry,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <EmptyState
      className={className}
      title={title}
      description={description}
      action={
        onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Try again
          </button>
        ) : undefined
      }
    />
  );
}

/** Card grid skeleton used while a card grid loads. */
export function SkeletonGrid({ count = 6, className }: { count?: number; className?: string }) {
  return (
    <div className={cn('grid gap-4 sm:grid-cols-2 xl:grid-cols-3', className)} aria-busy>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-3 rounded-xl border bg-card p-5">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}