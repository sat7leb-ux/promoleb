'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Archive,
  CalendarDays,
  ClipboardCopy,
  Clock,
  Copy,
  FileText,
  History,
  Layers,
  MapPin,
  MessageSquare,
  Paperclip,
  Pencil,
  Radio,
  RotateCcw,
  Target,
  Trash2,
  Tv,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { StatusBadge, Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { EmptyState } from '@/components/ui/empty-state';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { UserAvatar, UserChip } from '@/components/shared/user-avatar';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { ShiftsPanel } from '@/components/requests/shifts-panel';
import { ParticipantsPanel } from '@/components/requests/participants-panel';
import { AttachmentsPanel } from '@/components/requests/attachments-panel';
import { ActivityTimeline } from '@/components/shared/activity-timeline';
import {
  changeStageAction,
  archiveRequestAction,
  restoreRequestAction,
  duplicateRequestAction,
} from '@/lib/actions/requests';
import { PRIORITY_META, DUE_STATE_META, SHIFT_STATUS_META } from '@/lib/constants';
import { formatDate, formatDateTime, formatDuration, formatRelative, cn } from '@/lib/utils';
import type {
  RequestDetailData,
  RequestShiftWithUser,
  RequestNoteWithAuthor,
} from '@/lib/queries/details';
import type { Permission } from '@/lib/auth/permissions';
import type {
  Channel,
  PipelineStage,
  Profile,
  Program,
  Project,
  PromoGoal,
  PromoType,
} from '@/types/database';

interface Props {
  detail: RequestDetailData;
  references: {
    channels: Channel[];
    programs: Program[];
    stages: PipelineStage[];
    goals: PromoGoal[];
    promoTypes: PromoType[];
    projects: Project[];
    profiles: Profile[];
  };
  permission: Permission;
  canEdit: boolean;
  currentUserId: string;
  currentUserName: string;
  warning?: string;
}

export function RequestDetailView({
  detail,
  references,
  permission,
  canEdit,
  currentUserId,
  currentUserName,
  warning,
}: Props) {
  const { request, participants, shifts, notes, attachments, activity } = detail;

  const [archiveOpen, setArchiveOpen] = useState(false);

  const isArchived = request.status === 'archived';
  const dueMeta = DUE_STATE_META[request.due_state] ?? DUE_STATE_META.on_track;
  const assignedTo = request.assigned_to;

  /** Aggregates shown in the header strip. */
  const shiftSummary = useMemo(() => {
    const done = shifts.filter((s) => s.status === 'done').length;
    const planned = shifts.filter((s) => s.status === 'planned').length;
    const inProgress = shifts.filter((s) => s.status === 'in_progress').length;
    return { total: shifts.length, done, planned, inProgress };
  }, [shifts]);

  async function handleStageChange(stageId: string) {
    const result = await changeStageAction(request.id, stageId);
    if (result.ok) toast.success(result.message ?? 'Status updated');
    else toast.error(result.error);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={request.title}
        description={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-mono">{request.request_code ?? '—'}</span>
            <span aria-hidden>·</span>
            <span>{request.channel?.name ?? 'No channel'}</span>
            {request.program && (
              <>
                <span aria-hidden>·</span>
                <span>{request.program.name}</span>
              </>
            )}
          </span>
        }
        actions={
          <>
            <Button asChild variant="ghost" size="sm">
              <Link href="/requests">
                <ArrowLeft className="size-4" />
                Back
              </Link>
            </Button>

            {permission.canCreateRequests && <DuplicateButton requestId={request.id} />}

            {canEdit && !isArchived && (
              <Button asChild size="sm">
                <Link href={`/requests/${request.id}/edit`}>
                  <Pencil className="size-4" />
                  Edit
                </Link>
              </Button>
            )}

            {permission.canArchiveRequests &&
              (isArchived ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    const result = await restoreRequestAction(request.id);
                    if (result.ok) toast.success(result.message ?? 'Restored');
                    else toast.error(result.error);
                  }}
                >
                  <RotateCcw className="size-4" />
                  Restore
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setArchiveOpen(true)}>
                  <Archive className="size-4" />
                  Archive
                </Button>
              ))}
          </>
        }
      />

      {warning === 'participants' && (
        <Alert variant="warning">
          <AlertTitle>Request created, but participants were not added</AlertTitle>
          <AlertDescription>
            The request itself was saved. Add participants from the Participants tab below.
          </AlertDescription>
        </Alert>
      )}

      {isArchived && (
        <Alert variant="info">
          <AlertTitle>This request is archived</AlertTitle>
          <AlertDescription>
            Archived requests are excluded from the pipeline and active reports. Restore it to make
            it editable again.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <div className="rounded-xl border bg-card p-5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone={dueMeta.badge} label={dueMeta.label} />
              <StatusBadge
                tone={PRIORITY_META[request.priority].badge}
                label={`${PRIORITY_META[request.priority].label} priority`}
                dot={false}
              />
              {isArchived && (
                <StatusBadge
                  tone="bg-slate-100 text-slate-500 ring-1 ring-inset ring-slate-200 dark:bg-slate-800 dark:text-slate-400"
                  label="Archived"
                />
              )}
            </div>

            <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
              <DetailRow label="Due date" icon={CalendarDays}>
                {formatDate(request.due_date)}
              </DetailRow>
              <DetailRow label="Request date" icon={ClipboardCopy}>
                {formatDate(request.request_date)}
              </DetailRow>
              <DetailRow label="Shifts" icon={Clock}>
                {shiftSummary.total} ({shiftSummary.done} done
                {shiftSummary.inProgress > 0 ? `, ${shiftSummary.inProgress} in progress` : ''})
              </DetailRow>
              <DetailRow label="Production" icon={Radio}>
                {formatDate(request.production_start_date)}
                {request.production_end_date &&
                  ` → ${formatDate(request.production_end_date)}`}
              </DetailRow>
              <DetailRow label="Call time" icon={Clock}>
                {request.call_time ? request.call_time.slice(0, 5) : '—'}
              </DetailRow>
              <DetailRow label="Location" icon={MapPin}>
                {request.location ?? '—'}
              </DetailRow>
              <DetailRow label="Duration" icon={FileText}>
                {formatDuration(request.duration_seconds)}
              </DetailRow>
              <DetailRow label="Language / Format" icon={Layers}>
                {request.language ?? '—'} · {request.format ?? '—'}
              </DetailRow>
              <DetailRow label="Version" icon={FileText}>
                {request.version ?? '—'}
              </DetailRow>
            </dl>

            <Separator className="my-4" />

            {/* chain: project -> program -> channel -> request */}
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <ChainLink
                icon={Layers}
                label="Project"
                value={request.project?.name}
                href={request.project ? `/projects/${request.project.id}` : undefined}
              />
              <ArrowRight className="size-3.5 text-muted-foreground" aria-hidden />
              <ChainLink
                icon={Tv}
                label="Program"
                value={request.program?.name}
                href={request.program ? `/programs/${request.program.id}` : undefined}
              />
              <ArrowRight className="size-3.5 text-muted-foreground" aria-hidden />
              <ChainLink
                icon={Radio}
                label="Channel"
                value={request.channel?.name}
                href={request.channel ? `/channels/${request.channel.id}` : undefined}
              />
              <ArrowRight className="size-3.5 text-muted-foreground" aria-hidden />
              <ChainLink icon={Target} label="Goal" value={request.goal?.name} />
            </div>

            {request.goal?.description && (
              <p className="mt-2 text-xs text-muted-foreground">{request.goal.description}</p>
            )}
          </div>

          <Tabs defaultValue="production">
            <TabsList className="w-full justify-start overflow-x-auto no-scrollbar">
              <TabsTrigger value="production">
                <Radio className="size-3.5" />
                Production
              </TabsTrigger>
              <TabsTrigger value="shifts">
                <Clock className="size-3.5" />
                Shifts ({shifts.length})
              </TabsTrigger>
              <TabsTrigger value="people">
                <Users className="size-3.5" />
                People ({participants.length + (assignedTo ? 1 : 0)})
              </TabsTrigger>
              <TabsTrigger value="files">
                <Paperclip className="size-3.5" />
                Files ({attachments.length})
              </TabsTrigger>
              <TabsTrigger value="notes">
                <MessageSquare className="size-3.5" />
                Notes ({notes.length})
              </TabsTrigger>
              <TabsTrigger value="activity">
                <History className="size-3.5" />
                Activity
              </TabsTrigger>
            </TabsList>

            <TabsContent value="production">
              <div className="space-y-4">
                <InfoCard title="Promo Information">
                  <FieldList
                    items={[
                      ['Promo goal', request.promo_goal],
                      ['Target audience', request.target_audience],
                      ['Description', request.promo_description],
                      ['Key message', request.key_message],
                      ['Required deliverables', request.required_deliverables],
                      ['Promo type', request.promo_type?.name],
                      ['Episodes', request.episodes_count?.toString()],
                    ]}
                  />
                </InfoCard>

                <InfoCard title="Production Notes">
                  <FieldList
                    items={[
                      ['Notes', request.notes],
                      ['Special instructions', request.special_instructions],
                      ['Location', request.location],
                      ['Department', request.company_department],
                    ]}
                  />
                </InfoCard>

                {request.internal_notes && (
                  <InfoCard
                    title="Internal Notes"
                    className="border-amber-200 bg-amber-50/40 dark:border-amber-900 dark:bg-amber-950/20"
                  >
                    <p className="whitespace-pre-wrap text-sm">{request.internal_notes}</p>
                  </InfoCard>
                )}
              </div>
            </TabsContent>

            <TabsContent value="shifts">
              <ShiftsPanel
                requestId={request.id}
                shifts={shifts}
                profiles={references.profiles}
                canEdit={canEdit && !isArchived}
                onChanged={() => toast.success('Shifts saved.')}
              />
            </TabsContent>

            <TabsContent value="people">
              <ParticipantsPanel
                requestId={request.id}
                participants={participants}
                assignedTo={assignedTo}
                profiles={references.profiles}
                canManage={permission.canManageParticipants && !isArchived}
                currentUserId={currentUserId}
              />
            </TabsContent>

            <TabsContent value="files">
              <AttachmentsPanel
                attachments={attachments}
                canUpload={permission.canUploadFiles && !isArchived}
                canDelete={permission.canManageProjects && !isArchived}
                requestId={request.id}
                onError={(message) => toast.error(message)}
              />
            </TabsContent>

            <TabsContent value="notes">
              <NotesPanel
                requestId={request.id}
                notes={notes}
                canPost={!isArchived}
                canDelete={permission.canManageProjects}
                currentUserName={currentUserName}
              />
            </TabsContent>

            <TabsContent value="activity">
              <div className="rounded-xl border bg-card p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-sm font-semibold">Activity history</h2>
                  <Badge variant="outline">{activity.length} events</Badge>
                </div>
                <ActivityTimeline entries={activity} />
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* --- sidebar --- */}
        <aside className="space-y-4">
          <div className="space-y-3 rounded-xl border bg-card p-5">
            <div>
              <h2 className="text-sm font-semibold">Status</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Currently {request.stage_name}
              </p>
            </div>

            {permission.canChangeStatus && canEdit && !isArchived ? (
              <Select value={request.stage_id} onValueChange={handleStageChange}>
                <SelectTrigger aria-label="Change request status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {references.stages.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <StatusBadge tone={stageTone(request.stage?.color)} label={request.stage_name} />
            )}

            {request.completed_at && (
              <p className="text-xs text-muted-foreground">
                Completed {formatDateTime(request.completed_at)}
              </p>
            )}
          </div>

          <div className="space-y-3 rounded-xl border bg-card p-5">
            <h2 className="text-sm font-semibold">Ownership</h2>

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Assigned to</p>
              {assignedTo ? (
                <UserChip name={assignedTo.full_name} avatarUrl={assignedTo.avatar_url} />
              ) : (
                <p className="text-sm text-muted-foreground">Unassigned</p>
              )}
            </div>

            <Separator />

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Requested by</p>
              <UserChip
                name={request.requested_by?.full_name ?? request.requested_by_name}
                avatarUrl={request.requested_by?.avatar_url}
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Participants ({participants.length})
              </p>
              {participants.length === 0 ? (
                <p className="text-sm text-muted-foreground">None added yet</p>
              ) : (
                <ul className="space-y-1.5">
                  {participants.map((p) => (
                    <li key={p.id} className="flex items-center gap-2">
                      <UserAvatar
                        name={p.user?.full_name}
                        avatarUrl={p.user?.avatar_url}
                        className="size-6"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">
                          {p.user?.full_name ?? 'Unknown'}
                        </span>
                        {p.responsibility && (
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {p.responsibility}
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {shifts.length > 0 && (
            <div className="space-y-3 rounded-xl border bg-card p-5">
              <h2 className="text-sm font-semibold">Shift breakdown</h2>
              <ul className="space-y-2 text-sm">
                {(['planned', 'in_progress', 'done', 'cancelled'] as const).map((status) => {
                  const count = shifts.filter((s: RequestShiftWithUser) => s.status === status).length;
                  if (count === 0) return null;
                  return (
                    <li key={status} className="flex items-center justify-between gap-2">
                      <StatusBadge
                        tone={SHIFT_STATUS_META[status].badge}
                        label={SHIFT_STATUS_META[status].label}
                      />
                      <span className="tabular-nums font-medium">{count}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Created {formatRelative(request.created_at)} · last updated{' '}
            {formatRelative(request.updated_at)}
          </p>
        </aside>
      </div>

      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title="Archive this request?"
        description="It will be removed from the pipeline and active reports. You can restore it at any time."
        confirmLabel="Archive request"
        destructive
        onConfirm={() => archiveRequestAction(request.id)}
      />
    </div>
  );
}

// --- small presentational helpers -------------------------------------------

function DetailRow({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3" aria-hidden />
        {label}
      </dt>
      <dd className="mt-0.5 truncate text-sm font-medium">{children}</dd>
    </div>
  );
}

function ChainLink({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value?: string | null;
  href?: string;
}) {
  const content = (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
        value
          ? 'bg-muted hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring'
          : 'bg-muted/50 text-muted-foreground',
      )}
    >
      <Icon className="size-3" aria-hidden />
      {value ?? `No ${label.toLowerCase()}`}
    </span>
  );

  return href ? (
    <Link
      href={href}
      className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {content}
    </Link>
  ) : (
    content
  );
}

function InfoCard({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn('rounded-xl border bg-card p-5', className)}>
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function FieldList({ items }: { items: Array<[string, string | null | undefined]> }) {
  const present = items.filter(([, value]) => value);
  if (present.length === 0) {
    return <p className="text-sm text-muted-foreground">Nothing recorded yet.</p>;
  }

  return (
    <dl className="space-y-3">
      {present.map(([label, value]) => (
        <div key={label}>
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="mt-0.5 whitespace-pre-wrap text-sm">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Notes composer + feed. */
function NotesPanel({
  requestId,
  notes,
  canPost,
  canDelete,
  currentUserName,
}: {
  requestId: string;
  notes: RequestNoteWithAuthor[];
  canPost: boolean;
  canDelete: boolean;
  currentUserName: string;
}) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [isInternal, setIsInternal] = useState(true);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!body.trim()) return;
    setSaving(true);

    const { addNoteAction } = await import('@/lib/actions/requests');
    const result = await addNoteAction(requestId, body, isInternal);
    setSaving(false);

    if (result.ok) {
      setBody('');
      toast.success(result.message ?? 'Note added');
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  async function remove(noteId: string) {
    const { deleteNoteAction } = await import('@/lib/actions/requests');
    const result = await deleteNoteAction(requestId, noteId);
    if (result.ok) {
      toast.success('Note deleted');
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <div className="space-y-4">
      {canPost && (
        <div className="rounded-xl border bg-card p-4">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            placeholder={`Add a note as ${currentUserName}...`}
            aria-label="Note text"
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={isInternal}
                onChange={(e) => setIsInternal(e.target.checked)}
                className="size-3.5 rounded border-input"
              />
              Internal note (hidden from requesters)
            </label>
            <Button size="sm" onClick={submit} disabled={!body.trim()} isLoading={saving}>
              Add note
            </Button>
          </div>
        </div>
      )}

      {notes.length === 0 ? (
        <EmptyState
          icon={<MessageSquare className="size-6" />}
          title="No notes yet"
          description="Notes are timestamped and attributed, so the context behind a request is never lost."
        />
      ) : (
        <ul className="space-y-3">
          {notes.map((note, i) => (
            <motion.li
              key={note.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="rounded-xl border bg-card p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <UserAvatar
                    name={note.author?.full_name}
                    avatarUrl={note.author?.avatar_url}
                    className="size-6"
                  />
                  <div>
                    <p className="text-sm font-medium">{note.author?.full_name ?? 'Unknown user'}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatDateTime(note.created_at)} · {formatRelative(note.created_at)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {note.is_internal && <Badge variant="outline">Internal</Badge>}
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Delete note"
                      onClick={() => void remove(note.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm">{note.body}</p>
            </motion.li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Duplicates the request and navigates to the copy. */
function DuplicateButton({ requestId }: { requestId: string }) {
  const [pending, setPending] = useState(false);

  return (
    <Button
      size="sm"
      variant="outline"
      isLoading={pending}
      onClick={async () => {
        setPending(true);
        const result = await duplicateRequestAction(requestId);
        setPending(false);

        if (result.ok) {
          toast.success('Request duplicated');
          window.location.href = `/requests/${result.data.id}`;
        } else {
          toast.error(result.error);
        }
      }}
    >
      {!pending && <Copy className="size-4" />}
      Duplicate
    </Button>
  );
}

function stageTone(color?: string): string {
  const map: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200 dark:bg-blue-950/40 dark:text-blue-300',
    violet: 'bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200 dark:bg-violet-950/40 dark:text-violet-300',
    indigo: 'bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300',
    cyan: 'bg-cyan-50 text-cyan-700 ring-1 ring-inset ring-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300',
    amber: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300',
    orange: 'bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-200 dark:bg-orange-950/40 dark:text-orange-300',
    lime: 'bg-lime-50 text-lime-700 ring-1 ring-inset ring-lime-200 dark:bg-lime-950/40 dark:text-lime-300',
    emerald: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300',
    rose: 'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300',
    brand: 'bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200 dark:bg-brand-950/50 dark:text-brand-300',
  };
  return (
    map[color ?? 'slate'] ??
    'bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200 dark:bg-slate-800 dark:text-slate-300'
  );
}
