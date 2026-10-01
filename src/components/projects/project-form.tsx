'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { UserMultiSelect } from '@/components/requests/user-multi-select';
import { saveProjectAction } from '@/lib/actions/reference';
import type { ActionState } from '@/lib/auth/actions';

import { StatusBadge } from '@/components/ui/badge';
import { STATUS_META } from '@/lib/constants';
import type { Profile, Program, Project } from '@/types/database';

const NONE = '__none__';

interface Props {
  project: Project | null;
  profiles: Profile[];
  programs: Program[];
  /** Existing membership, so an edit round-trips without clearing the team. */
  memberIds: string[];
  /** Existing program links, likewise. */
  programIds: string[];
  onOpenChange: (open: boolean) => void;
}

/**
 * Create/edit form for a project.
 *
 * A project groups promo requests under a shared objective and carries its own
 * membership and linked programs. On create the server action returns the new
 * id, so we route straight to the detail page rather than bouncing back to the
 * index and hoping the user can find what they just made.
 */
export function ProjectFormDialog({
  project,
  profiles,
  programs,
  memberIds,
  programIds,
  onOpenChange,
}: Props) {
  const router = useRouter();
  // This action returns the new project id on create, so the state parameter is
// widened — see `ActionState`.
  const [state, formAction, isPending] = useActionState<ActionState<{ id: string }>, FormData>(
    saveProjectAction,
    null,
  );

  // Field errors arrive already flattened by the server action; read them
  // directly rather than re-parsing, matching the other reference forms.
  const errors = state && !state.ok ? state.fieldErrors : undefined;

  // Confirm once the server accepts the change. On create, prefer navigating to
  // the new project; on edit, close and let the refresh repaint the card.
  if (state?.ok) {
    const createdId = state.data?.id;
    if (!project && createdId) {
      toast.success('Project created.');
      onOpenChange(false);
      router.push(`/projects/${createdId}`);
    } else {
      toast.success(state.message ?? 'Project saved.');
      onOpenChange(false);
      router.refresh();
    }
  }

  const selectedPrograms = new Set(programIds);

  return (
    <form action={formAction} className="space-y-4" key={project?.id ?? 'new'}>
      {project && <input type="hidden" name="id" value={project.id} />}

      {state && !state.ok && (
        <Alert variant="error">
          <AlertTitle>Could not save the project</AlertTitle>
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-[150px_1fr]">
        <div className="space-y-1.5">
          <Label htmlFor="project-code">Code</Label>
          <Input
            id="project-code"
            name="code"
            defaultValue={project?.code ?? ''}
            placeholder="SAT7-2026"
            maxLength={40}
          />
          {errors?.code && <p className="text-xs text-destructive">{errors.code[0]}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="project-name">
            Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="project-name"
            name="name"
            required
            defaultValue={project?.name ?? ''}
            placeholder="Ramadan 2026 campaign"
          />
          {errors?.name && <p className="text-xs text-destructive">{errors.name[0]}</p>}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="project-description">Description</Label>
        <Textarea
          id="project-description"
          name="description"
          rows={2}
          defaultValue={project?.description ?? ''}
          placeholder="What this project covers and who it serves."
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="project-manager">Project manager</Label>
          <Select name="manager_id" defaultValue={project?.manager_id ?? NONE}>
            <SelectTrigger id="project-manager">
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

        <div className="space-y-1.5">
          <Label htmlFor="project-status">Status</Label>
          <Select name="status" defaultValue={project?.status ?? 'active'}>
            <SelectTrigger id="project-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(['active', 'inactive', 'archived'] as const).map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_META[s]?.label ?? s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="project-start">Start date</Label>
          <Input
            id="project-start"
            name="start_date"
            type="date"
            defaultValue={project?.start_date ?? ''}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="project-end">End date</Label>
          <Input
            id="project-end"
            name="end_date"
            type="date"
            defaultValue={project?.end_date ?? ''}
          />
          {errors?.end_date && <p className="text-xs text-destructive">{errors.end_date[0]}</p>}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="project-notes">Notes</Label>
        <Textarea
          id="project-notes"
          name="notes"
          rows={2}
          defaultValue={project?.notes ?? ''}
          placeholder="Internal context, budget holder, escalation path."
        />
      </div>

      <div className="space-y-1.5">
        <Label>Team members</Label>
        <UserMultiSelect
          name="member_ids"
          profiles={profiles}
          defaultValue={memberIds}
          placeholder="Add people to this project"
        />
        <p className="text-xs text-muted-foreground">
          Membership feeds the project report and workload roll-ups. It does not assign work by
          itself — assign each request to whoever owns it.
        </p>
      </div>

      {programs.length > 0 && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Linked programs</legend>
          <p className="text-xs text-muted-foreground">
            Programs offered when creating a request inside this project.
          </p>
          <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border p-2">
            {programs.map((program) => (
              <label
                key={program.id}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
              >
                <Checkbox
                  name="program_ids"
                  value={program.id}
                  defaultChecked={selectedPrograms.has(program.id)}
                  aria-label={program.name}
                />
                <span className="min-w-0 flex-1 truncate">{program.name}</span>
                {program.status !== 'active' && (
                  <StatusBadge
                    tone={STATUS_META[program.status]?.badge ?? STATUS_META.active.badge}
                    label={STATUS_META[program.status]?.label ?? program.status}
                  />
                )}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="size-4 animate-spin" />}
          {project ? 'Save changes' : 'Create project'}
        </Button>
      </div>
    </form>
  );
}