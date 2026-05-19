import { DEFAULT_COLUMN_IDS, type Activity, type Column } from "@/lib/schemas";
import type { BoardJob } from "@/lib/use-jobs";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PipelineFunnelStage = {
  id: string;
  label: string;
  count: number;
  rate: number;
  color?: string;
};

export type PipelineOutcome = {
  id: string;
  label: string;
  count: number;
  rate: number;
  color?: string;
};

export type PipelineStatusEntry = {
  columnId: string;
  label: string;
  color?: string;
  count: number;
  percentOfTotal: number;
};

export type ArchivedReasonEntry = {
  reason: string;
  label: string;
  count: number;
};

export type PipelineMetrics = {
  appliedCount: number;
  interviewReachedCount: number;
  offerCount: number;
  rejectedCount: number;
  noResponseCount: number;
  archivedCount: number;
  pendingAppliedCount: number;
  interviewRate: number;
  offerRate: number;
  rejectionRate: number;
  noResponseRate: number;
  archivedRate: number;
  archivedBreakdown: ArchivedReasonEntry[];
  currentStatus: PipelineStatusEntry[];
  funnelStages: PipelineFunnelStage[];
  outcomes: PipelineOutcome[];
};

// ---------------------------------------------------------------------------
// Color helper
// ---------------------------------------------------------------------------

const COLUMN_METRIC_COLOR: Record<string, string> = {
  amber: "bg-amber-500/55",
  blue: "bg-blue-500/55",
  green: "bg-emerald-500/55",
  red: "bg-rose-500/55",
  slate: "bg-slate-500/40",
  teal: "bg-teal-500/55",
  violet: "bg-violet-500/55",
  zinc: "bg-zinc-500/35",
};

