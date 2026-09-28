"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  closestCorners,
  defaultDropAnimationSideEffects,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  useSensor,
  useSensors,
  type DragCancelEvent,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type DropAnimation,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AlertTriangle, CheckCircle2, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AddJobDialog } from "@/features/jobs/add-job-dialog";
import { ArchiveMoveDialog } from "@/features/jobs/archive-move-dialog";
import { BoardColumn } from "@/features/jobs/board-column";
import { BoardToolbar } from "@/features/jobs/board-toolbar";
import { ColumnCreateDialog } from "@/features/jobs/column-dialog";
import { JobCardSurface } from "@/features/jobs/job-card";
import { JobDrawer } from "@/features/jobs/job-drawer";
import {
  getFilteredCrossColumnTargetIndex,
  isNoUpdate14DaysJob,
  sortJobsForColumn,
  type JobSortMode,
} from "@/features/jobs/job-helpers";
import { moveJobToColumn } from "@/lib/db";
import { DEFAULT_COLUMN_IDS, type ArchivedReason } from "@/lib/schemas";
import { useNow } from "@/lib/use-now";
import { useBoardData, type BoardJob } from "@/lib/use-jobs";
import { useApplylineUiStore } from "@/store/applyline-ui-store";

const dropAnimation: DropAnimation = {
  duration: 160,
  easing: "cubic-bezier(0.22, 1, 0.36, 1)",
  keyframes({ transform }) {
    const settledTransform = {
      ...transform.initial,
      scaleX: transform.initial.scaleX * 0.985,
      scaleY: transform.initial.scaleY * 0.985,
    };

    return [
      {
        opacity: 1,
        transform: CSS.Transform.toString(transform.initial),
      },
      {
        opacity: 0,
        transform: CSS.Transform.toString(settledTransform),
      },
    ];
  },
  sideEffects: defaultDropAnimationSideEffects({
    styles: {
      active: { opacity: "0" },
    },
  }),
};

const measuring = {
  droppable: {
    strategy: MeasuringStrategy.Always,
  },
};

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);

    updatePreference();
    mediaQuery.addEventListener("change", updatePreference);
    return () => mediaQuery.removeEventListener("change", updatePreference);
  }, []);

  return prefersReducedMotion;
}

function getColumnSort(columnSorts: Record<string, JobSortMode>, columnId: string) {
  return columnSorts[columnId] ?? "latest";
}

function getColumnJobs(jobs: BoardJob[], columnId: string, sort: JobSortMode) {
  return sortJobsForColumn(jobs.filter((job) => job.columnId === columnId), sort);
}

function getTargetIndex({
  activeJob,
  allJobs,
  columnSorts,
  overId,
  targetColumnId,
}: {
  activeJob: BoardJob;
  allJobs: BoardJob[];
  columnSorts: Record<string, JobSortMode>;
  overId: string;
  targetColumnId: string;
}) {
  const targetColumnJobs = getColumnJobs(
    allJobs,
    targetColumnId,
    getColumnSort(columnSorts, targetColumnId),
  );

  if (overId.startsWith("column:")) {
    return targetColumnJobs.filter((job) => job.id !== activeJob.id).length;
  }

  const overIndex = targetColumnJobs.findIndex((job) => job.id === overId);

  if (overIndex < 0) {
    return targetColumnJobs.length;
  }

  if (activeJob.columnId === targetColumnId) {
    const activeIndex = targetColumnJobs.findIndex((job) => job.id === activeJob.id);
    const reorderedJobs = arrayMove(targetColumnJobs, activeIndex, overIndex);

    return reorderedJobs.findIndex((job) => job.id === activeJob.id);
  }

  return overIndex;
}

type PendingMove = {
  jobId: string;
  targetColumnId: string;
  targetIndex: number;
};

type DropPreview = {
  columnId: string;
  index: number;
};

type BoardToast = {
  message: string;
  type: "error" | "success";
};

