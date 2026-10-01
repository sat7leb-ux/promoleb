'use client';

import { useActionState, useState } from 'react';
import { ArrowDown, ArrowUp, Pencil, Plus } from 'lucide-react';
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
import { SubmitButton } from '@/components/auth/submit-button';
import { reorderStageAction } from '@/lib/actions/reference';
import { cn } from '@/lib/utils';
import { STAGE_COLOR_FALLBACK } from '@/lib/constants';
import type { ActionResult, ActionState } from '@/lib/auth/actions';
import type { PipelineStage } from '@/types/database';

const COLORS = [
  { value: 'slate', label: 'Slate' },
  { value: 'brand', label: 'SAT-7 Blue' },
  { value: 'cyan', label: 'Cyan' },
  { value: 'violet', label: 'Violet' },
  { value: 'amber', label: 'Amber' },
  { value: 'emerald', label: 'Emerald' },
  { value: 'rose', label: 'Rose' },
];

const DOT: Record<string, string> = {
  slate: 'bg-slate-400',
  brand: 'bg-brand-500',
  cyan: 'bg-cyan-500',
  violet: 'bg-violet-500',
  amber: 'bg-amber-500',
  emerald: 'bg-emerald-500',
  rose: 'bg-rose-500',
};

/**
 * Pipeline stage editor.
 *
 * Position is what orders the Kanban columns, so the up/down arrows persist the
 * move immediately rather than waiting for a dialog save — the alternative
 * makes reordering a five-step round trip for a one-column move.
 *
 * Stages that requests still reference cannot be deleted; the server enforces
 * that too, and the copy here sets the expectation rather than surprise anyone
 * with an error.
 */
export function StageManager({
  stages,
  saveAction,
}: {
  stages: PipelineStage[];
  saveAction: (prev: ActionState, formData: FormData) => Promise<ActionResult>;
}) {
  const [editing, setEditing] = useState<PipelineStage | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [moving, setMoving] = useState<string | null>(null);

  const ordered = [...stages].sort((a, b) => a.position - b.position);

  async function move(stage: PipelineStage, direction: 'up' | 'down') {
    setMoving(stage.id);
    const result = await reorderStageAction(stage.id, direction);
    setMoving(null);

    if (result.ok) {
      toast.success(`${stage.name} moved ${direction}.`);
    } else {
      toast.error(result.error);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Pipeline stages</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The columns on the pipeline board, in order. Every stage change is written to the
            request timeline.
          </p>
        </div>

        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="size-4" />
          Add stage
        </Button>
      </div>

      {ordered.length === 0 ? (
        <EmptyState
          icon={<Plus className="size-6" />}
          title="No pipeline stages yet"
          description="The board needs at least one stage before requests can be tracked through it."
        />
      ) : (
        <ul className="space-y-2">
          {ordered.map((stage, index) => (
            <li
              key={stage.id}
              className="flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5 shadow-sm"
            >
              <span className="w-8 shrink-0 text-center text-xs font-medium tabular-nums text-muted-foreground">
                {index + 1}
              </span>

              <span
                className={cn('size-2.5 shrink-0 rounded-full', DOT[stage.color] ?? DOT[STAGE_COLOR_FALLBACK])}
                aria-hidden
              />

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-medium">{stage.name}</span>
                  {stage.is_terminal && <Badge variant="secondary">Terminal</Badge>}
                  {stage.is_cancelled && <Badge variant="outline">Cancels request</Badge>}
                </div>
                {stage.description && (
                  <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                    {stage.description}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Move ${stage.name} up`}
                  disabled={index === 0 || moving === stage.id}
                  onClick={() => move(stage, 'up')}
                >
                  <ArrowUp className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Move ${stage.name} down`}
                  disabled={index === ordered.length - 1 || moving === stage.id}
                  onClick={() => move(stage, 'down')}
                >
                  <ArrowDown className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Edit ${stage.name}`}
                  onClick={() => {
                    setEditing(stage);
                    setDialogOpen(true);
                  }}
                >
                  <Pencil className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-muted-foreground">
        Terminal stages close out a request. A stage marked &quot;cancels request&quot; also sets
        the request to cancelled, so use it only for a dedicated cancelled column.
      </p>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.name}` : 'New pipeline stage'}</DialogTitle>
            <DialogDescription>
              Stages appear on the board in position order, lowest first.
            </DialogDescription>
          </DialogHeader>

          <StageForm
            key={editing?.id ?? 'new'}
            stage={editing}
            suggestedPosition={editing ? editing.position : ordered.length + 1}
            saveAction={saveAction}
            onDone={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </section>
  );
}

function StageForm({
  stage,
  suggestedPosition,
  saveAction,
  onDone,
}: {
  stage: PipelineStage | null;
  suggestedPosition: number;
  saveAction: (prev: ActionState, formData: FormData) => Promise<ActionResult>;
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
      {stage && <input type="hidden" name="id" value={stage.id} />}

      {state && !state.ok && (
        <Alert variant="error">
          <AlertTitle>Could not save the stage</AlertTitle>
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
        <div className="space-y-1.5">
          <Label htmlFor="stage-name">
            Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="stage-name"
            name="name"
            required
            defaultValue={stage?.name ?? ''}
            maxLength={80}
          />
          {errors?.name && <p className="text-xs text-destructive">{errors.name[0]}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="stage-position">Position</Label>
          <Input
            id="stage-position"
            name="position"
            type="number"
            min={0}
            max={999}
            defaultValue={suggestedPosition}
          />
          {errors?.position && <p className="text-xs text-destructive">{errors.position[0]}</p>}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="stage-color">Colour</Label>
        <select
          id="stage-color"
          name="color"
          defaultValue={stage?.color ?? 'slate'}
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {COLORS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="stage-description">Description</Label>
        <Textarea
          id="stage-description"
          name="description"
          rows={2}
          defaultValue={stage?.description ?? ''}
        />
      </div>

      <div className="space-y-2 rounded-lg border p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Label htmlFor="stage-terminal" className="text-sm">
              Terminal stage
            </Label>
            <p className="text-xs text-muted-foreground">
              Requests here count as finished in the dashboard and reports.
            </p>
          </div>
          <Switch
            id="stage-terminal"
            name="is_terminal"
            defaultChecked={stage?.is_terminal ?? false}
          />
        </div>

        <div className="flex items-center justify-between gap-3 border-t pt-2">
          <div>
            <Label htmlFor="stage-cancelled" className="text-sm">
              Cancels the request
            </Label>
            <p className="text-xs text-muted-foreground">
              For a dedicated cancelled column only.
            </p>
          </div>
          <Switch
            id="stage-cancelled"
            name="is_cancelled"
            defaultChecked={stage?.is_cancelled ?? false}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <SubmitButton isLoading={isPending}>{stage ? 'Save changes' : 'Create stage'}</SubmitButton>
      </div>
    </form>
  );
}