export function getColumnMetricColor(color?: string): string {
  return (color && COLUMN_METRIC_COLOR[color]) ?? "bg-primary/55";
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function toRate(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : Math.round((numerator / denominator) * 100);
}

function isAppliedJob(job: BoardJob): boolean {
  return Boolean(job.appliedAt) || job.columnId !== DEFAULT_COLUMN_IDS.wishlist;
}

function everMovedTo(activities: Activity[], columnId: string): boolean {
  return activities.some((a) => a.type === "moved" && a.toColumnId === columnId);
}

const ARCHIVED_REASON_LABELS: Record<string, string> = {
  expired: "Expired",
  deleted: "Deleted",
  role_filled: "Role filled",
  not_interested: "Not interested",
  other: "Other",
};

// ---------------------------------------------------------------------------
// Main calculation
// ---------------------------------------------------------------------------

export function calculatePipelineMetrics({
  activities,
  columns,
  jobs,
}: {
  activities: Activity[];
  columns: Column[];
  jobs: BoardJob[];
}): PipelineMetrics {
  // Group activities by jobId for O(1) lookup
  const activitiesByJobId = new Map<string, Activity[]>();
  for (const act of activities) {
    const list = activitiesByJobId.get(act.jobId);
    if (list) {
      list.push(act);
    } else {
      activitiesByJobId.set(act.jobId, [act]);
    }
  }

  const columnColorById = new Map(columns.map((c) => [c.id, c.color]));

  // --- Core counts ---

  const appliedCount = jobs.filter(isAppliedJob).length;
  const pendingAppliedCount = jobs.filter(
    (job) => job.columnId === DEFAULT_COLUMN_IDS.applied,
  ).length;
  const noResponseCount = jobs.filter(
    (job) => job.columnId === DEFAULT_COLUMN_IDS.noResponse,
  ).length;
  const archivedCount = jobs.filter(
    (job) => job.columnId === DEFAULT_COLUMN_IDS.archived,
  ).length;

  // Reached interview: currently in interview/offer OR ever moved to interview/offer
  const interviewReachedCount = jobs.filter((job) => {
    if (
      job.columnId === DEFAULT_COLUMN_IDS.interview ||
      job.columnId === DEFAULT_COLUMN_IDS.offer
    ) {
      return true;
    }
    const jobActivities = activitiesByJobId.get(job.id) ?? [];
    return (
      everMovedTo(jobActivities, DEFAULT_COLUMN_IDS.interview) ||
      everMovedTo(jobActivities, DEFAULT_COLUMN_IDS.offer)
    );
  }).length;

  // Offer: currently in offer OR ever moved to offer
  const offerCount = jobs.filter((job) => {
    if (job.columnId === DEFAULT_COLUMN_IDS.offer) return true;
    const jobActivities = activitiesByJobId.get(job.id) ?? [];
    return everMovedTo(jobActivities, DEFAULT_COLUMN_IDS.offer);
  }).length;

  // Rejected: currently in rejected OR rejectedAt is set OR ever moved to rejected
  const rejectedCount = jobs.filter((job) => {
    if (job.columnId === DEFAULT_COLUMN_IDS.rejected) return true;
    if (job.rejectedAt) return true;
    const jobActivities = activitiesByJobId.get(job.id) ?? [];
    return everMovedTo(jobActivities, DEFAULT_COLUMN_IDS.rejected);
  }).length;

  // --- Archived breakdown by reason ---
  const archivedJobs = jobs.filter((job) => job.columnId === DEFAULT_COLUMN_IDS.archived);
  const archivedByReason = new Map<string, number>();
  for (const job of archivedJobs) {
    const reason = job.archivedReason ?? "other";
    archivedByReason.set(reason, (archivedByReason.get(reason) ?? 0) + 1);
  }
  const archivedBreakdown: ArchivedReasonEntry[] = Array.from(archivedByReason.entries()).map(
    ([reason, count]) => ({
      reason,
      label: ARCHIVED_REASON_LABELS[reason] ?? "Other",
      count,
    }),
  );

  // --- Current status distribution (all columns) ---
  const totalJobs = jobs.length;
  const currentStatus: PipelineStatusEntry[] = columns.map((col) => {
    const count = jobs.filter((job) => job.columnId === col.id).length;
    return {
      columnId: col.id,
      label: col.name,
      color: col.color,
      count,
      percentOfTotal: totalJobs === 0 ? 0 : Math.round((count / totalJobs) * 100),
    };
  });

  // --- Funnel stages (progressive, "ever reached") ---
  const funnelStages: PipelineFunnelStage[] = [
    {
      id: DEFAULT_COLUMN_IDS.applied,
      label: "Applied",
      count: appliedCount,
      rate: 100,
      color: columnColorById.get(DEFAULT_COLUMN_IDS.applied),
    },
    {
      id: DEFAULT_COLUMN_IDS.interview,
      label: "Interview",
      count: interviewReachedCount,
      rate: toRate(interviewReachedCount, appliedCount),
      color: columnColorById.get(DEFAULT_COLUMN_IDS.interview),
    },
    {
      id: DEFAULT_COLUMN_IDS.offer,
      label: "Offer",
      count: offerCount,
      rate: toRate(offerCount, appliedCount),
      color: columnColorById.get(DEFAULT_COLUMN_IDS.offer),
    },
  ];

  // --- Terminal outcomes ---
  const outcomes: PipelineOutcome[] = [
    {
      id: DEFAULT_COLUMN_IDS.rejected,
      label: "Rejected",
      count: rejectedCount,
      rate: toRate(rejectedCount, appliedCount),
      color: columnColorById.get(DEFAULT_COLUMN_IDS.rejected),
    },
    {
      id: DEFAULT_COLUMN_IDS.noResponse,
      label: "No Response",
      count: noResponseCount,
      rate: toRate(noResponseCount, appliedCount),
      color: columnColorById.get(DEFAULT_COLUMN_IDS.noResponse),
    },
    {
      id: DEFAULT_COLUMN_IDS.archived,
      label: "Archived",
      count: archivedCount,
      rate: toRate(archivedCount, appliedCount),
      color: columnColorById.get(DEFAULT_COLUMN_IDS.archived),
    },
  ];

  return {
    appliedCount,
    interviewReachedCount,
    offerCount,
    rejectedCount,
    noResponseCount,
    archivedCount,
    pendingAppliedCount,
    interviewRate: toRate(interviewReachedCount, appliedCount),
    offerRate: toRate(offerCount, appliedCount),
    rejectionRate: toRate(rejectedCount, appliedCount),
    noResponseRate: toRate(noResponseCount, appliedCount),
    archivedRate: toRate(archivedCount, appliedCount),
    archivedBreakdown,
    currentStatus,
    funnelStages,
    outcomes,
  };
}