function getDropPreview({
  activeJob,
  visibleJobs,
  columnSorts,
  overId,
}: {
  activeJob: BoardJob;
  visibleJobs: BoardJob[];
  columnSorts: Record<string, JobSortMode>;
  overId: string;
}): DropPreview | null {
  const overJob = visibleJobs.find((job) => job.id === overId);
  const targetColumnId = overId.startsWith("column:")
    ? overId.replace("column:", "")
    : overJob?.columnId;

  if (!targetColumnId || targetColumnId === activeJob.columnId) {
    return null;
  }

  const visibleTargetJobs = getColumnJobs(
    visibleJobs,
    targetColumnId,
    getColumnSort(columnSorts, targetColumnId),
  );
  const visibleOverIndex = overId.startsWith("column:")
    ? visibleTargetJobs.length
    : visibleTargetJobs.findIndex((job) => job.id === overId);

  return {
    columnId: targetColumnId,
    index: visibleOverIndex < 0 ? visibleTargetJobs.length : visibleOverIndex,
  };
}

export function BoardPage() {
  const {
    activities,
    columns,
    companies,
    contacts,
    jobContacts,
    jobs,
    sources,
    isLoading,
    error,
  } = useBoardData();
  const activeJobId = useApplylineUiStore((state) => state.activeJobId);
  const columnSorts = useApplylineUiStore((state) => state.columnSorts);
  const setColumnSort = useApplylineUiStore((state) => state.setColumnSort);
  const now = useNow();
  const [search, setSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState("");
  const [selectedSource, setSelectedSource] = useState("");
  const [computedFilter, setComputedFilter] = useState("");
  const [activeDragJobId, setActiveDragJobId] = useState<string | null>(null);
  const [dropPreview, setDropPreview] = useState<DropPreview | null>(null);
  const [isCreatingColumn, setIsCreatingColumn] = useState(false);
  const [pendingArchiveMove, setPendingArchiveMove] = useState<PendingMove | null>(null);
  const [toast, setToast] = useState<BoardToast | null>(null);
  const dropPreviewRef = useRef<DropPreview | null>(null);
  const lastOverIdRef = useRef<string | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const tags = useMemo(
    () =>
      Array.from(new Set(jobs.flatMap((job) => job.tags)))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b)),
    [jobs],
  );
  const filteredJobs = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();

    return jobs.filter((job) => {
      const matchesSearch =
        !normalizedSearch ||
        [job.title, job.companyName, job.location, job.sourceName]
          .filter(Boolean)
          .some((value) => value!.toLocaleLowerCase().includes(normalizedSearch));
      const matchesTag = !selectedTag || job.tags.includes(selectedTag);
      const matchesSource = !selectedSource || job.sourceId === selectedSource;
      const matchesComputedFilter =
        computedFilter !== "no-update-14-days" || isNoUpdate14DaysJob(job);

      return matchesSearch && matchesTag && matchesSource && matchesComputedFilter;
    });
  }, [computedFilter, jobs, search, selectedSource, selectedTag]);
  const hasActiveFilters = Boolean(
    search.trim() || selectedTag || selectedSource || computedFilter,
  );
  const activeJob = jobs.find((job) => job.id === activeJobId) ?? null;
  const activeDragJob = jobs.find((job) => job.id === activeDragJobId) ?? null;

  useEffect(() => {
    const rawToast = sessionStorage.getItem("applyline:toast");

    if (!rawToast) {
      return;
    }

    sessionStorage.removeItem("applyline:toast");

    try {
      const parsedToast = JSON.parse(rawToast) as Partial<BoardToast>;

      if (
        (parsedToast.type === "success" || parsedToast.type === "error") &&
        parsedToast.message
      ) {
        setToast({ type: parsedToast.type, message: parsedToast.message });
      }
    } catch {
      return;
    }
  }, []);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeoutId = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  function onDragStart(event: DragStartEvent) {
    lastOverIdRef.current = null;
    setActiveDragJobId(event.active.id.toString());
    updateDropPreview(null);
  }

  function updateDropPreview(nextPreview: DropPreview | null) {
    const currentPreview = dropPreviewRef.current;

    if (
      currentPreview?.columnId === nextPreview?.columnId &&
      currentPreview?.index === nextPreview?.index
    ) {
      return;
    }

    dropPreviewRef.current = nextPreview;
    setDropPreview(nextPreview);
  }

  function reportMoveError(
    error: unknown,
    context: {
      isFiltered: boolean;
      jobId: string;
      targetColumnId: string;
      targetIndex: number;
    },
  ) {
    console.error("[BoardPage] moveJobToColumn failed", {
      ...context,
      error,
    });
    setToast({
      type: "error",
      message: "The job could not be moved. Your board was not changed.",
    });
  }

  function onDragCancel(_event: DragCancelEvent) {
    lastOverIdRef.current = null;
    setActiveDragJobId(null);
    updateDropPreview(null);
  }

  function onDragOver(event: DragOverEvent) {
    const { active, over } = event;

    if (!over) {
      lastOverIdRef.current = null;
      updateDropPreview(null);
      return;
    }

    lastOverIdRef.current = over.id.toString();

    const activeJob = jobs.find((job) => job.id === active.id);

    if (!activeJob) {
      lastOverIdRef.current = null;
      updateDropPreview(null);
      return;
    }

    const nextPreview = getDropPreview({
      activeJob,
      visibleJobs: filteredJobs,
      columnSorts,
      overId: over.id.toString(),
    });

    updateDropPreview(nextPreview);
  }

  async function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    const overId = over?.id.toString() ?? lastOverIdRef.current;

    if (!overId) {
      lastOverIdRef.current = null;
      setActiveDragJobId(null);
      updateDropPreview(null);
      return;
    }

    const activeJob = jobs.find((job) => job.id === active.id);

    if (!activeJob) {
      lastOverIdRef.current = null;
      setActiveDragJobId(null);
      updateDropPreview(null);
      return;
    }

    const overJob = jobs.find((job) => job.id === overId);
    const targetColumnId = overId.startsWith("column:")
      ? overId.replace("column:", "")
      : overJob?.columnId;

    if (!targetColumnId) {
      lastOverIdRef.current = null;
      setActiveDragJobId(null);
      updateDropPreview(null);
      return;
    }

    if (hasActiveFilters && targetColumnId === activeJob.columnId) {
      lastOverIdRef.current = null;
      setActiveDragJobId(null);
      updateDropPreview(null);
      return;
    }

    const targetIndex = hasActiveFilters
      ? getFilteredCrossColumnTargetIndex({
          activeJobId: activeJob.id,
          jobs,
          overId,
          targetColumnId,
        })
      : getTargetIndex({
          activeJob,
          allJobs: jobs,
          columnSorts,
          overId,
          targetColumnId,
        });

    if (
      targetColumnId === DEFAULT_COLUMN_IDS.archived &&
      activeJob.columnId !== DEFAULT_COLUMN_IDS.archived
    ) {
      lastOverIdRef.current = null;
      setActiveDragJobId(null);
      updateDropPreview(null);
      setPendingArchiveMove({
        jobId: activeJob.id,
        targetColumnId,
        targetIndex,
      });
      return;
    }

    try {
      await moveJobToColumn(activeJob.id, targetColumnId, { targetIndex });
    } catch (moveError) {
      reportMoveError(moveError, {
        isFiltered: hasActiveFilters,
        jobId: activeJob.id,
        targetColumnId,
        targetIndex,
      });
    } finally {
      lastOverIdRef.current = null;
      setActiveDragJobId(null);
      updateDropPreview(null);
    }
  }

  async function confirmArchiveMove(archivedReason?: ArchivedReason) {
    if (!pendingArchiveMove) {
      return;
    }

    try {
      await moveJobToColumn(pendingArchiveMove.jobId, pendingArchiveMove.targetColumnId, {
        archivedReason,
        targetIndex: pendingArchiveMove.targetIndex,
      });
    } catch (moveError) {
      reportMoveError(moveError, {
        isFiltered: hasActiveFilters,
        jobId: pendingArchiveMove.jobId,
        targetColumnId: pendingArchiveMove.targetColumnId,
        targetIndex: pendingArchiveMove.targetIndex,
      });
    } finally {
      setPendingArchiveMove(null);
    }
  }

  if (error) {
    return (
      <div className="rounded-lg border bg-card p-5 text-sm text-destructive shadow-sm">
        {error.message}
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100dvh-7rem)] min-h-0 max-h-[calc(100dvh-7rem)] flex-col gap-5 overflow-hidden">
      {toast ? (
        <div
          className={
            toast.type === "error"
              ? "flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive shadow-sm"
              : "flex items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary shadow-sm"
          }
          role={toast.type === "error" ? "alert" : "status"}
        >
          <div className="flex items-center gap-2">
            {toast.type === "error" ? (
              <AlertTriangle className="size-4" />
            ) : (
              <CheckCircle2 className="size-4" />
            )}
            <span className="font-medium">{toast.message}</span>
          </div>
          <Button
            aria-label="Dismiss notification"
            className={
              toast.type === "error"
                ? "size-7 text-destructive hover:bg-destructive/10"
                : "size-7 text-primary hover:bg-primary/10"
            }
            onClick={() => setToast(null)}
            size="icon"
            variant="ghost"
          >
            <X />
          </Button>
        </div>
      ) : null}
      <BoardToolbar
        computedFilter={computedFilter}
        jobCount={filteredJobs.length}
        onComputedFilterChange={setComputedFilter}
        onCreateColumn={() => setIsCreatingColumn(true)}
        onSearchChange={setSearch}
        onSourceChange={setSelectedSource}
        onTagChange={setSelectedTag}
        search={search}
        selectedSource={selectedSource}
        selectedTag={selectedTag}
        sources={sources}
        tags={tags}
      />
      {isLoading ? (
        <div className="flex min-w-0 max-w-full gap-3 overflow-hidden pb-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              className="h-[32rem] w-[19rem] shrink-0 animate-pulse rounded-lg border bg-muted/45"
              key={index}
            />
          ))}
        </div>
      ) : columns.length === 0 ? (
        <div className="grid min-h-[24rem] place-items-center rounded-lg border border-dashed bg-card/70 p-8 text-center">
          <div>
            <h2 className="text-lg font-semibold">Create your first column</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Columns keep applications moving from wishlist to offer.
            </p>
            <Button className="mt-4" onClick={() => setIsCreatingColumn(true)}>
              <Plus />
              Create column
            </Button>
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-hidden">
          <DndContext
            collisionDetection={closestCorners}
            measuring={measuring}
            onDragCancel={onDragCancel}
            onDragEnd={onDragEnd}
            onDragOver={onDragOver}
            onDragStart={onDragStart}
            sensors={sensors}
          >
            <div className="flex h-full min-h-0 min-w-0 items-stretch gap-3 overflow-x-auto overflow-y-hidden pb-4 [scrollbar-width:thin]">
              {columns.map((column) => {
                const columnSort = getColumnSort(columnSorts, column.id);
                const columnJobs = getColumnJobs(filteredJobs, column.id, columnSort);

                return (
                  <BoardColumn
                    activeDragJobId={activeDragJobId}
                    column={column}
                    columns={columns}
                    dropPreviewIndex={dropPreview?.columnId === column.id ? dropPreview.index : null}
                    jobCount={columnJobs.length}
                    jobs={columnJobs}
                    key={column.id}
                    now={now}
                    onSortChange={setColumnSort}
                    prefersReducedMotion={prefersReducedMotion}
                    sort={columnSort}
                  />
                );
              })}
            </div>
            <DragOverlay
              className="pointer-events-none"
              dropAnimation={prefersReducedMotion || dropPreview ? null : dropAnimation}
              zIndex={60}
            >
              {activeDragJob ? <JobCardSurface isOverlay job={activeDragJob} now={now} /> : null}
            </DragOverlay>
          </DndContext>
        </div>
      )}
      <JobDrawer
        activities={activities}
        columns={columns}
        companies={companies}
        contacts={contacts}
        job={activeJob}
        jobContacts={jobContacts}
        jobs={jobs}
        sources={sources}
      />
      <AddJobDialog columns={columns} companies={companies} jobs={jobs} sources={sources} />
      <ColumnCreateDialog open={isCreatingColumn} onOpenChange={setIsCreatingColumn} />
      <ArchiveMoveDialog
        job={jobs.find((job) => job.id === pendingArchiveMove?.jobId) ?? null}
        onCancel={() => setPendingArchiveMove(null)}
        onConfirm={confirmArchiveMove}
        open={Boolean(pendingArchiveMove)}
      />
    </div>
  );
}
