"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Building2, ExternalLink, Trash2, X } from "lucide-react";

import { getBoardIcon } from "@/features/jobs/board-icons";
import { TagBadge } from "@/features/jobs/tag-badge";
import { getJobDisplayTimestamp, getJobDisplayTimestampTitle } from "@/lib/dates";
import { deleteJobPermanently } from "@/lib/db";
import type { BoardJob } from "@/lib/use-jobs";
import { cn } from "@/lib/utils";
import { useApplylineUiStore } from "@/store/applyline-ui-store";

type JobCardProps = {
  job: BoardJob;
  now: Date;
};

type JobCardSurfaceProps = {
  isDragging?: boolean;
  isOverlay?: boolean;
  job: BoardJob;
  now?: Date;
  onDelete?: () => Promise<void>;
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
  isDragging,
  isOverlay,
  job,
  now = new Date(),
  onDelete,
  onOpen,
}: JobCardSurfaceProps) {
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const shownTags = job.tags.slice(0, 2);
  const SourceIcon = getBoardIcon(job.sourceIcon);
  const topAccent = columnTopAccent[job.columnColor ?? ""] ?? columnTopAccent.violet;
  const hasActions = Boolean(job.link || onDelete);

  return (
    <article
      aria-label={onOpen ? `${job.title} at ${job.companyName}` : undefined}
      className={cn(
        "group relative w-full max-w-full overflow-hidden rounded-md border bg-card text-card-foreground shadow-[0_10px_28px_-24px_hsl(var(--foreground)/0.6)] transition duration-200",
        "hover:-translate-y-0.5 hover:border-primary/28 hover:shadow-soft",
        onOpen && "cursor-grab focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isDragging && "opacity-45",
        isOverlay && "rotate-1 shadow-2xl",
      )}
      onClick={() => {
        if (isConfirmingDelete) {
          setIsConfirmingDelete(false);
          return;
        }
        onOpen?.();
      }}
      onKeyDown={(event) => {
        if (isConfirmingDelete) {
          if (event.key === "Escape") setIsConfirmingDelete(false);
          return;
        }
        if (!onOpen) return;
        if (event.key === "Enter") {
          event.preventDefault();
          onOpen();
        }
      }}
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
    >
      <div className={cn("absolute inset-x-0 top-0 h-0.5", topAccent)} />

      {/* Action icons — top-right corner, hover-reveal */}
      {hasActions && !isConfirmingDelete ? (
        <div
          className="absolute right-2 top-2 flex items-center gap-0.5 opacity-0 pointer-events-none transition-opacity duration-150 group-hover:opacity-100 group-hover:pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {job.link ? (
            <button
              aria-label={`Open posting for ${job.title}`}
              className="grid size-6 place-items-center rounded text-muted-foreground/60 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              onClick={(e) => {
                e.stopPropagation();
                window.open(job.link, "_blank", "noopener,noreferrer");
              }}
              onKeyDown={(e) => e.stopPropagation()}
              title={`Open posting for ${job.title}`}
              type="button"
            >
              <ExternalLink className="size-3.5" />
            </button>
          ) : null}
          {onDelete ? (
            <button
              aria-label={`Delete ${job.title}`}
              className="grid size-6 place-items-center rounded text-muted-foreground/60 transition-colors hover:text-destructive focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              onClick={(e) => {
                e.stopPropagation();
                setIsConfirmingDelete(true);
              }}
              onKeyDown={(e) => e.stopPropagation()}
              title={`Delete ${job.title}`}
              type="button"
            >
              <Trash2 className="size-3.5" />
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Delete confirmation — top-right corner */}
      {isConfirmingDelete ? (
        <div
          className="absolute right-2 top-2 flex items-center gap-1"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <button
            aria-label="Cancel delete"
            className="grid size-5 place-items-center rounded text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            onClick={(e) => { e.stopPropagation(); setIsConfirmingDelete(false); }}
            type="button"
          >
            <X className="size-3" />
          </button>
          <button
            aria-label="Confirm delete"
            className="text-[11px] font-medium text-destructive transition-opacity hover:opacity-70 focus-visible:outline-none"
            onClick={async (e) => { e.stopPropagation(); await onDelete?.(); }}
            type="button"
          >
            Delete
          </button>
        </div>
      ) : null}

      <div className="px-3.5 py-3">
        {/* Title row — full width */}
        <div className="min-w-0 overflow-hidden">
          <h3
            className="max-w-full truncate text-sm font-semibold leading-5 tracking-normal"
            title={job.title}
          >
            {job.title}
          </h3>
          <p
            className="mt-0.5 flex min-w-0 max-w-full items-center gap-1 overflow-hidden text-[11px] text-muted-foreground"
            title={job.companyName}
          >
            <Building2 className="size-3 shrink-0" />
            <span className="min-w-0 truncate">{job.companyName}</span>
          </p>
        </div>

        {/* Bottom row: tags/source left, timestamp right */}
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

          <span
            aria-label={`Last activity: ${getJobDisplayTimestampTitle(job)}`}
            className="shrink-0 text-right text-[11px] text-muted-foreground"
            title={getJobDisplayTimestampTitle(job)}
          >
            {getJobDisplayTimestamp(job, now)}
          </span>
        </div>
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
    <div
      className="w-full max-w-full min-w-0 overflow-hidden"
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
    >
      <JobCardSurface
        isDragging={isDragging}
        job={job}
        now={now}
        onDelete={async () => { await deleteJobPermanently(job.id); }}
        onOpen={() => openJob(job.id)}
      />
    </div>
  );
}
