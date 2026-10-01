'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Pencil, Plus, Search, Users as UsersIcon } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusBadge, Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { UserAvatar } from '@/components/shared/user-avatar';
import { UserFormDialog } from './user-form';
import { ROLE_META, STATUS_META } from '@/lib/constants';
import { ALL_ROLES, roleLabel } from '@/lib/auth/permissions';
import { formatRelative, normalise } from '@/lib/utils';
import type { AppRole, Profile } from '@/types/database';

const NONE = '__none__';

interface Props {
  profiles: Profile[];
  canManage: boolean;
  currentUserId: string;
  initialRole?: string;
}

export function UsersView({ profiles, canManage, currentUserId, initialRole }: Props) {
  const [term, setTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState(
    initialRole && ALL_ROLES.includes(initialRole as AppRole) ? initialRole : NONE,
  );
  const [statusFilter, setStatusFilter] = useState(NONE);
  const [editing, setEditing] = useState<Profile | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const visible = useMemo(() => {
    const needle = normalise(term.trim());
    return profiles.filter((p) => {
      if (roleFilter !== NONE && p.role !== roleFilter) return false;
      if (statusFilter !== NONE && p.status !== statusFilter) return false;
      if (!needle) return true;
      return (
        normalise(p.full_name).includes(needle) ||
        normalise(p.email).includes(needle) ||
        normalise(p.job_title ?? '').includes(needle)
      );
    });
  }, [profiles, term, roleFilter, statusFilter]);

  /** Headcount per role, shown as a summary strip above the table. */
  const roleCounts = useMemo(() => {
    const counts = new Map<AppRole, number>();
    for (const p of profiles) counts.set(p.role, (counts.get(p.role) ?? 0) + 1);
    return counts;
  }, [profiles]);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(profile: Profile) {
    setEditing(profile);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Users"
        description="Everyone with access to the promo system, and what they are allowed to do."
        actions={
          canManage && (
            <Button size="sm" onClick={openCreate}>
              <Plus className="size-4" />
              Add user
            </Button>
          )
        }
      />

      <section aria-label="Users by role" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ALL_ROLES.map((role) => (
          <button
            key={role}
            type="button"
            onClick={() => setRoleFilter(roleFilter === role ? NONE : role)}
            aria-pressed={roleFilter === role}
            className={
              'rounded-xl border bg-card p-3.5 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ' +
              (roleFilter === role ? 'ring-2 ring-primary' : '')
            }
          >
            <div className="flex items-center justify-between gap-2">
              <StatusBadge tone={ROLE_META[role].badge} label={roleLabel(role)} />
              <span className="text-xl font-semibold tabular-nums">
                {roleCounts.get(role) ?? 0}
              </span>
            </div>
          </button>
        ))}
      </section>

      <div className="flex flex-col gap-2 rounded-xl border bg-card p-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search by name, email or job title..."
            aria-label="Search users"
            className="pl-9"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by status"
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm sm:w-[160px]"
        >
          <option value={NONE}>Any status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<UsersIcon className="size-6" />}
          title={profiles.length === 0 ? 'No users found' : 'No users match'}
          description={
            profiles.length === 0
              ? 'Users appear here once their account has been created.'
              : 'Try a different search, role or status.'
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">
                Users with access to the promo system. {visible.length} shown.
              </caption>
              <thead>
                <tr className="border-b bg-muted/40">
                  <th scope="col" className="h-11 px-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Person</th>
                  <th scope="col" className="h-11 px-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Role</th>
                  <th scope="col" className="h-11 px-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
                  <th scope="col" className="h-11 px-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Workload</th>
                  <th scope="col" className="h-11 px-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Last seen</th>
                  {canManage && (
                    <th scope="col" className="h-11 w-20 px-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {visible.map((profile) => {
                  const isSelf = profile.id === currentUserId;

                  return (
                    <tr key={profile.id} className="border-b transition-colors last:border-0 hover:bg-muted/40">
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <UserAvatar
                            name={profile.full_name}
                            avatarUrl={profile.avatar_url}
                            className="size-8"
                          />
                          <div className="min-w-0">
                            <p className="flex items-center gap-1.5 font-medium">
                              <span className="truncate">{profile.full_name}</span>
                              {isSelf && <Badge variant="outline">You</Badge>}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {profile.email}
                              {profile.job_title ? ' - ' + profile.job_title : ''}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-3 py-2.5">
                        <StatusBadge
                          tone={ROLE_META[profile.role]?.badge ?? ROLE_META.viewer.badge}
                          label={roleLabel(profile.role)}
                        />
                      </td>

                      <td className="px-3 py-2.5">
                        <StatusBadge
                          tone={STATUS_META[profile.status]?.badge ?? STATUS_META.active.badge}
                          label={STATUS_META[profile.status]?.label ?? profile.status}
                        />
                      </td>

                      <td className="px-3 py-2.5">
                        <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs">
                          <Link href={`/requests?user=${profile.id}`}>View requests</Link>
                        </Button>
                      </td>

                      <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted-foreground">
                        {profile.last_seen_at ? formatRelative(profile.last_seen_at) : 'Never'}
                      </td>

                      {canManage && (
                        <td className="px-3 py-2.5">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => openEdit(profile)}
                            aria-label={`Edit ${profile.full_name}`}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!canManage && (
        <p className="text-xs text-muted-foreground">
          You can view the directory. Only administrators can create accounts or change roles.
        </p>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.full_name}` : 'Add a user'}</DialogTitle>
            <DialogDescription>
              {editing
                ? 'Change their role, status or contact details.'
                : 'Creates a Supabase account and a profile. They sign in with the temporary password you set.'}
            </DialogDescription>
          </DialogHeader>

          <UserFormDialog
            user={editing}
            currentUserId={currentUserId}
            onOpenChange={setDialogOpen}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}