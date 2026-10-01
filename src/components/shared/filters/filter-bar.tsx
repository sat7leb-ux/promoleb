'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * Debounced search input that writes to the URL.
 *
 * Putting the term in the query string means a search is shareable, survives a
 * refresh, and keeps the server component in charge of the actual query.
 */
export function SearchInput({
  placeholder = 'Search…',
  paramName = 'q',
  className,
  minChars = 2,
}: {
  placeholder?: string;
  paramName?: string;
  className?: string;
  minChars?: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlTerm = searchParams.get(paramName) ?? '';

  const [value, setValue] = useState(urlTerm);
  const [focused, setFocused] = useState(false);
  const isFirstRender = useRef(true);

  // Keep local state in step when the URL changes from outside (back button,
  // clicking "clear all", navigating from another page).
  useEffect(() => {
    setValue(urlTerm);
  }, [urlTerm]);

  useEffect(() => {
    // Don't fire a navigation on mount; that would clobber other params.
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (value === urlTerm) return;
    if (value.length > 0 && value.trim().length < minChars) return;

    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (value.trim()) params.set(paramName, value.trim());
      else params.delete(paramName);
      params.delete('page');
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }, 350);

    return () => clearTimeout(timer);
  }, [value, urlTerm, paramName, pathname, router, searchParams, minChars]);

  return (
    <div className={cn('relative', className)}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="pl-9 pr-9"
      />
      {value && (
        <button
          type="button"
          onClick={() => setValue('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Clear search"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
      {focused && value.length > 0 && value.trim().length < minChars && (
        <p className="absolute left-0 top-full mt-1 text-xs text-muted-foreground">
          Type at least {minChars} characters
        </p>
      )}
    </div>
  );
}

/** "Clear all filters" pill. Renders nothing when no filter is active. */
export function ClearFiltersButton({ activeParamNames }: { activeParamNames: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const active = activeParamNames.filter((name) => searchParams.get(name));
  if (active.length === 0) return null;

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => {
        const params = new URLSearchParams();
        // Preserve navigation-ish params that are not filters.
        for (const key of ['page', 'sort', 'dir', 'view']) {
          const v = searchParams.get(key);
          if (v) params.set(key, v);
        }
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      }}
      className="text-muted-foreground"
    >
      <X className="h-3.5 w-3.5" />
      Clear {active.length} filter{active.length === 1 ? '' : 's'}
    </Button>
  );
}

/** Shows active filter chips so users can see why a list is short. */
export function ActiveFilterChips({
  items,
  className,
}: {
  items: Array<{ label: string; paramName: string }>;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  if (items.length === 0) return null;

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {items.map((item) => (
        <Badge key={item.paramName} variant="outline" className="gap-1 py-1">
          {item.label}
          <button
            type="button"
            onClick={() => {
              const params = new URLSearchParams(searchParams.toString());
              params.delete(item.paramName);
              params.delete('page');
              router.replace(`${pathname}?${params.toString()}`, { scroll: false });
            }}
            className="ml-0.5 rounded-full p-0.5 hover:bg-muted"
            aria-label={`Remove filter ${item.label}`}
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
    </div>
  );
}