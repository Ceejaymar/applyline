"use client";

import type { CSSProperties, ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Building2, ExternalLink, GripVertical } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getBoardIcon } from "@/features/jobs/board-icons";
import type { BoardJob } from "@/lib/use-jobs";
import { cn } from "@/lib/utils";
import { useApplylineUiStore } from "@/store/applyline-ui-store";

type JobCardProps = {
  job: BoardJob;
};

type JobCardSurfaceProps = {
  dragHandle?: ReactNode;
  isDragging?: boolean;
  isOverlay?: boolean;
  job: BoardJob;
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

function formatRelativeTime(value: string) {
  const elapsedMs = Date.now() - new Date(value).getTime();
  const elapsedDays = Math.max(0, Math.floor(elapsedMs / 86_400_000));

  if (elapsedDays < 1) {
    return "now";
  }

  if (elapsedDays < 7) {
    return `${elapsedDays}d`;
  }

  if (elapsedDays < 35) {
    return `${Math.floor(elapsedDays / 7)}w`;
  }

  if (elapsedDays < 365) {
    return `${Math.floor(elapsedDays / 30)}mo`;
  }

  return `${Math.floor(elapsedDays / 365)}y`;
}

function sourceShortName(sourceName?: string) {
  if (!sourceName) {
    return "Direct";
  }

  return sourceName.length > 16 ? sourceName.slice(0, 15) : sourceName;
}

export function JobCardSurface({
  dragHandle,
  isDragging,
  isOverlay,
  job,
  onOpen,
}: JobCardSurfaceProps) {
  const accentClass = accentByColor[job.columnColor ?? ""] ?? "bg-indigo-500";
  const shownTags = job.tags.slice(0, 2);
  const SourceIcon = getBoardIcon(job.sourceIcon);

  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-md border bg-card text-card-foreground shadow-[0_10px_28px_-24px_hsl(var(--foreground)/0.6)] transition duration-200",
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
      <div className="flex items-start gap-2 p-3 pl-3.5">
        {dragHandle}
        <div className="min-w-0 flex-1 text-left">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold leading-5 tracking-normal">
                {job.title}
              </h3>
              <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                <Building2 className="size-3.5 shrink-0" />
                <span className="truncate">{job.companyName}</span>
              </p>
            </div>
            <span className="shrink-0 rounded-sm bg-secondary/70 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              {formatRelativeTime(job.lastStatusChangedAt ?? job.updatedAt)}
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1 truncate text-[11px] font-medium text-muted-foreground">
              {job.sourceIcon ? <SourceIcon className="size-3 shrink-0" /> : null}
              <span className="truncate">{sourceShortName(job.sourceName)}</span>
            </span>
            <div className="flex min-w-0 items-center justify-end gap-1">
              {shownTags.map((tag) => (
                <Badge
                  className="max-w-[5.75rem] truncate border-indigo-500/15 bg-indigo-500/[0.08] px-1.5 py-0 text-[10px] text-indigo-700 dark:text-indigo-200"
                  key={tag}
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
            title="Open posting"
            variant="ghost"
          >
            <ExternalLink className="size-3.5" />
          </Button>
        ) : null}
      </div>
    </article>
  );
}

export function JobCard({ job }: JobCardProps) {
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
    <div ref={setNodeRef} style={style}>
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
        onOpen={() => openJob(job.id)}
      />
    </div>
  );
}
