"use client";

import type { CSSProperties, ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Building2, ExternalLink, GripVertical } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getBoardIcon } from "@/features/jobs/board-icons";
import { TagBadge } from "@/features/jobs/tag-badge";
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

const columnTopAccent: Record<string, string> = {
  amber: "bg-amber-500/30",
  blue: "bg-blue-500/30",
  green: "bg-emerald-500/30",
  red: "bg-rose-500/30",
  slate: "bg-slate-500/25",
  teal: "bg-teal-500/30",
  violet: "bg-violet-500/30",
  zinc: "bg-zinc-500/20",
};

export function JobCardSurface({
  dragHandle,
  isDragging,
  isOverlay,
  job,
  now = new Date(),
  onOpen,
}: JobCardSurfaceProps) {
  const shownTags = job.tags.slice(0, 2);
  const SourceIcon = getBoardIcon(job.sourceIcon);
  const topAccent = columnTopAccent[job.columnColor ?? ""] ?? columnTopAccent.violet;

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
      <div className={cn("absolute inset-x-0 top-0 h-0.5", topAccent)} />
      <div className="flex w-full max-w-full min-w-0 items-start gap-2 overflow-hidden p-3">
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
                className="mt-1 flex min-w-0 max-w-full items-center gap-1 overflow-hidden text-[11px] text-muted-foreground"
                title={job.companyName}
              >
                <Building2 className="size-3 shrink-0" />
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
          <div className="mt-2 flex min-w-0 items-center justify-between gap-2 overflow-hidden">
            <div className="flex min-w-0 items-center gap-1 overflow-hidden">
              {shownTags.length > 0 ? (
                shownTags.map((tag) => (
                  <TagBadge className="min-w-0 max-w-[5.75rem] truncate" key={tag} tag={tag} />
                ))
              ) : (
                <>
                  {job.sourceIcon ? <SourceIcon className="size-3 shrink-0 text-muted-foreground" /> : null}
                  <span className="min-w-0 truncate text-[11px] text-muted-foreground">
                    {job.sourceName ?? "Direct"}
                  </span>
                </>
              )}
            </div>
            {shownTags.length > 0 ? (
              <span
                className="max-w-[4.5rem] shrink-0 overflow-hidden truncate text-[11px] text-muted-foreground/55"
                title={job.sourceName ?? "Direct"}
              >
                {job.sourceName ?? "Direct"}
              </span>
            ) : null}
          </div>
        </div>
        {job.link ? (
          <Button
            aria-label={`Open posting for ${job.title}`}
            className="size-7 shrink-0 text-muted-foreground opacity-0 pointer-events-none transition-opacity duration-150 group-hover:opacity-100 group-hover:pointer-events-auto focus-visible:opacity-100 focus-visible:pointer-events-auto hover:text-foreground"
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
            className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground/80 opacity-0 pointer-events-none transition-opacity duration-150 hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100 group-hover:pointer-events-auto focus-visible:opacity-100 focus-visible:pointer-events-auto"
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
