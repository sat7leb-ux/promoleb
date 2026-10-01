'use client';

import { useState } from 'react';
import { UserPlus, Trash2, Users, Check } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { UserAvatar } from '@/components/shared/user-avatar';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { addParticipantAction, removeParticipantAction } from '@/lib/actions/requests';
import { COMMON_RESPONSIBILITIES } from '@/lib/constants';
import { roleLabel } from '@/lib/auth/permissions';
import type { AppRole } from '@/types/database';
import { formatDate } from '@/lib/utils';
import type { RequestParticipantWithUser } from '@/lib/queries/details';
import type { Profile } from '@/types/database';

interface Props {
  requestId: string;
  participants: RequestParticipantWithUser[];
  assignedTo: { id: string; full_name: string; avatar_url: string | null } | null;
  profiles: Profile[];
  canManage: boolean;
  currentUserId: string;
}

export function ParticipantsPanel({
  requestId,
  participants,
  assignedTo,
  profiles,
  canManage,
  currentUserId,
}: Props) {
  const [newUserId, setNewUserId] = useState('');
  const [responsibility, setResponsibility] = useState('');
  const [adding, setAdding] = useState(false);
  const [pendingRemoval, setPendingRemoval] = useState<RequestParticipantWithUser | null>(null);

  const participantIds = new Set(participants.map((p) => p.user_id));
  const available = profiles.filter(
    (p) => p.status === 'active' && !participantIds.has(p.id) && p.id !== assignedTo?.id,
  );

  async function handleAdd() {
    if (!newUserId) return;
    setAdding(true);
    const result = await addParticipantAction(requestId, {
      user_id: newUserId,
      responsibility: responsibility || null,
    });
    setAdding(false);

    if (result.ok) {
      setNewUserId('');
      setResponsibility('');
      toast.success(result.message ?? 'Participant added');
    } else {
      toast.error(result.error);
    }
  }

  return (
    <div className="space-y-5">
      {/* --- assigned vs participants distinction --- */}
      <div className="rounded-xl border bg-brand-50/40 p-4 dark:bg-brand-950/20">
        <div className="flex items-start gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-200">
            <Check className="size-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold">Assigned to</h3>
            <p className="text-xs text-muted-foreground">
              The single producer accountable for delivering this request.
            </p>
            {assignedTo ? (
              <div className="mt-2 flex items-center gap-2">
                <UserAvatar
                  name={assignedTo.full_name}
                  avatarUrl={assignedTo.avatar_url}
                  className="size-7"
                />
                <span className="text-sm font-medium">{assignedTo.full_name}</span>
              </div>
            ) : (
              <p className="mt-2 text-sm font-medium text-muted-foreground">
                Nobody is assigned yet
              </p>
            )}
          </div>
        </div>
      </div>

      {/* --- add form --- */}
      {canManage && (
        <div className="rounded-xl border bg-card p-4">
          <h3 className="text-sm font-semibold">Add a participant</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Participants contribute but are not accountable for delivery.
          </p>

          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="participant-user" className="text-xs">
                Person
              </Label>
              <Select value={newUserId} onValueChange={setNewUserId}>
                <SelectTrigger id="participant-user">
                  <SelectValue placeholder="Select a person" />
                </SelectTrigger>
                <SelectContent>
                  {available.length === 0 ? (
                    <SelectItem value="__none__" disabled>
                      Everyone is already on this request
                    </SelectItem>
                  ) : (
                    available.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.full_name}
                        {p.job_title ? ` — ${p.job_title}` : ''}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="participant-responsibility" className="text-xs">
                Responsibility
              </Label>
              <Select
                value={responsibility || '__none__'}
                onValueChange={(v) => setResponsibility(v === '__none__' ? '' : v)}
              >
                <SelectTrigger id="participant-responsibility">
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No specific role</SelectItem>
                  {COMMON_RESPONSIBILITIES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleAdd}
              disabled={!newUserId || available.length === 0}
              isLoading={adding}
            >
              <UserPlus className="size-4" />
              Add
            </Button>
          </div>
        </div>
      )}

      {/* --- list --- */}
      {participants.length === 0 ? (
        <EmptyState
          icon={<Users className="size-6" />}
          title="No participants yet"
          description="Add the camera, sound, editing and production crew working on this promo."
          action={
            canManage && available.length > 0 ? (
              <Button
                onClick={() => setNewUserId(available[0].id)}
                variant="outline"
              >
                Start with {available[0].full_name}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="space-y-2">
          {participants.map((participant, index) => (
            <motion.li
              key={participant.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3.5"
            >
              <UserAvatar
                name={participant.user?.full_name}
                avatarUrl={participant.user?.avatar_url}
                className="size-9"
              />

              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <span className="truncate">{participant.user?.full_name ?? 'Unknown user'}</span>
                  {participant.user_id === currentUserId && (
                    <Badge variant="outline" className="shrink-0">
                      You
                    </Badge>
                  )}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {participant.user?.job_title
                    ? `${participant.user.job_title} · ${roleLabel(participant.user?.role as AppRole)}`
                    : participant.user?.email}
                </p>
                {participant.notes && (
                  <p className="mt-1 truncate text-xs text-muted-foreground">{participant.notes}</p>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {participant.responsibility && (
                  <Badge variant="secondary">{participant.responsibility}</Badge>
                )}
                <span className="hidden text-xs text-muted-foreground sm:inline">
                  added {formatDate(participant.created_at)}
                </span>
                {canManage && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setPendingRemoval(participant)}
                    aria-label={`Remove ${participant.user?.full_name ?? 'participant'}`}
                  >
                    <Trash2 className="size-3.5 text-destructive" />
                  </Button>
                )}
              </div>
            </motion.li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={pendingRemoval !== null}
        onOpenChange={(open) => !open && setPendingRemoval(null)}
        title="Remove this participant?"
        description={`${pendingRemoval?.user?.full_name ?? 'This person'} will be removed from the request and will no longer be notified about status changes.`}
        confirmLabel="Remove participant"
        destructive
        onConfirm={async () => {
          if (!pendingRemoval) return { ok: false, error: 'Nothing selected' };
          const result = await removeParticipantAction(requestId, pendingRemoval.id);
          setPendingRemoval(null);
          return result;
        }}
      />
    </div>
  );
}