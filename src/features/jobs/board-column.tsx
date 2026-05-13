"use client";

import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { columnTint, getBoardIcon } from "@/features/jobs/board-icons";
import { ColumnMenu } from "@/features/jobs/column-menu";
import { JobCard } from "@/features/jobs/job-card";
import type { Column } from "@/lib/schemas";
import type { BoardJob } from "@/lib/use-jobs";
import { cn } from "@/lib/utils";
import { useApplylineUiStore } from "@/store/applyline-ui-store";

type BoardColumnProps = {
  column: Column;
  columns: Column[];
  jobs: BoardJob[];
};

export function BoardColumn({ column, columns, jobs }: BoardColumnProps) {
  const openCreate = useApplylineUiStore((state) => state.openCreate);
  const { isOver, setNodeRef } = useDroppable({
    id: `column:${column.id}`,
    data: { columnId: column.id, type: "column" },
  });
  const Icon = getBoardIcon(column.icon);
  const tintClass = columnTint[column.color ?? ""] ?? columnTint.violet;

  return (
    <section
      aria-label={column.name}
      className={cn(
        "flex min-h-[calc(100vh-13rem)] w-[19rem] shrink-0 flex-col rounded-lg border bg-card/64 shadow-[0_18px_42px_-36px_hsl(var(--foreground)/0.55)] transition-colors",
        isOver && "border-primary/45 bg-primary/5",
      )}
      ref={setNodeRef}
    >
      <header className="grid gap-2 border-b bg-background/38 p-3">
        <div className="flex items-center gap-2">
          <span className={cn("grid size-7 place-items-center rounded-md border", tintClass)}>
            <Icon className="size-3.5" />
          </span>
          <h2 className="min-w-0 flex-1 truncate text-sm font-semibold tracking-normal">
            {column.name}
          </h2>
          <span className="rounded-sm border bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {jobs.length}
          </span>
          <ColumnMenu column={column} columns={columns} jobCount={jobs.length} />
        </div>
        <Button
          className="w-full justify-start border-dashed bg-background/72 text-muted-foreground hover:text-foreground"
          onClick={() => openCreate(column.id)}
          size="sm"
          variant="outline"
        >
          <Plus />
          Add job
        </Button>
      </header>
      <SortableContext items={jobs.map((job) => job.id)} strategy={verticalListSortingStrategy}>
        <div className="grid content-start gap-2 p-2.5">
          {jobs.map((job) => (
            <JobCard job={job} key={job.id} />
          ))}
          {jobs.length === 0 ? (
            <div
              aria-label={`${column.name} drop zone — empty`}
              className="grid h-28 place-items-center rounded-md border border-dashed bg-background/55 px-5 text-center text-xs leading-5 text-muted-foreground"
              role="region"
            >
              Drop jobs here or add a new one.
            </div>
          ) : null}
        </div>
      </SortableContext>
    </section>
  );
}
