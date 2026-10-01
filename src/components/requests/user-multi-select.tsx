'use client';

import { useMemo, useState } from 'react';
import { Check, Search, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { UserAvatar } from '@/components/shared/user-avatar';
import { cn, normalise } from '@/lib/utils';
import type { Profile } from '@/types/database';

interface Props {
  /** Hidden inputs are named this, one per selected user. */
  name: string;
  profiles: Profile[];
  defaultValue?: string[];
  /** Users who cannot be picked (e.g. already participants). */
  excludeIds?: string[];
  /** Optional responsibility chips, stored per selection. */
  responsibilities?: readonly string[];
  placeholder?: string;
}

/**
 * Multi-select for users that works as a native form control.
 *
 * Each selected user renders a hidden `<input name=...>` so the surrounding
 * Server Action receives them via `formData.getAll(name)` — no client-side
 * serialisation and no divergence between what is shown and what is submitted.
 */
export function UserMultiSelect({
  name,
  profiles,
  defaultValue = [],
  excludeIds = [],
  responsibilities,
  placeholder = 'Select people',
}: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(defaultValue);
  const [term, setTerm] = useState('');

  const excluded = useMemo(() => new Set(excludeIds), [excludeIds]);

  const options = useMemo(() => {
    const needle = normalise(term.trim());
    return profiles
      .filter((p) => !excluded.has(p.id))
      .filter((p) => p.status === 'active')
      .filter((p) => (needle ? normalise(p.full_name).includes(needle) : true))
      .slice(0, 60);
  }, [profiles, excluded, term]);

  const selectedProfiles = selected
    .map((id) => profiles.find((p) => p.id === id))
    .filter((p): p is Profile => Boolean(p));

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  }

  return (
    <div className="space-y-2">
      {selectedProfiles.map((profile) => (
        <input key={profile.id} type="hidden" name={name} value={profile.id} />
      ))}

      <div className="flex flex-wrap gap-1.5">
        {selectedProfiles.map((profile) => (
          <Badge key={profile.id} variant="secondary" className="gap-1.5 py-1 pl-1 pr-1.5">
            <UserAvatar name={profile.full_name} avatarUrl={profile.avatar_url} className="size-5" />
            {profile.full_name}
            <button
              type="button"
              onClick={() => toggle(profile.id)}
              className="rounded-full p-0.5 hover:bg-background/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Remove ${profile.full_name}`}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 rounded-full px-2.5 text-xs font-normal"
            >
              <Search className="size-3" />
              {selected.length === 0 ? placeholder : 'Add more'}
            </Button>
          </PopoverTrigger>

          <PopoverContent align="start" className="w-72 p-0">
            <div className="border-b p-2">
              <Input
                autoFocus
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Search people…"
                className="h-8 text-xs"
                aria-label="Search people"
              />
            </div>

            <ul className="max-h-64 overflow-y-auto p-1 scrollbar-thin">
              {options.length === 0 ? (
                <li className="px-3 py-6 text-center text-xs text-muted-foreground">
                  No people found
                </li>
              ) : (
                options.map((profile) => {
                  const isSelected = selected.includes(profile.id);
                  return (
                    <li key={profile.id}>
                      <button
                        type="button"
                        onClick={() => toggle(profile.id)}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors',
                          'hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          isSelected && 'bg-accent/60',
                        )}
                      >
                        <UserAvatar
                          name={profile.full_name}
                          avatarUrl={profile.avatar_url}
                          className="size-6"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm">{profile.full_name}</span>
                          {profile.job_title && (
                            <span className="block truncate text-[11px] text-muted-foreground">
                              {profile.job_title}
                            </span>
                          )}
                        </span>
                        {isSelected && <Check className="size-4 shrink-0 text-primary" />}
                      </button>
                    </li>
                  );
                })
              )}
            </ul>

            {responsibilities && responsibilities.length > 0 && (
              <div className="border-t p-2">
                <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">
                  Common responsibilities
                </p>
                <div className="flex flex-wrap gap-1">
                  {responsibilities.map((r) => (
                    <Badge key={r} variant="outline" className="text-[10px]">
                      {r}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>

      {selected.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {selected.length} participant{selected.length === 1 ? '' : 's'} selected
        </p>
      )}
    </div>
  );
}