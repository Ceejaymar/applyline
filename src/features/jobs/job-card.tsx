"use client";

import { CSSProperties } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Building2, ExternalLink, GripVertical, MapPin } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { jobStatusLabels, type Job } from "@/lib/job-schema";
import { cn } from "@/lib/utils";
import { useApplylineUiStore } from "@/store/applyline-ui-store";

type JobCardProps = {
  job: Job;
};

function formatUpdatedAt(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export function JobCard({ job }: JobCardProps) {
  const openJob = useApplylineUiStore((state) => state.openJob);
  const boardDensity = useApplylineUiStore((state) => state.boardDensity);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: job.id,
      data: { status: job.status },
    });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <article
      className={cn(
        "group rounded-md border bg-card text-card-foreground shadow-sm transition-shadow hover:shadow-soft",
        isDragging && "opacity-60",
      )}
      ref={setNodeRef}
      style={style}
    >
      <div className={cn("flex gap-2 p-3", boardDensity === "comfortable" && "p-4")}>
        <button
          aria-label={`Drag ${job.title}`}
          className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
        <button
          className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => openJob(job.id)}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold">{job.title}</h3>
              <p className="mt-1 flex items-center gap-1 truncate text-xs text-muted-foreground">
                <Building2 className="size-3.5 shrink-0" />
                {job.company}
              </p>
            </div>
            <Badge variant={job.status === "offer" ? "success" : "secondary"}>
              {jobStatusLabels[job.status]}
            </Badge>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span className="flex min-w-0 items-center gap-1">
              <MapPin className="size-3.5 shrink-0" />
              <span className="truncate">{job.location || "Remote / TBD"}</span>
            </span>
            <span className="shrink-0">{formatUpdatedAt(job.updatedAt)}</span>
          </div>
        </button>
        {job.url ? (
          <Button
            aria-label="Open job posting"
            className="size-7 shrink-0"
            onClick={(event) => {
              event.stopPropagation();
              window.open(job.url, "_blank", "noopener,noreferrer");
            }}
            size="icon"
            title="Open job posting"
            variant="ghost"
          >
            <ExternalLink className="size-3.5" />
          </Button>
        ) : null}
      </div>
    </article>
  );
}
