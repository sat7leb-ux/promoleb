import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground',
        secondary: 'bg-secondary text-secondary-foreground',
        outline: 'border border-border text-foreground',
        subtle: 'bg-muted text-muted-foreground',
      },
      size: {
        default: '',
        sm: 'px-1.5 py-0 text-[10px]',
      },
    },
    defaultVariants: { variant: 'subtle', size: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, size }), className)} {...props} />;
}

/**
 * Status pill with a leading dot.
 * `tone` takes the pre-composed class string from constants (e.g. PRIORITY_META)
 * so every status is rendered identically wherever it appears.
 */
export function StatusBadge({
  tone,
  label,
  dot = true,
  className,
}: {
  tone: string;
  label: string;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium',
        tone,
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden />}
      {label}
    </span>
  );
}

export { Badge, badgeVariants };