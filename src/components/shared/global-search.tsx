'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CalendarDays,
  CornerDownLeft,
  Loader2,
  Search,
  Tv,
  Layers,
  FolderKanban,
  Target,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ResultItem {
  type: 'request' | 'program' | 'channel' | 'project' | 'goal';
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

const TYPE_ICON: Record<ResultItem['type'], React.ComponentType<{ className?: string }>> = {
  request: Search,
  program: Tv,
  channel: Layers,
  project: FolderKanban,
  goal: Target,
};

/**
 * Global search (Cmd/Ctrl+K).
 *
 * Queries Postgres directly through PostgREST with ilike, which is backed by the
 * trigram indexes created in migration 002. Results are debounced and the
 * request is aborted when a newer keystroke arrives, so fast typing does not
 * queue up stale queries.
 */
export function GlobalSearch({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<ResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const search = useCallback(async (query: string, signal: AbortSignal) => {
    // Imported lazily so the search dialog's initial bundle does not include
    // the Supabase client; it is only needed once the dialog is opened.
    const { createBrowserClient } = await import('@/lib/supabase/client');
    const supabase = createBrowserClient();
    const like = `%${query}%`;

    const [requests, programs, channels, projects, goals] = await Promise.all([
      supabase
        .from('promo_requests')
        .select('id, title, request_code, stage_name, channel:channels(name)')
        .or(`title.ilike.${like},request_code.ilike.${like}`)
        .eq('status', 'active')
        .limit(6),
      supabase.from('programs').select('id, name, description').ilike('name', like).limit(4),
      supabase.from('channels').select('id, name, category').ilike('name', like).limit(4),
      supabase.from('projects').select('id, name, code, status').ilike('name', like).limit(4),
      supabase.from('promo_goals').select('id, name, category').ilike('name', like).limit(4),
    ]);

    if (signal.aborted) return;

    const items: ResultItem[] = [
      ...(requests.data ?? []).map((r) => ({
        type: 'request' as const,
        id: r.id,
        title: r.title,
        subtitle: `${r.request_code ?? '—'} · ${r.stage_name}${r.channel ? ` · ${r.channel.name}` : ''}`,
        href: `/requests/${r.id}`,
      })),
      ...(programs.data ?? []).map((p) => ({
        type: 'program' as const,
        id: p.id,
        title: p.name,
        subtitle: 'Program',
        href: `/programs/${p.id}`,
      })),
      ...(channels.data ?? []).map((c) => ({
        type: 'channel' as const,
        id: c.id,
        title: c.name,
        subtitle: c.category ?? 'Channel',
        href: `/channels/${c.id}`,
      })),
      ...(projects.data ?? []).map((p) => ({
        type: 'project' as const,
        id: p.id,
        title: p.name,
        subtitle: `${p.code ?? 'Project'}${p.status !== 'active' ? ` · ${p.status}` : ''}`,
        href: `/projects/${p.id}`,
      })),
      ...(goals.data ?? []).map((g) => ({
        type: 'goal' as const,
        id: g.id,
        title: g.name,
        subtitle: g.category ?? 'Goal',
        href: `/requests?goal=' + g.id}`,
      })),
    ];

    setResults(items);
  }, []);

  useEffect(() => {
    if (!open) {
      setTerm('');
      setResults([]);
      setActiveIndex(0);
      return;
    }
  }, [open]);

  useEffect(() => {
    const query = term.trim();
    if (query.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;

    const timer = setTimeout(async () => {
      try {
        await search(query, controller.signal);
      } catch (err) {
        if (!controller.signal.aborted) {
          console.error('[global-search] failed:', err);
          setResults([]);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [term, search]);

  // Keep the highlighted row in view while arrowing through results.
  useEffect(() => {
    const el = listRef.current?.children[activeIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  function goTo(item: ResultItem) {
    onOpenChange(false);
    router.push(item.href);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" className="top-[12%] translate-y-0 p-0" hideClose>
        <DialogTitle className="sr-only">Global search</DialogTitle>
        <DialogDescription className="sr-only">
          Search promo requests, programs, channels, projects and goals
        </DialogDescription>

        <div className="flex items-center gap-2 border-b px-4">
          {loading ? (
            <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" aria-hidden />
          ) : (
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          )}
          <Input
            autoFocus
            value={term}
            onChange={(e) => {
              setTerm(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveIndex((i) => Math.min(i + 1, results.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveIndex((i) => Math.max(i - 1, 0));
              } else if (e.key === 'Enter' && results[activeIndex]) {
                e.preventDefault();
                goTo(results[activeIndex]);
              }
            }}
            placeholder="Search requests, programs, channels, projects, goals…"
            className="h-14 border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0"
            aria-label="Search"
            aria-controls="global-search-results"
          />
        </div>

        <div className="max-h-[60vh] overflow-y-auto scrollbar-thin">
          {term.trim().length < 2 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              Type at least two characters to search.
            </p>
          ) : results.length === 0 && !loading ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              Nothing matched “{term.trim()}”.
            </p>
          ) : (
            <ul id="global-search-results" ref={listRef} className="p-2">
              {results.map((item, index) => {
                const Icon = TYPE_ICON[item.type];
                return (
                  <li key={`${item.type}-${item.id}`}>
                    <button
                      type="button"
                      onClick={() => goTo(item)}
                      onMouseEnter={() => setActiveIndex(index)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors',
                        index === activeIndex ? 'bg-accent' : 'hover:bg-accent/60',
                      )}
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{item.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {item.subtitle}
                        </span>
                      </span>
                      {index === activeIndex && (
                        <CornerDownLeft className="size-3.5 shrink-0 text-muted-foreground" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex items-center gap-4 border-t px-4 py-2 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <kbd className="rounded border bg-muted px-1 py-0.5 font-mono">↑</kbd>
            <kbd className="rounded border bg-muted px-1 py-0.5 font-mono">↓</kbd> navigate
          </span>
          <span className="inline-flex items-center gap-1">
            <kbd className="rounded border bg-muted px-1 py-0.5 font-mono">↵</kbd> open
          </span>
          <span className="inline-flex items-center gap-1">
            <kbd className="rounded border bg-muted px-1 py-0.5 font-mono">esc</kbd> close
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { CalendarDays, Badge };