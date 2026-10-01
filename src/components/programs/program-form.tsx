'use client';

import { useActionState, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { SubmitButton } from '@/components/auth/submit-button';
import type { ActionResult } from '@/lib/auth/actions';
import { deleteProgramAction, saveProgramAction } from '@/lib/actions/reference';
import type { Channel, Profile, Program } from '@/types/database';

const NONE = '__none__';

/**
 * Create/edit form for a program, rendered inside a dialog.
 *
 * `program` is null when creating, which switches the server action between
 * insert and update.
 */
export function ProgramFormDialog({
  program,
  channels,
  profiles,
  onOpenChange,
}: {
  program: Program | null;
  channels: Channel[];
  profiles: Profile[];
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    saveProgramAction,
    null,
  );

  // Confirm and refresh once the server accepts the change.
  if (state?.ok) {
    toast.success(state.message ?? 'Saved');
    onOpenChange(false);
    router.refresh();
  }

  return (
    <>
      <form action={formAction} className="space-y-4" key={program?.id ?? 'new'}>
        {program && <input type="hidden" name="id" value={program.id} />}

        {state && !state.ok && (
          <Alert variant="error">
            <AlertTitle>Could not save</AlertTitle>
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="program-name">
            Program name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="program-name"
            name="name"
            defaultValue={program?.name ?? ''}
            placeholder="Program ABC"
            required
            autoFocus
            invalid={Boolean(state && !state.ok && state.fieldErrors?.name)}
          />
          {state && !state.ok && state.fieldErrors?.name && (
            <p className="text-xs text-destructive">{state.fieldErrors.name[0]}</p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="program-channel">Channel</Label>
            <Select name="channel_id" defaultValue={program?.channel_id ?? NONE}>
              <SelectTrigger id="program-channel">
                <SelectValue placeholder="Select a channel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>No channel</SelectItem>
                {channels
                  .filter((c) => c.status === 'active')
                  .map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="program-owner">Responsible person</Label>
            <Select name="responsible_id" defaultValue={program?.responsible_id ?? NONE}>
              <SelectTrigger id="program-owner">
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Unassigned</SelectItem>
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="program-description">Description</Label>
          <Textarea
            id="program-description"
            name="description"
            defaultValue={program?.description ?? ''}
            rows={3}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="program-start">Start date</Label>
            <Input
              id="program-start"
              name="start_date"
              type="date"
              defaultValue={program?.start_date ?? ''}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="program-end">End date</Label>
            <Input
              id="program-end"
              name="end_date"
              type="date"
              defaultValue={program?.end_date ?? ''}
            />
            {state && !state.ok && state.fieldErrors?.end_date && (
              <p className="text-xs text-destructive">{state.fieldErrors.end_date[0]}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="program-status">Status</Label>
            <select
              id="program-status"
              name="status"
              defaultValue={program?.status ?? 'active'}
              className="flex h-9 w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="program-notes">Notes</Label>
          <Textarea id="program-notes" name="notes" defaultValue={program?.notes ?? ''} rows={2} />
        </div>

        <div className="flex justify-end gap-2 border-t pt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <SubmitButton isLoading={isPending}>
            {program ? 'Save changes' : 'Create program'}
          </SubmitButton>
        </div>
      </form>

      {program && <ArchiveProgramButton program={program} />}
    </>
  );
}

function ArchiveProgramButton({ program }: { program: Program }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
        <p className="text-xs text-muted-foreground">
          Archiving keeps historical reports intact. The program disappears from new requests.
        </p>
        <Button type="button" variant="destructive" size="sm" onClick={() => setOpen(true)}>
          <Trash2 className="size-4" />
          Archive
        </Button>
      </div>

      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Archive ${program.name}?`}
        description="Existing requests keep their program reference, so past reporting is unaffected."
        confirmLabel="Archive program"
        destructive
        requireText={program.name}
        onConfirm={async () => {
          const result = await deleteProgramAction(program.id);
          if (result.ok) router.refresh();
          return result;
        }}
      />
    </>
  );
}