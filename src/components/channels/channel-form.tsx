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
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { SubmitButton } from '@/components/auth/submit-button';
import type { ActionResult } from '@/lib/auth/actions';
import { deleteChannelAction, saveChannelAction } from '@/lib/actions/reference';
import type { Channel } from '@/types/database';

const COLORS = [
  { value: 'brand', label: 'SAT-7 Blue' },
  { value: 'cyan', label: 'Cyan' },
  { value: 'violet', label: 'Violet' },
  { value: 'amber', label: 'Amber' },
  { value: 'emerald', label: 'Emerald' },
  { value: 'rose', label: 'Rose' },
  { value: 'lime', label: 'Lime' },
  { value: 'orange', label: 'Orange' },
];

/**
 * Create/edit form for a channel, rendered inside a dialog on the channels
 * page. `channel` is null when creating, which switches the server action
 * between insert and update.
 */
export function ChannelFormDialog({
  channel,
  onOpenChange,
}: {
  channel: Channel | null;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    saveChannelAction,
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
      <form action={formAction} className="space-y-4" key={channel?.id ?? 'new'}>
        {channel && <input type="hidden" name="id" value={channel.id} />}

        {state && !state.ok && (
          <Alert variant="error">
            <AlertTitle>Could not save</AlertTitle>
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="channel-name">
            Channel name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="channel-name"
            name="name"
            defaultValue={channel?.name ?? ''}
            placeholder="SAT-7 Arabic"
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
            <Label htmlFor="channel-code">Code</Label>
            <Input
              id="channel-code"
              name="code"
              defaultValue={channel?.code ?? ''}
              placeholder="SAT7-AR"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="channel-category">Category</Label>
            <Input
              id="channel-category"
              name="category"
              defaultValue={channel?.category ?? ''}
              placeholder="Broadcast, Digital, Radio…"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="channel-description">Description</Label>
          <Textarea
            id="channel-description"
            name="description"
            defaultValue={channel?.description ?? ''}
            rows={2}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="channel-color">Colour</Label>
            <select
              id="channel-color"
              name="color"
              defaultValue={channel?.color ?? 'brand'}
              className="flex h-9 w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
            >
              {COLORS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="channel-sort">Sort order</Label>
            <Input
              id="channel-sort"
              name="sort_order"
              type="number"
              min={0}
              defaultValue={channel?.sort_order ?? 0}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="channel-status">Status</Label>
            <select
              id="channel-status"
              name="status"
              defaultValue={channel?.status ?? 'active'}
              className="flex h-9 w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="channel-notes">Notes</Label>
          <Textarea id="channel-notes" name="notes" defaultValue={channel?.notes ?? ''} rows={2} />
        </div>

        <div className="flex justify-end gap-2 border-t pt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <SubmitButton isLoading={isPending}>
            {channel ? 'Save changes' : 'Create channel'}
          </SubmitButton>
        </div>
      </form>

      {channel && <ArchiveChannelButton channel={channel} />}
    </>
  );
}

/**
 * Archive lives outside the form so the dialog offers one clear primary
 * action. Archiving (rather than deleting) preserves historical reports.
 */
function ArchiveChannelButton({ channel }: { channel: Channel }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
        <p className="text-xs text-muted-foreground">
          Archiving keeps historical reports intact. The channel disappears from new requests.
        </p>
        <Button type="button" variant="destructive" size="sm" onClick={() => setOpen(true)}>
          <Trash2 className="size-4" />
          Archive
        </Button>
      </div>

      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Archive ${channel.name}?`}
        description="Existing requests keep their channel reference, so past reporting is unaffected."
        confirmLabel="Archive channel"
        destructive
        requireText={channel.name}
        onConfirm={async () => {
          const result = await deleteChannelAction(channel.id);
          if (result.ok) router.refresh();
          return result;
        }}
      />
    </>
  );
}