"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Plus, Rows3 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { JobCard } from "@/features/jobs/job-card";
import { JobDetailDialog } from "@/features/jobs/job-detail-dialog";
import { moveJobToColumn } from "@/lib/db";
import type { Column } from "@/lib/schemas";
import { useBoardData, type BoardJob } from "@/lib/use-jobs";
import { cn } from "@/lib/utils";
import { useApplylineUiStore } from "@/store/applyline-ui-store";

function sortByUpdatedAt(a: BoardJob, b: BoardJob) {
  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
}

type BoardColumnProps = {
  column: Column;
  jobs: BoardJob[];
};

function BoardColumn({ column, jobs }: BoardColumnProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: `column:${column.id}`,
    data: { columnId: column.id },
  });

  return (
    <section
      className={cn(
        "flex min-h-[calc(100vh-11rem)] min-w-72 flex-1 flex-col rounded-lg border bg-muted/45 transition-colors",
        isOver && "border-primary/70 bg-primary/5",
      )}
      ref={setNodeRef}
    >
      <header className="flex h-11 items-center justify-between border-b px-3">
        <h2 className="text-sm font-semibold">{column.name}</h2>
        <span className="rounded-sm bg-background px-2 py-0.5 text-xs text-muted-foreground">
          {jobs.length}
        </span>
      </header>
      <SortableContext items={jobs.map((job) => job.id)} strategy={verticalListSortingStrategy}>
        <div className="grid gap-2 p-2">
          {jobs.map((job) => (
            <JobCard job={job} key={job.id} />
          ))}
          {jobs.length === 0 ? (
            <div className="grid h-24 place-items-center rounded-md border border-dashed bg-background/60 text-xs text-muted-foreground">
              No applications
            </div>
          ) : null}
        </div>
      </SortableContext>
    </section>
  );
}

export function JobBoard() {
  const { columns, jobs, sources, isLoading, error } = useBoardData();
  const activeJobId = useApplylineUiStore((state) => state.activeJobId);
  const boardDensity = useApplylineUiStore((state) => state.boardDensity);
  const openCreate = useApplylineUiStore((state) => state.openCreate);
  const setBoardDensity = useApplylineUiStore((state) => state.setBoardDensity);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const activeJob = jobs.find((job) => job.id === activeJobId) ?? null;

  async function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;

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

    if (activeJob.columnId !== targetColumnId) {
      await moveJobToColumn(activeJob.id, targetColumnId);
    }
  }

  if (error) {
    return (
      <div className="rounded-lg border bg-card p-5 text-sm text-destructive">
        {error.message}
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-normal">Board</h1>
          <p className="text-sm text-muted-foreground">
            {isLoading ? "Loading applications..." : `${jobs.length} applications`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            aria-label="Toggle board density"
            onClick={() =>
              setBoardDensity(boardDensity === "compact" ? "comfortable" : "compact")
            }
            title="Toggle board density"
            variant="outline"
          >
            <Rows3 />
            {boardDensity === "compact" ? "Compact" : "Comfortable"}
          </Button>
          <Button onClick={openCreate}>
            <Plus />
            Add
          </Button>
        </div>
      </div>
      <DndContext onDragEnd={onDragEnd} sensors={sensors}>
        <div className="flex gap-3 overflow-x-auto pb-3">
          {columns.map((column) => {
            const columnJobs = jobs
              .filter((job) => job.columnId === column.id)
              .toSorted(sortByUpdatedAt);

            return <BoardColumn column={column} jobs={columnJobs} key={column.id} />;
          })}
        </div>
      </DndContext>
      <JobDetailDialog columns={columns} job={activeJob} sources={sources} />
    </div>
  );
}
