'use client';

import { useState } from 'react';
import { Plus, Save, Trash2, Clock, CalendarDays, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { StatusBadge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { updateShiftsAction } from '@/lib/actions/requests';
import { SHIFT_STATUS_META } from '@/lib/constants';
import { formatDate, cn } from '@/lib/utils';
import type { RequestShiftWithUser } from '@/lib/queries/details';
import type { Profile, ShiftStatus } from '@/types/database';

interface Props {
  requestId: string;
  shifts: RequestShiftWithUser[];
  profiles: Profile[];
  canEdit: boolean;
  onChanged?: () => void;
}

/** Local, editable mirror of the shift set. Ids are preserved on save. */
interface DraftShift {
  id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  assigned_to_id: string;
  location: string;
  notes: string;
  status: ShiftStatus;
}

function toDraft(shift: RequestShiftWithUser): DraftShift {
  return {
    id: shift.id,
    shift_date: shift.shift_date ?? '',
    start_time: shift.start_time ?? '',
    end_time: shift.end_time ?? '',
    assigned_to_id: shift.assigned_to_id ?? '',
    location: shift.location ?? '',
    notes: shift.notes ?? '',
    status: shift.status,
  };
}

export function ShiftsPanel({ requestId, shifts, profiles, canEdit, onChanged }: Props) {
  const [drafts, setDrafts] = useState<DraftShift[]>(shifts.map(toDraft));
  const [saving, setSaving] = useState(false);

  function update(id: string, patch: Partial<DraftShift>) {
    setDrafts((current) => current.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }

  function addShift() {
    // A client-generated UUID keeps the row addressable before it exists.
    const id = crypto.randomUUID();
    setDrafts((current) => [
      ...current,
      {
        id,
        shift_date: '',
        start_time: '',
        end_time: '',
        assigned_to_id: '',
        location: '',
        notes: '',
        status: 'planned',
      },
    ]);
  }

  function removeShift(id: string) {
    setDrafts((current) => current.filter((d) => d.id !== id));
  }

  async function save() {
    setSaving(true);

    const payload = drafts.map((d, index) => ({
      id: d.id,
      shift_date: d.shift_date || null,
      start_time: d.start_time || null,
      end_time: d.end_time || null,
      assigned_to_id: d.assigned_to_id || null,
      location: d.location || null,
      notes: d.notes || null,
      status: d.status,
      // Preserved for readability in the audit trail.
      shift_number: index + 1,
    }));

    const result = await updateShiftsAction(requestId, payload);
    setSaving(false);

    if (result.ok) {
      toast.success(result.message ?? 'Shifts saved');
      onChanged?.();
    } else {
      toast.error(result.error);
    }
  }

  if (drafts.length === 0 && !canEdit) {
    return (
      <EmptyState
        icon={<Clock className="size-6" />}
        title="No shifts on this request"
        description="The shift count is zero, or shifts have not been created yet."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {drafts.length} shift{drafts.length === 1 ? '' : 's'} ·{' '}
          {drafts.filter((d) => d.status === 'done').length} completed
        </p>
        <div className="flex items-center gap-2">
          {canEdit && (
            <Button size="sm" variant="outline" onClick={addShift}>
              <Plus className="size-4" />
              Add shift
            </Button>
          )}
          {canEdit && (
            <Button size="sm" onClick={save} isLoading={saving} disabled={drafts.length === 0}>
              <Save className="size-4" />
              Save shifts
            </Button>
          )}
        </div>
      </div>

      {drafts.length === 0 ? (
        <EmptyState
          icon={<Clock className="size-6" />}
          title="No shifts yet"
          description="Add a shift for each day of production work."
          action={
            canEdit ? (
              <Button onClick={addShift}>
                <Plus className="size-4" />
                Add the first shift
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="space-y-3">
          {drafts.map((draft, index) => {
            const original = shifts.find((s) => s.id === draft.id);
            const dirty =
              original &&
              (original.shift_date ?? '') !== draft.shift_date ||
              (original?.start_time ?? '') !== draft.start_time ||
              (original?.end_time ?? '') !== draft.end_time ||
              (original?.assigned_to_id ?? '') !== draft.assigned_to_id ||
              (original?.location ?? '') !== draft.location ||
              (original?.notes ?? '') !== draft.notes ||
              original?.status !== draft.status;

            return (
              <motion.li
                key={draft.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.03, 0.2) }}
                className={cn(
                  'space-y-4 rounded-xl border bg-card p-4 transition-colors',
                  draft.status === 'done' && 'bg-emerald-50/30 dark:bg-emerald-950/10',
                  draft.status === 'cancelled' && 'opacity-60',
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex size-7 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                      {index + 1}
                    </span>
                    <h3 className="text-sm font-semibold">Shift {index + 1}</h3>
                    {dirty && canEdit && (
                      <span className="text-[11px] text-amber-600 dark:text-amber-400">Unsaved</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {canEdit ? (
                      <Select
                        value={draft.status}
                        onValueChange={(v) => update(draft.id, { status: v as ShiftStatus })}
                      >
                        <SelectTrigger
                          className="h-8 w-[130px] text-xs"
                          aria-label={`Shift ${index + 1} status`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(SHIFT_STATUS_META) as ShiftStatus[]).map((s) => (
                            <SelectItem key={s} value={s}>
                              {SHIFT_STATUS_META[s].label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <StatusBadge
                        tone={SHIFT_STATUS_META[draft.status].badge}
                        label={SHIFT_STATUS_META[draft.status].label}
                      />
                    )}

                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => removeShift(draft.id)}
                        aria-label={`Delete shift ${index + 1}`}
                      >
                        <Trash2 className="size-3.5 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>

                {canEdit ? (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="space-y-1.5">
                      <Label htmlFor={`date-${draft.id}`} className="text-xs">
                        Date
                      </Label>
                      <Input
                        id={`date-${draft.id}`}
                        type="date"
                        value={draft.shift_date}
                        onChange={(e) => update(draft.id, { shift_date: e.target.value })}
                        className="h-8 text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor={`start-${draft.id}`} className="text-xs">
                        Start
                      </Label>
                      <Input
                        id={`start-${draft.id}`}
                        type="time"
                        value={draft.start_time}
                        onChange={(e) => update(draft.id, { start_time: e.target.value })}
                        className="h-8 text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor={`end-${draft.id}`} className="text-xs">
                        End
                      </Label>
                      <Input
                        id={`end-${draft.id}`}
                        type="time"
                        value={draft.end_time}
                        onChange={(e) => update(draft.id, { end_time: e.target.value })}
                        className="h-8 text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor={`person-${draft.id}`} className="text-xs">
                        Assigned
                      </Label>
                      <Select
                        value={draft.assigned_to_id || '__none__'}
                        onValueChange={(v) =>
                          update(draft.id, { assigned_to_id: v === '__none__' ? '' : v })
                        }
                      >
                        <SelectTrigger
                          id={`person-${draft.id}`}
                          className="h-8 text-xs"
                          aria-label={`Shift ${index + 1} assigned person`}
                        >
                          <SelectValue placeholder="Anyone" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Anyone</SelectItem>
                          {profiles.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.full_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5 sm:col-span-2 lg:col-span-4">
                      <Label htmlFor={`loc-${draft.id}`} className="text-xs">
                        Location
                      </Label>
                      <Input
                        id={`loc-${draft.id}`}
                        value={draft.location}
                        onChange={(e) => update(draft.id, { location: e.target.value })}
                        placeholder="Studio, location…"
                        className="h-8 text-xs"
                      />
                    </div>

                    <div className="space-y-1.5 sm:col-span-2 lg:col-span-4">
                      <Label htmlFor={`notes-${draft.id}`} className="text-xs">
                        Notes
                      </Label>
                      <Textarea
                        id={`notes-${draft.id}`}
                        value={draft.notes}
                        onChange={(e) => update(draft.id, { notes: e.target.value })}
                        rows={2}
                        className="text-xs"
                      />
                    </div>
                  </div>
                ) : (
                  <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <dt className="text-xs text-muted-foreground">Date</dt>
                      <dd className="mt-0.5 font-medium">
                        {formatDate(draft.shift_date || null)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Time</dt>
                      <dd className="mt-0.5 font-medium">
                        {draft.start_time
                          ? `${draft.start_time.slice(0, 5)}${draft.end_time ? ` – ${draft.end_time.slice(0, 5)}` : ''}`
                          : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Assigned</dt>
                      <dd className="mt-0.5 font-medium">
                        {original?.user?.full_name ?? 'Anyone'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Location</dt>
                      <dd className="mt-0.5 font-medium">{draft.location || '—'}</dd>
                    </div>
                    {draft.notes && (
                      <div className="sm:col-span-2 lg:col-span-4">
                        <dt className="text-xs text-muted-foreground">Notes</dt>
                        <dd className="mt-0.5 whitespace-pre-wrap text-sm">{draft.notes}</dd>
                      </div>
                    )}
                  </dl>
                )}
              </motion.li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export { CalendarDays, MapPin };