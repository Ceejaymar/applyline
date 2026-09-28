"use client";

import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { columnTint, getBoardIcon } from "@/features/jobs/board-icons";
import { ColumnMenu } from "@/features/jobs/column-menu";
import { ColumnSortMenu } from "@/features/jobs/column-sort-menu";
import { JobCard } from "@/features/jobs/job-card";
import type { JobSortMode } from "@/features/jobs/job-helpers";
import type { Column } from "@/lib/schemas";
import type { BoardJob } from "@/lib/use-jobs";
import { cn } from "@/lib/utils";
import { useApplylineUiStore } from "@/store/applyline-ui-store";

type BoardColumnProps = {
  column: Column;
  columns: Column[];
  activeDragJobId?: string | null;
  dropPreviewIndex?: number | null;
  jobCount?: number;
  jobs: BoardJob[];
  now: Date;
  onSortChange: (columnId: string, sort: JobSortMode) => void;
  prefersReducedMotion: boolean;
  sort: JobSortMode;
};

function DropPreviewIndicator({ position }: { position: "before" | "end" }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-x-1 z-10 h-0.5 rounded-sm bg-primary/70",
        position === "before" ? "-top-[5px]" : "-bottom-[5px]",
      )}
    />
  );
}

export function BoardColumn({
  column,
  columns,
  activeDragJobId,
  dropPreviewIndex,
  jobCount,
  jobs,
  now,
  onSortChange,
  prefersReducedMotion,
  sort,
}: BoardColumnProps) {
  const openCreate = useApplylineUiStore((state) => state.openCreate);
  const { isOver, setNodeRef } = useDroppable({
    id: `column:${column.id}`,
    data: { columnId: column.id, type: "column" },
  });
  const Icon = getBoardIcon(column.icon);
  const tintClass = columnTint[column.color ?? ""] ?? columnTint.violet;
  const normalizedDropPreviewIndex =
    typeof dropPreviewIndex === "number"
      ? Math.min(Math.max(dropPreviewIndex, 0), jobs.length)
      : null;

  return (
    <section
      aria-label={column.name}
      className={cn(
        "flex h-full min-h-0 max-h-full w-[19rem] max-w-[19rem] shrink-0 flex-col overflow-hidden rounded-lg border bg-card/85 transition-colors motion-reduce:transition-none",
        isOver && "border-primary/45 bg-primary/5",
      )}
      ref={setNodeRef}
    >
      <header className="flex min-w-0 shrink-0 items-center gap-2 border-b bg-background/38 p-3">
        <span className={cn("grid size-7 shrink-0 place-items-center rounded-md border", tintClass)}>
          <Icon className="size-3.5" />
        </span>
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold tracking-normal" title={column.name}>
          {column.name}
        </h2>
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {jobCount ?? jobs.length}
        </span>
        <Button
          aria-label={`Add job to ${column.name}`}
          className="size-7 shrink-0 border-primary/25 text-primary hover:border-primary/50 hover:bg-primary/[0.07]"
          onClick={() => openCreate(column.id)}
          size="icon"
          title={`Add job to ${column.name}`}
          variant="outline"
        >
          <Plus className="size-3.5" />
        </Button>
        <ColumnSortMenu
          columnName={column.name}
          onSortChange={(nextSort) => onSortChange(column.id, nextSort)}
          sort={sort}
        />
        <ColumnMenu column={column} columns={columns} jobCount={jobs.length} />
      </header>
      <SortableContext items={jobs.map((job) => job.id)} strategy={verticalListSortingStrategy}>
        <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-2.5 [scrollbar-width:thin]">
          <div className="relative flex min-w-0 flex-col gap-2">
            {jobs.map((job, index) => (
              <div className="relative" key={job.id}>
                {normalizedDropPreviewIndex === index ? (
                  <DropPreviewIndicator position="before" />
                ) : null}
                <JobCard
                  isDragSourceHidden={job.id === activeDragJobId}
                  isDragActive={Boolean(activeDragJobId)}
                  job={job}
                  now={now}
                  prefersReducedMotion={prefersReducedMotion}
                />
              </div>
            ))}
            {normalizedDropPreviewIndex === jobs.length && jobs.length > 0 ? (
              <DropPreviewIndicator position="end" />
            ) : null}
            {jobs.length === 0 ? (
              <div
                aria-label={`${column.name} drop zone, empty`}
                className={cn(
                  "grid h-28 place-items-center rounded-md border border-dashed bg-background/55 px-5 text-center text-xs leading-5 text-muted-foreground transition-colors motion-reduce:transition-none",
                  normalizedDropPreviewIndex === 0 && "border-primary/45 bg-primary/[0.055]",
                )}
                role="region"
              >
                No jobs yet.
              </div>
            ) : null}
          </div>
        </div>
      </SortableContext>
    </section>
  );
}
