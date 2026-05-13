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
import { moveJob } from "@/lib/db";
import { jobStatusLabels, jobStatuses, type Job, type JobStatus } from "@/lib/job-schema";
import { useJobs } from "@/lib/use-jobs";
import { cn } from "@/lib/utils";
import { useApplylineUiStore } from "@/store/applyline-ui-store";

function sortByPosition(a: Job, b: Job) {
  return a.position - b.position;
}

type BoardColumnProps = {
  jobs: Job[];
  status: JobStatus;
};

function BoardColumn({ jobs, status }: BoardColumnProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: `column:${status}`,
    data: { status },
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
        <h2 className="text-sm font-semibold">{jobStatusLabels[status]}</h2>
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
  const { jobs, isLoading, error } = useJobs();
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
    const targetStatus = overId.startsWith("column:")
      ? (overId.replace("column:", "") as JobStatus)
      : overJob?.status;

    if (!targetStatus) {
      return;
    }

    const nextPosition =
      overJob && overJob.id !== activeJob.id ? overJob.position - 0.5 : Date.now();

    if (activeJob.status !== targetStatus || activeJob.position !== nextPosition) {
      await moveJob(activeJob.id, targetStatus, nextPosition);
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
          {jobStatuses.map((status) => {
            const columnJobs = jobs
              .filter((job) => job.status === status)
              .toSorted(sortByPosition);

            return <BoardColumn jobs={columnJobs} key={status} status={status} />;
          })}
        </div>
      </DndContext>
      <JobDetailDialog job={activeJob} />
    </div>
  );
}
