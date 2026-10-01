import { cn } from '@/lib/utils';

/**
 * SAT-7 Promo mark: a broadcast aperture built from three arcs around a play
 * triangle. Inline SVG so it inherits currentColor and needs no asset pipeline.
 */
export function Logo({ className, title = 'SAT-7 Promo' }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('size-8', className)}
      role="img"
      aria-label={title}
    >
      <rect width="40" height="40" rx="10" className="fill-brand-950" />
      <path
        d="M20 6a14 14 0 0 1 12.12 7M34 20a14 14 0 0 1-7 12.12M20 34A14 14 0 0 1 12.88 13M6 20a14 14 0 0 1 7-12.12"
        className="stroke-brand-400"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path d="M17 14.5v11l9-5.5-9-5.5Z" className="fill-gold-400" />
    </svg>
  );
}

/** Wordmark lockup for the login screen. */
export function LogoLockup({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <Logo className="size-11" />
      <div>
        <p className="text-lg font-semibold leading-tight tracking-tight">SAT-7 Promo</p>
        <p className="text-xs leading-tight text-muted-foreground">Promo Operations</p>
      </div>
    </div>
  );
}