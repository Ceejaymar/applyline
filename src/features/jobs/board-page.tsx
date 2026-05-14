"use client";

import { useMemo, useState } from "react";
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragCancelEvent,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AddJobDialog } from "@/features/jobs/add-job-dialog";
import { ArchiveMoveDialog } from "@/features/jobs/archive-move-dialog";
import { BoardColumn } from "@/features/jobs/board-column";
import { BoardToolbar } from "@/features/jobs/board-toolbar";
import { ColumnCreateDialog } from "@/features/jobs/column-dialog";
import { JobCardSurface } from "@/features/jobs/job-card";
import { JobDrawer } from "@/features/jobs/job-drawer";
import {
  isNoUpdate14DaysJob,
  sortJobsForColumn,
  type JobSortMode,
} from "@/features/jobs/job-helpers";
import { moveJobToColumn } from "@/lib/db";
import { DEFAULT_COLUMN_IDS, type ArchivedReason } from "@/lib/schemas";
import { useNow } from "@/lib/use-now";
import { useBoardData, type BoardJob } from "@/lib/use-jobs";
import { useApplylineUiStore } from "@/store/applyline-ui-store";

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
  const openCreate = useApplylineUiStore((state) => state.openCreate);
  const setColumnSort = useApplylineUiStore((state) => state.setColumnSort);
  const now = useNow();
  const [search, setSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState("");
  const [selectedSource, setSelectedSource] = useState("");
  const [computedFilter, setComputedFilter] = useState("");
  const [activeDragJobId, setActiveDragJobId] = useState<string | null>(null);
  const [isCreatingColumn, setIsCreatingColumn] = useState(false);
  const [pendingArchiveMove, setPendingArchiveMove] = useState<PendingMove | null>(null);
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
  const activeJob = jobs.find((job) => job.id === activeJobId) ?? null;
  const activeDragJob = jobs.find((job) => job.id === activeDragJobId) ?? null;

  function onDragStart(event: DragStartEvent) {
    setActiveDragJobId(event.active.id.toString());
  }

  function onDragCancel(_event: DragCancelEvent) {
    setActiveDragJobId(null);
  }

  async function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveDragJobId(null);

    if (!over) {
      return;
    }

    const activeJob = jobs.find((job) => job.id === active.id);

    if (!activeJob) {
      return;
    }

    const overId = over.id.toString();
    const overJob = jobs.find((job) => job.id === overId);
    const targetColumnId = overId.startsWith("column:")
      ? overId.replace("column:", "")
      : overJob?.columnId;

    if (!targetColumnId) {
      return;
    }

    const targetIndex = getTargetIndex({
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
      setPendingArchiveMove({
        jobId: activeJob.id,
        targetColumnId,
        targetIndex,
      });
      return;
    }

    await moveJobToColumn(activeJob.id, targetColumnId, { targetIndex });
  }

  async function confirmArchiveMove(archivedReason?: ArchivedReason) {
    if (!pendingArchiveMove) {
      return;
    }

    await moveJobToColumn(pendingArchiveMove.jobId, pendingArchiveMove.targetColumnId, {
      archivedReason,
      targetIndex: pendingArchiveMove.targetIndex,
    });
    setPendingArchiveMove(null);
  }

  if (error) {
    return (
      <div className="rounded-lg border bg-card p-5 text-sm text-destructive shadow-sm">
        {error.message}
      </div>
    );
  }

  return (
    <div className="grid gap-5">
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
        <DndContext
          collisionDetection={closestCorners}
          onDragCancel={onDragCancel}
          onDragEnd={onDragEnd}
          onDragStart={onDragStart}
          sensors={sensors}
        >
          <div className="flex min-w-0 max-w-full gap-3 overflow-x-auto pb-4 [scrollbar-width:thin]">
            {columns.map((column) => (
              <BoardColumn
                column={column}
                columns={columns}
                jobs={getColumnJobs(filteredJobs, column.id, getColumnSort(columnSorts, column.id))}
                key={column.id}
                now={now}
                onSortChange={setColumnSort}
                sort={getColumnSort(columnSorts, column.id)}
              />
            ))}
          </div>
          <DragOverlay>
            {activeDragJob ? <JobCardSurface isOverlay job={activeDragJob} now={now} /> : null}
          </DragOverlay>
        </DndContext>
      )}
      {!isLoading && jobs.length === 0 && columns.length > 0 ? (
        <div className="rounded-lg border border-dashed bg-card/70 p-8 text-center">
          <h2 className="text-lg font-semibold">No applications yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Add a role to start building your pipeline.
          </p>
          <Button className="mt-4" onClick={() => openCreate(columns[0]?.id)}>
            <Plus />
            Add job
          </Button>
        </div>
      ) : null}
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
