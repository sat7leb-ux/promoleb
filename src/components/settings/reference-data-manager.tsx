'use client';

import { useActionState, useState } from 'react';
import { GripVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { SubmitButton } from '@/components/auth/submit-button';
import { cn } from '@/lib/utils';
import type { ActionResult, ActionState } from '@/lib/auth/actions';

/**
 * Generic editor for the single-table reference lists (goals, promo types).
 *
 * These tables share a shape — name, description, an optional category or
 * colour, an active flag and a sort order — so one component covers them
 * instead of three near-identical files. Stages differ enough (position and
 * terminal flags drive the pipeline) to justify their own screen.
 */
export interface ReferenceItem {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  color?: string | null;
  category?: string | null;
}

interface Props {
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
  items: ReferenceItem[];
  saveAction: (prev: ActionState, formData: FormData) => Promise<ActionResult>;
  deleteAction: (id: string) => Promise<ActionResult>;
  /** Extra fields rendered between the name and description inputs. */
  extraField?: 'category' | 'color';
}

const COLORS = [
  { value: 'brand', label: 'SAT-7 Blue' },
  { value: 'violet', label: 'Violet' },
  { value: 'cyan', label: 'Cyan' },
  { value: 'emerald', label: 'Emerald' },
  { value: 'amber', label: 'Amber' },
  { value: 'rose', label: 'Rose' },
  { value: 'slate', label: 'Slate' },
];

export function ReferenceDataManager({
  title,
  description,
  emptyTitle,
  emptyDescription,
  items,
  saveAction,
  deleteAction,
  extraField,
}: Props) {
  const [editing, setEditing] = useState<ReferenceItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>

        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="size-4" />
          Add
        </Button>
      </div>

      {sorted.length === 0 ? (
        <EmptyState icon={<Plus className="size-6" />} title={emptyTitle} description={emptyDescription} />
      ) : (
        <ul className="space-y-2">
          {sorted.map((item, index) => (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5 shadow-sm"
            >
              <span
                className="cursor-grab text-muted-foreground"
                aria-hidden
                title={`Position ${index + 1}`}
              >
                <GripVertical className="size-4" />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-medium">{item.name}</span>
                  {!item.is_active && <Badge variant="secondary">Inactive</Badge>}
                  {extraField === 'color' && item.color && (
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <span
                        className={cn('size-2 rounded-full', DOT[item.color] ?? 'bg-brand-500')}
                        aria-hidden
                      />
                      {item.color}
                    </span>
                  )}
                  {extraField === 'category' && item.category && (
                    <Badge variant="outline">{item.category}</Badge>
                  )}
                </div>
                {item.description && (
                  <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                    {item.description}
                  </p>
                )}
              </div>

              <span className="hidden text-xs tabular-nums text-muted-foreground sm:inline">
                #{item.sort_order}
              </span>

              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Edit ${item.name}`}
                onClick={() => {
                  setEditing(item);
                  setDialogOpen(true);
                }}
              >
                <Pencil className="size-4" />
              </Button>

              <ReferenceDeleteButton
                name={item.name}
                onConfirm={() => deleteAction(item.id)}
              />
            </li>
          ))}
        </ul>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.name}` : `New ${title.toLowerCase()}`}</DialogTitle>
            <DialogDescription>
              These values appear in request filters and reports, so existing records keep
              working if you rename one.
            </DialogDescription>
          </DialogHeader>

          <ReferenceForm
            key={editing?.id ?? 'new'}
            item={editing}
            saveAction={saveAction}
            extraField={extraField}
            onDone={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </section>
  );
}

function ReferenceForm({
  item,
  saveAction,
  extraField,
  onDone,
}: {
  item: ReferenceItem | null;
  saveAction: Props['saveAction'];
  extraField?: Props['extraField'];
  onDone: () => void;
}) {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(saveAction, null);

  if (state?.ok) {
    toast.success(state.message ?? 'Saved.');
    onDone();
  }

  const errors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <form action={formAction} className="space-y-4">
      {item && <input type="hidden" name="id" value={item.id} />}

      {state && !state.ok && (
        <Alert variant="error">
          <AlertTitle>Could not save</AlertTitle>
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="ref-name">
          Name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="ref-name"
          name="name"
          required
          defaultValue={item?.name ?? ''}
          maxLength={200}
        />
        {errors?.name && <p className="text-xs text-destructive">{errors.name[0]}</p>}
      </div>

      {extraField === 'category' && (
        <div className="space-y-1.5">
          <Label htmlFor="ref-category">Category</Label>
          <Input
            id="ref-category"
            name="category"
            defaultValue={item?.category ?? ''}
            maxLength={80}
            placeholder="Audience growth, Retention, Launch"
          />
        </div>
      )}

      {extraField === 'color' && (
        <div className="space-y-1.5">
          <Label htmlFor="ref-color">Colour</Label>
          <select
            id="ref-color"
            name="color"
            defaultValue={item?.color ?? 'violet'}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {COLORS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="ref-description">Description</Label>
        <Textarea
          id="ref-description"
          name="description"
          rows={2}
          defaultValue={item?.description ?? ''}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex items-center justify-between rounded-lg border p-3">
          <Label htmlFor="ref-active" className="text-sm font-normal">
            Active
          </Label>
          <Switch id="ref-active" name="is_active" defaultChecked={item?.is_active ?? true} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ref-sort">Sort order</Label>
          <Input
            id="ref-sort"
            name="sort_order"
            type="number"
            min={0}
            max={999}
            defaultValue={item?.sort_order ?? 0}
          />
          {errors?.sort_order && (
            <p className="text-xs text-destructive">{errors.sort_order[0]}</p>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <SubmitButton isLoading={isPending}>{item ? 'Save changes' : 'Create'}</SubmitButton>
      </div>
    </form>
  );
}

/**
 * Trash button plus its confirmation.
 *
 * `ConfirmDialog` is fully controlled so the caller owns the open state; here
 * that state is local to the button, which keeps the list markup flat.
 */
function ReferenceDeleteButton({
  name,
  onConfirm,
}: {
  name: string;
  onConfirm: () => Promise<ActionResult>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Delete ${name}`}
        onClick={() => setOpen(true)}
      >
        <Trash2 className="size-4 text-destructive" />
      </Button>

      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Delete "${name}"?`}
        description="This removes it from the pickers. Existing requests keep whatever value they were created with."
        confirmLabel="Delete"
        destructive
        onConfirm={onConfirm}
      />
    </>
  );
}

const DOT: Record<string, string> = {
  brand: 'bg-brand-500',
  violet: 'bg-violet-500',
  cyan: 'bg-cyan-500',
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
  slate: 'bg-slate-400',
};