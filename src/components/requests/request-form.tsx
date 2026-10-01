'use client';

import { useActionState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { ArrowLeft, Info, Save } from 'lucide-react';
import { createRequestAction, updateRequestAction } from '@/lib/actions/requests';
import type { FormState } from '@/lib/auth/actions';
import { promoRequestBaseSchema } from '@/lib/validation/schemas';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { PRIORITY_META, PRIORITY_ORDER, COMMON_RESPONSIBILITIES } from '@/lib/constants';
import { todayIso, cn } from '@/lib/utils';
import { UserMultiSelect } from '@/components/requests/user-multi-select';
import type { Channel, PipelineStage, Profile, Program, Project, PromoGoal, PromoType } from '@/types/database';

const NONE = '__none__';

/**
 * Form schema. Extends the base object schema (cross-field rules are enforced
 * server-side, where the canonical schema lives) and relaxes the two numeric
 * fields: an empty number input coerces to NaN, which we map to null.
 */
const formSchema = promoRequestBaseSchema.extend({
  episodes_count: z.coerce.number().optional().nullable(),
  duration_seconds: z.coerce.number().optional().nullable(),
});

export type RequestFormValues = z.infer<typeof formSchema>;

interface Props {
  mode: 'create' | 'edit';
  references: {
    channels: Channel[];
    programs: Program[];
    stages: PipelineStage[];
    goals: PromoGoal[];
    promoTypes: PromoType[];
    projects: Project[];
    profiles: Profile[];
  };
  currentUser: { id: string; full_name: string; email: string };
  /** Present when editing. */
  initialValues?: Partial<RequestFormValues> & { id: string };
  /**
   * Fields to preselect when creating from a deep link, e.g. landing on
   * /requests/new?project=X from a project page. Merged over the defaults, so
   * anything not named keeps its normal default.
   */
  preselect?: Partial<RequestFormValues>;
  /** Participant ids when editing, so the picker starts populated. */
  initialParticipantIds?: string[];
}

export function RequestForm({
  mode,
  references,
  currentUser,
  initialValues,
  preselect,
  initialParticipantIds = [],
}: Props) {
  // Both actions share the ActionResult signature, so the union of the two
  // resolves cleanly. `FormState` keeps the state loosely typed for reading
  // `fieldErrors` while still inferring the form action.
  const [state, formAction, isPending] = useActionState(
    mode === 'create' ? createRequestAction : updateRequestAction,
    null,
  ) as [FormState, (formData: FormData) => void, boolean];

  const defaults = useMemo<RequestFormValues>(() => {
    // Editing wins: the stored record is authoritative.
    if (initialValues) return initialValues as RequestFormValues;

    const fresh: RequestFormValues = {
      title: '',
      request_date: todayIso(),
      requested_by_id: currentUser.id,
      requested_by_name: currentUser.full_name,
      company_department: '',
      project_id: null,
      program_id: null,
      channel_id: null,
      goal_id: null,
      promo_type_id: null,
      episodes_count: null,
      priority: 'normal',
      due_date: null,
      assigned_to_id: null,
      shift_count: 1,
      production_start_date: null,
      production_end_date: null,
      call_time: null,
      location: '',
      notes: '',
      special_instructions: '',
      internal_notes: '',
      promo_goal: '',
      target_audience: '',
      promo_description: '',
      key_message: '',
      required_deliverables: '',
      duration_seconds: null,
      format: '',
      language: '',
      version: '',
      stage_id: references.stages.find((s) => s.key === 'new')?.id ?? references.stages[0]?.id ?? '',
    };

    // Merge last so a deep link can preselect without clobbering the defaults
    // it does not mention.
    return preselect ? { ...fresh, ...preselect } : fresh;
  }, [initialValues, preselect, currentUser, references.stages]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<RequestFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: defaults,
    mode: 'onBlur',
  });

  // Surface the success toast once the server confirms.
  useEffect(() => {
    if (state?.ok && state.message) toast.success(state.message);
  }, [state]);

  const channelId = watch('channel_id');
  const programId = watch('program_id');
  const shiftCount = watch('shift_count');

  // Selecting a channel narrows the program list; picking a program then
  // fills in its own channel.
  const programOptions = useMemo(() => {
    const active = references.programs.filter((p) => p.status !== 'archived');
    return channelId ? active.filter((p) => p.channel_id === channelId) : active;
  }, [references.programs, channelId]);

  const selectedProgram = programOptions.find((p) => p.id === programId);
  const selectedChannel = references.channels.find((c) => c.id === channelId);

  return (
    <form action={formAction} className="space-y-6" onSubmit={handleSubmit(() => {})}>
      {initialValues && <input type="hidden" name="id" value={initialValues.id} />}

      <PageHeader
        title={mode === 'create' ? 'New Promo Request' : 'Edit Promo Request'}
        description={
          mode === 'create'
            ? 'All three sections are saved together. Shifts are created automatically from the shift count.'
            : 'Changes are recorded in the activity log with your name and the time.'
        }
        actions={
          <>
            <Button asChild variant="ghost" size="sm">
              <Link href={initialValues ? `/requests/${initialValues.id}` : '/requests'}>
                <ArrowLeft className="size-4" />
                Cancel
              </Link>
            </Button>
            <Button type="submit" size="sm" isLoading={isPending}>
              <Save className="size-4" />
              {mode === 'create' ? 'Create request' : 'Save changes'}
            </Button>
          </>
        }
      />

      {state && !state.ok && !state.fieldErrors && (
        <Alert variant="error">
          <AlertTitle>Could not save</AlertTitle>
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* ---------------- Basic information ---------------- */}
          <FormSection title="Basic Information" description="Who is asking, for what, and by when">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Promo / Project Name" required error={errors.title?.message} className="sm:col-span-2">
                <Input
                  {...register('title')}
                  placeholder="Christmas Special Promo"
                  aria-invalid={Boolean(errors.title)}
                  autoFocus={mode === 'create'}
                />
              </Field>

              <Field label="Request Date" required error={errors.request_date?.message}>
                <Input type="date" {...register('request_date')} />
              </Field>

              <Field label="Due Date" error={errors.due_date?.message}>
                <Input type="date" {...register('due_date')} />
              </Field>

              <Field label="Requested By" error={errors.requested_by_id?.message}>
                <Select
                  value={(watch('requested_by_id') as string) ?? NONE}
                  onValueChange={(v) =>
                    setValue('requested_by_id', v === NONE ? null : v, { shouldValidate: true })
                  }
                >
                  <SelectTrigger aria-label="Requested by">
                    <SelectValue placeholder="Select a person" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Me ({currentUser.full_name})</SelectItem>
                    {references.profiles.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input type="hidden" {...register('requested_by_id')} />
              </Field>

              <Field label="Company / Department" error={errors.company_department?.message}>
                <Input {...register('company_department')} placeholder="Promo Department" />
              </Field>

              <Field label="Project" error={errors.project_id?.message}>
                <Select
                  value={(watch('project_id') as string) ?? NONE}
                  onValueChange={(v) => setValue('project_id', v === NONE ? null : v)}
                >
                  <SelectTrigger aria-label="Project">
                    <SelectValue placeholder="No project" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>No project</SelectItem>
                    {references.projects
                      .filter((p) => p.status === 'active')
                      .map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.code ? `${p.code} · ${p.name}` : p.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <input type="hidden" {...register('project_id')} />
              </Field>

              <Field label="Program" error={errors.program_id?.message}>
                <Select
                  value={(watch('program_id') as string) ?? NONE}
                  onValueChange={(v) => {
                    const id = v === NONE ? null : v;
                    setValue('program_id', id);
                    const program = references.programs.find((p) => p.id === id);
                    if (program?.channel_id) {
                      setValue('channel_id', program.channel_id, { shouldValidate: true });
                    }
                  }}
                >
                  <SelectTrigger aria-label="Program">
                    <SelectValue placeholder="Select a program" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>No program</SelectItem>
                    {programOptions.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input type="hidden" {...register('program_id')} />
              </Field>

              <Field
                label="Channel"
                required={Boolean(programId)}
                error={errors.channel_id?.message}
              >
                <Select
                  value={(watch('channel_id') as string) ?? NONE}
                  onValueChange={(v) =>
                    setValue('channel_id', v === NONE ? null : v, { shouldValidate: true })
                  }
                >
                  <SelectTrigger aria-label="Channel">
                    <SelectValue placeholder="Select a channel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>No channel</SelectItem>
                    {references.channels
                      .filter((c) => c.status === 'active')
                      .map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <input type="hidden" {...register('channel_id')} />
              </Field>

              <Field label="Number of Episodes" error={errors.episodes_count?.message}>
                <Input type="number" min={0} {...register('episodes_count')} placeholder="e.g. 10" />
              </Field>

              <Field label="Promo Type" error={errors.promo_type_id?.message}>
                <Select
                  value={(watch('promo_type_id') as string) ?? NONE}
                  onValueChange={(v) => setValue('promo_type_id', v === NONE ? null : v)}
                >
                  <SelectTrigger aria-label="Promo type">
                    <SelectValue placeholder="Select a type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Not specified</SelectItem>
                    {references.promoTypes.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input type="hidden" {...register('promo_type_id')} />
              </Field>

              <Field label="Request Goal" error={errors.goal_id?.message} description="Reportable">
                <Select
                  value={(watch('goal_id') as string) ?? NONE}
                  onValueChange={(v) => setValue('goal_id', v === NONE ? null : v)}
                >
                  <SelectTrigger aria-label="Request goal">
                    <SelectValue placeholder="Select a goal" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Not specified</SelectItem>
                    {references.goals.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input type="hidden" {...register('goal_id')} />
              </Field>
            </div>

            <Field label="Priority" error={errors.priority?.message}>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Priority">
                {PRIORITY_ORDER.map((p) => (
                  <label
                    key={p}
                    className={cn(
                      'cursor-pointer rounded-full px-3 py-1.5 text-xs font-medium transition-all',
                      'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
                      PRIORITY_META[p].badge,
                      watch('priority') === p && 'ring-2 ring-primary',
                    )}
                  >
                    <input type="radio" value={p} {...register('priority')} className="sr-only" />
                    {PRIORITY_META[p].label}
                  </label>
                ))}
              </div>
            </Field>
          </FormSection>

          {/* ---------------- Production information ---------------- */}
          <FormSection title="Production Information" description="Who is working on it, and when">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Assigned To"
                error={errors.assigned_to_id?.message}
                description="Accountable producer"
              >
                <Select
                  value={(watch('assigned_to_id') as string) ?? NONE}
                  onValueChange={(v) => setValue('assigned_to_id', v === NONE ? null : v)}
                >
                  <SelectTrigger aria-label="Assigned to">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Unassigned</SelectItem>
                    {references.profiles.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.full_name}
                        {p.job_title ? ` — ${p.job_title}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input type="hidden" {...register('assigned_to_id')} />
              </Field>

              <Field
                label="Number of Shifts"
                required
                error={errors.shift_count?.message}
                description={`${shiftCount || 0} shift${shiftCount === 1 ? '' : 's'} created`}
              >
                <Input type="number" min={0} max={60} {...register('shift_count')} />
              </Field>

              <Field label="Production Start" error={errors.production_start_date?.message}>
                <Input type="date" {...register('production_start_date')} />
              </Field>

              <Field label="Production End" error={errors.production_end_date?.message}>
                <Input type="date" {...register('production_end_date')} />
              </Field>

              <Field label="Call Time" error={errors.call_time?.message}>
                <Input type="time" {...register('call_time')} />
              </Field>

              <Field label="Location" error={errors.location?.message}>
                <Input {...register('location')} placeholder="Studio A / Location" />
              </Field>
            </div>

            <Field label="Notes" error={errors.notes?.message}>
              <Textarea {...register('notes')} rows={3} placeholder="General notes for the production team" />
            </Field>

            <Field label="Special Instructions" error={errors.special_instructions?.message}>
              <Textarea
                {...register('special_instructions')}
                rows={3}
                placeholder="Anything unusual the crew needs to know"
              />
            </Field>

            <Field label="Internal Notes" error={errors.internal_notes?.message} description="SAT-7 staff only">
              <Textarea {...register('internal_notes')} rows={2} />
            </Field>

            {mode === 'create' ? (
              <Field label="Participants" description="People helping on this request">
                <UserMultiSelect
                  name="participant_ids"
                  profiles={references.profiles}
                  defaultValue={[]}
                  responsibilities={COMMON_RESPONSIBILITIES}
                />
              </Field>
            ) : (
              // `updateRequestAction` does not touch participants, so offering
              // a picker here would silently discard whatever was selected.
              // Say where they are managed instead.
              <Field
                label="Participants"
                description="Manage the team on the request’s People tab, where each person’s responsibility can be set."
              >
                <p className="text-sm text-muted-foreground">
                  {initialParticipantIds.length === 0
                    ? 'Nobody has been added to this request yet.'
                    : `${initialParticipantIds.length} ${initialParticipantIds.length === 1 ? 'person' : 'people'} on this request.`}
                </p>
              </Field>
            )}
          </FormSection>

          {/* ---------------- Promo information ---------------- */}
          <FormSection title="Promo Information" description="What is being promoted, and for whom">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Duration (seconds)" error={errors.duration_seconds?.message}>
                <Input type="number" min={0} {...register('duration_seconds')} placeholder="30" />
              </Field>

              <Field label="Format" error={errors.format?.message}>
                <Input {...register('format')} placeholder="16:9, 9:16, 1:1…" />
              </Field>

              <Field label="Language" error={errors.language?.message}>
                <Input {...register('language')} placeholder="Arabic, English, French…" />
              </Field>

              <Field label="Version" error={errors.version?.message}>
                <Input {...register('version')} placeholder="v1" />
              </Field>
            </div>

            <Field label="Promo Goal" error={errors.promo_goal?.message}>
              <Textarea {...register('promo_goal')} rows={2} placeholder="What should this promo achieve?" />
            </Field>

            <Field label="Target Audience" error={errors.target_audience?.message}>
              <Input {...register('target_audience')} placeholder="e.g. Adults 25-54, families" />
            </Field>

            <Field label="Promo Description" error={errors.promo_description?.message}>
              <Textarea {...register('promo_description')} rows={3} />
            </Field>

            <Field label="Key Message" error={errors.key_message?.message}>
              <Textarea {...register('key_message')} rows={2} />
            </Field>

            <Field label="Required Deliverables" error={errors.required_deliverables?.message}>
              <Textarea
                {...register('required_deliverables')}
                rows={2}
                placeholder="One 30s promo spot, three social cutdowns…"
              />
            </Field>
          </FormSection>
        </div>

        {/* ---------------- Sidebar ---------------- */}
        <div className="space-y-4">
          <div className="space-y-4 rounded-xl border bg-card p-5 lg:sticky lg:top-20">
            <div>
              <h2 className="text-sm font-semibold">Workflow</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                New requests normally start at “New”.
              </p>
            </div>

            <Field label="Status" required error={errors.stage_id?.message}>
              <Select
                value={(watch('stage_id') as string) ?? ''}
                onValueChange={(v) => setValue('stage_id', v, { shouldValidate: true })}
              >
                <SelectTrigger aria-label="Request status">
                  <SelectValue placeholder="Select a status" />
                </SelectTrigger>
                <SelectContent>
                  {references.stages.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input type="hidden" {...register('stage_id')} />
            </Field>

            <Separator />

            <div className="space-y-2 text-xs">
              <SummaryRow label="Reference" value="Generated on save" />
              <SummaryRow label="Shifts" value={`${shiftCount || 0} created automatically`} />
              <SummaryRow label="Program" value={selectedProgram?.name ?? '—'} />
              <SummaryRow label="Channel" value={selectedChannel?.name ?? '—'} />
              <SummaryRow label="Requester" value={currentUser.full_name} />
            </div>

            <Alert variant="info" className="text-xs">
              <Info className="size-4" />
              <AlertDescription className="text-xs">
                Every status change, assignment and note is written to the activity log with your
                name and a timestamp.
              </AlertDescription>
            </Alert>

            <Button type="submit" className="w-full" isLoading={isPending}>
              <Save className="size-4" />
              {mode === 'create' ? 'Create request' : 'Save changes'}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-xl border bg-card p-5">
      <div>
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  error,
  description,
  required,
  className,
  children,
}: {
  label: string;
  error?: string;
  description?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-baseline justify-between gap-2">
        <Label className="text-xs font-medium">
          {label}
          {required && (
            <span className="ml-0.5 text-destructive" aria-hidden>
              *
            </span>
          )}
        </Label>
        {description && <span className="text-[11px] text-muted-foreground">{description}</span>}
      </div>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="truncate font-medium text-foreground">{value}</span>
    </div>
  );
}