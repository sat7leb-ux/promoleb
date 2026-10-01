'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { motion } from 'framer-motion';
import { CalendarDays, Clock, GripVertical, Plus, Search, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/shared/page-header';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { changeStageAction } from '@/lib/actions/requests';
import { DUE_STATE_META, PRIORITY_META } from '@/lib/constants';
import { formatDate, cn } from '@/lib/utils';
import type { RequestListItem } from '@/lib/queries/requests';
import type { Channel, PipelineStage } from '@/types/database';

interface Props {
  rows: RequestListItem[];
  stages: PipelineStage[];
  channels: Channel[];
  canChangeStatus: boolean;
  currentUserId: string;
}

/**
 * Kanban board.
 *
 * Columns come from `pipeline_stages`, so an administrator can rename, add or
 * reorder stages in Settings and the board follows without a code change.
 *
 * Drag-and-drop is pointer-based. The keyboard-accessible path to changing a
 * stage is the status dropdown on the request page, which is fully operable by
 * keyboard, so the board is not the only route to that action.
 *
 * Each drop calls the server action; the optimistic local move is rolled back
 * if the write fails, so the board never shows a state the database rejected.
 */
export function PipelineBoard({
  rows,
  stages,
  channels,
  canChangeStatus,
  currentUserId,
}: Props) {
  const router = useRouter();
  const [term, setTerm] = useState('');
  const [channelFilter, setChannelFilter] = useState('__all__');
  const [mineOnly, setMineOnly] = useState(false);

  const [items, setItems] = useState<RequestListItem[]>(rows);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const visible = useMemo(() => {
    const needle = term.trim().toLowerCase();
    return items.filter((item) => {
      if (channelFilter !== '__all__' && item.channel?.id !== channelFilter) return false;
      if (mineOnly && item.assigned_to?.id !== currentUserId) return false;
      if (!needle) return true;
      return (
        item.title.toLowerCase().includes(needle) ||
        (item.request_code ?? '').toLowerCase().includes(needle) ||
        (item.program?.name ?? '').toLowerCase().includes(needle) ||
        (item.channel?.name ?? '').toLowerCase().includes(needle) ||
        (item.assigned_to?.full_name ?? '').toLowerCase().includes(needle)
      );
    });
  }, [items, term, channelFilter, mineOnly, currentUserId]);

  const byStage = useMemo(() => {
    const map = new Map<string, RequestListItem[]>();
    for (const stage of stages) map.set(stage.id, []);
    for (const item of visible) {
      const bucket = map.get(item.stage_id);
      if (bucket) bucket.push(item);
    }
    return map;
  }, [visible, stages]);

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);

    const requestId = String(event.active.id);
    const stageId = event.over ? String(event.over.id) : null;
    if (!stageId) return;

    const current = items.find((i) => i.id === requestId);
    if (!current || current.stage_id === stageId) return;

    const previousStageId = current.stage_id;
    const targetStage = stages.find((s) => s.id === stageId);

    setItems((prev) =>
      prev.map((i) =>
        i.id === requestId
          ? {
              ...i,
              stage_id: stageId,
              stage_name: targetStage?.name ?? i.stage_name,
              stage_position: targetStage?.position ?? i.stage_position,
              stage: targetStage
                ? {
                    id: targetStage.id,
                    name: targetStage.name,
                    position: targetStage.position,
                    color: targetStage.color,
                  }
                : i.stage,
            }
          : i,
      ),
    );

    startTransition(async () => {
      const result = await changeStageAction(requestId, stageId);

      if (result.ok) {
        toast.success(`Moved to ${targetStage?.name ?? 'new stage'}`);
        router.refresh();
      } else {
        setItems((prev) =>
          prev.map((i) => (i.id === requestId ? { ...i, stage_id: previousStageId } : i)),
        );
        toast.error(result.error);
      }
    });
  }

  const activeItem = activeId ? items.find((i) => i.id === activeId) : null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Pipeline"
        description="Every request moving through the workflow. Drag a card to change its stage."
        actions={
          <Button asChild size="sm">
            <Link href="/requests/new">
              <Plus className="size-4" />
              New request
            </Link>
          </Button>
        }
      />

      <div className="flex flex-col gap-2 rounded-xl border bg-card p-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Filter cards…"
            aria-label="Filter cards"
            className="pl-9"
          />
        </div>

        <Select value={channelFilter} onValueChange={setChannelFilter}>
          <SelectTrigger className="h-9 w-full sm:w-[180px]" aria-label="Filter by channel">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All channels</SelectItem>
            {channels
              .filter((c) => c.status === 'active')
              .map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>

        <Button
          variant={mineOnly ? 'secondary' : 'outline'}
          size="sm"
          onClick={() => setMineOnly((v) => !v)}
          aria-pressed={mineOnly}
        >
          <Users className="size-4" />
          Assigned to me
        </Button>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<Search className="size-6" />}
          title="No cards match these filters"
          description="Clear the filters, or create a new promo request."
          action={
            <Button
              variant="outline"
              onClick={() => {
                setTerm('');
                setChannelFilter('__all__');
                setMineOnly(false);
              }}
            >
              Clear filters
            </Button>
          }
        />
      ) : (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-thin">
            {stages.map((stage) => (
              <BoardColumn
                key={stage.id}
                stage={stage}
                items={byStage.get(stage.id) ?? []}
                canDrag={canChangeStatus}
              />
            ))}
          </div>

          <DragOverlay>
            {activeItem ? <KanbanCard request={activeItem} isOverlay /> : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}

function BoardColumn({
  stage,
  items,
  canDrag,
}: {
  stage: PipelineStage;
  items: RequestListItem[];
  canDrag: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  return (
    <section
      className="flex w-[300px] shrink-0 flex-col rounded-xl border bg-card/60"
      aria-label={`${stage.name} — ${items.length} requests`}
    >
      <header
        className={cn(
          'flex items-center justify-between gap-2 border-b px-3.5 py-3',
          isOver && 'bg-accent',
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={cn('size-2 shrink-0 rounded-full', STAGE_DOTS[stage.color] ?? 'bg-slate-400')}
          />
          <h2 className="truncate text-sm font-semibold">{stage.name}</h2>
        </div>
        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
          {items.length}
        </span>
      </header>

      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 space-y-2 p-2.5 transition-colors',
          isOver && 'bg-brand-50/50 dark:bg-brand-950/20',
        )}
      >
        {items.length === 0 ? (
          <p className="px-2 py-8 text-center text-xs text-muted-foreground">
            {canDrag ? 'Drop a card here' : 'Nothing here'}
          </p>
        ) : (
          items.map((item) => <KanbanCard key={item.id} request={item} />)
        )}
      </div>
    </section>
  );
}

function KanbanCard({ request, isOverlay = false }: { request: RequestListItem; isOverlay?: boolean }) {
  const dueMeta = DUE_STATE_META[request.due_state] ?? DUE_STATE_META.on_track;

  return (
    <motion.article
      layout
      initial={isOverlay ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'group rounded-lg border bg-card p-3 shadow-sm transition-shadow hover:shadow-md',
        isOverlay && 'rotate-2 shadow-lg',
      )}
    >
      <div className="flex items-start gap-2">
        <GripVertical
          className="mt-0.5 size-3.5 shrink-0 cursor-grab text-muted-foreground/50 opacity-0 transition-opacity group-hover:opacity-100"
          aria-hidden
        />

        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] text-muted-foreground">{request.request_code ?? '—'}</p>

          <Link
            href={`/requests/${request.id}`}
            className="mt-0.5 block line-clamp-2 rounded text-sm font-medium leading-snug hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {request.title}
          </Link>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {request.channel && (
              <span className="truncate rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {request.channel.name}
              </span>
            )}
            <StatusBadge
              className="px-2 py-0 text-[10px]"
              tone={PRIORITY_META[request.priority].badge}
              label={PRIORITY_META[request.priority].label}
              dot={false}
            />
          </div>

          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t pt-2.5 text-[11px] text-muted-foreground">
            <span className="truncate">{request.assigned_to?.full_name ?? 'Unassigned'}</span>
            <span className="flex shrink-0 items-center gap-2.5">
              <span className="inline-flex items-center gap-0.5" title="Shifts">
                <Clock className="size-3" aria-hidden />
                {request.shift_count}
              </span>
              {request.participant_count > 0 && (
                <span className="inline-flex items-center gap-0.5" title="Participants">
                  <Users className="size-3" aria-hidden />
                  {request.participant_count}
                </span>
              )}
              <span
                className={cn(
                  'inline-flex items-center gap-0.5',
                  request.due_state === 'overdue' && 'font-semibold text-destructive',
                )}
                title={`Due ${formatDate(request.due_date)}`}
              >
                <CalendarDays className="size-3" aria-hidden />
                {formatDate(request.due_date)}
              </span>
            </span>
          </div>

          {request.due_state !== 'on_track' && request.due_state !== 'completed' && (
            <div className="mt-2">
              <StatusBadge
                className="px-2 py-0 text-[10px]"
                tone={dueMeta.badge}
                label={dueMeta.label}
              />
            </div>
          )}
        </div>
      </div>
    </motion.article>
  );
}

const STAGE_DOTS: Record<string, string> = {
  blue: 'bg-blue-500',
  violet: 'bg-violet-500',
  indigo: 'bg-indigo-500',
  cyan: 'bg-cyan-500',
  amber: 'bg-amber-500',
  orange: 'bg-orange-500',
  lime: 'bg-lime-500',
  emerald: 'bg-emerald-500',
  rose: 'bg-rose-500',
  brand: 'bg-brand-500',
  slate: 'bg-slate-400',
};