"use client";

import type { CSSProperties, ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Building2, ExternalLink, GripVertical } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getBoardIcon } from "@/features/jobs/board-icons";
import { getJobDisplayTimestamp, getJobDisplayTimestampTitle } from "@/lib/dates";
import type { BoardJob } from "@/lib/use-jobs";
import { cn } from "@/lib/utils";
import { useApplylineUiStore } from "@/store/applyline-ui-store";

type JobCardProps = {
  job: BoardJob;
  now: Date;
};

type JobCardSurfaceProps = {
  dragHandle?: ReactNode;
  isDragging?: boolean;
  isOverlay?: boolean;
  job: BoardJob;
  now?: Date;
  onOpen?: () => void;
};

const accentByColor: Record<string, string> = {
  amber: "bg-amber-400",
  blue: "bg-blue-500",
  green: "bg-emerald-500",
  red: "bg-rose-500",
  slate: "bg-slate-400",
  teal: "bg-teal-500",
  violet: "bg-violet-500",
  zinc: "bg-zinc-400",
};

export function JobCardSurface({
  dragHandle,
  isDragging,
  isOverlay,
  job,
  now = new Date(),
  onOpen,
}: JobCardSurfaceProps) {
  const accentClass = accentByColor[job.columnColor ?? ""] ?? "bg-indigo-500";
  const shownTags = job.tags.slice(0, 2);
  const SourceIcon = getBoardIcon(job.sourceIcon);

  return (
    <article
      aria-label={onOpen ? `${job.title} at ${job.companyName}` : undefined}
      className={cn(
        "group relative w-full max-w-full overflow-hidden rounded-md border bg-card text-card-foreground shadow-[0_10px_28px_-24px_hsl(var(--foreground)/0.6)] transition duration-200",
        "hover:-translate-y-0.5 hover:border-primary/28 hover:shadow-soft",
        onOpen && "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isDragging && "opacity-45",
        isOverlay && "rotate-1 shadow-2xl",
      )}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (!onOpen) {
          return;
        }

        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
    >
      <div className={cn("absolute inset-y-0 left-0 w-1", accentClass)} />
      <div className="flex w-full max-w-full min-w-0 items-start gap-2 overflow-hidden p-3 pl-3.5">
        {dragHandle}
        <div className="min-w-0 flex-1 overflow-hidden text-left">
          <div className="flex min-w-0 items-start justify-between gap-3 overflow-hidden">
            <div className="min-w-0 flex-1 overflow-hidden">
              <h3
                className="max-w-full truncate text-sm font-semibold leading-5 tracking-normal"
                title={job.title}
              >
                {job.title}
              </h3>
              <p
                className="mt-1 flex min-w-0 max-w-full items-center gap-1.5 overflow-hidden text-xs text-muted-foreground"
                title={job.companyName}
              >
                <Building2 className="size-3.5 shrink-0" />
                <span className="min-w-0 truncate">{job.companyName}</span>
              </p>
            </div>
            <span
              aria-label={`Last activity: ${getJobDisplayTimestampTitle(job)}`}
              className="max-w-16 shrink-0 truncate rounded-sm bg-secondary/70 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground"
              title={getJobDisplayTimestampTitle(job)}
            >
              {getJobDisplayTimestamp(job, now)}
            </span>
          </div>
          <div className="mt-3 grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 overflow-hidden">
            <span
              aria-label={`Source: ${job.sourceName ?? "Direct"}`}
              className="flex min-w-0 max-w-full items-center gap-1 overflow-hidden text-[11px] font-medium text-muted-foreground"
              title={job.sourceName ?? "Direct"}
            >
              {job.sourceIcon ? <SourceIcon className="size-3 shrink-0" /> : null}
              <span className="min-w-0 truncate">{job.sourceName ?? "Direct"}</span>
            </span>
            <div className="flex min-w-0 max-w-full items-center justify-end gap-1 overflow-hidden">
              {shownTags.map((tag) => (
                <Badge
                  className="min-w-0 max-w-[5.75rem] truncate border-indigo-500/15 bg-indigo-500/[0.08] px-1.5 py-0 text-[10px] text-indigo-700 dark:text-indigo-200"
                  key={tag}
                  title={tag}
                  variant="outline"
                >
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        </div>
        {job.link ? (
          <Button
            aria-label={`Open posting for ${job.title}`}
            className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={(event) => {
              event.stopPropagation();
              window.open(job.link, "_blank", "noopener,noreferrer");
            }}
            onKeyDown={(event) => event.stopPropagation()}
            size="icon"
            title={`Open posting for ${job.title}`}
            variant="ghost"
          >
            <ExternalLink className="size-3.5" />
          </Button>
        ) : null}
      </div>
    </article>
  );
}

export function JobCard({ job, now }: JobCardProps) {
  const openJob = useApplylineUiStore((state) => state.openJob);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: job.id,
      data: { columnId: job.columnId, type: "job" },
    });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div className="w-full max-w-full min-w-0 overflow-hidden" ref={setNodeRef} style={style}>
      <JobCardSurface
        dragHandle={
          <button
            aria-label={`Drag ${job.title}`}
            className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground/80 transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
            type="button"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-3.5" />
          </button>
        }
        isDragging={isDragging}
        job={job}
        now={now}
        onOpen={() => openJob(job.id)}
      />
    </div>
  );
}
