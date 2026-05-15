import { DEFAULT_COLUMN_IDS, type Column, type Source } from "@/lib/schemas";
import type { BoardJob } from "@/lib/use-jobs";
import { getJobStatusDate, isNoUpdate14DaysJob } from "@/features/jobs/job-helpers";

export type CountDatum = {
  color?: string;
  id: string;
  label: string;
  value: number;
};

export type AttentionJob = {
  companyName: string;
  id: string;
  lastUpdateAt: string;
  status: string;
  title: string;
};

export type WeeklyDatum = {
  count: number;
  weekLabel: string;
  weekStart: string;
};

export type SourceConversionDatum = {
  applied: number;
  id: string;
  interviewRate: number | null;
  label: string;
};

export type MetricsSummary = {
  applicationsThisMonth: number;
  applicationsThisWeek: number;
  appliedJobCount: number;
  averageDaysInCurrentStatus: number | null;
  avgDaysToFirstResponse: number | null;
  avgDaysToInterview: number | null;
  interviewJobCount: number;
  interviewRate: number;
  jobsByColumn: CountDatum[];
  needsAttention: AttentionJob[];
  noResponseCount: number;
  offerJobCount: number;
  offerRate: number;
  pendingCount: number;
  rejectionCount: number;
  responseRate: number;
  sourceConversion: SourceConversionDatum[];
  staleJobCount: number;
  topSources: CountDatum[];
  topTags: CountDatum[];
  totalJobs: number;
  weeklyActivity: WeeklyDatum[];
};

const laterStageColumnIds = new Set<string>([
  DEFAULT_COLUMN_IDS.interview,
  DEFAULT_COLUMN_IDS.offer,
]);

function startOfWeek(date: Date) {
  const nextDate = new Date(date);
  const day = nextDate.getDay();
  nextDate.setHours(0, 0, 0, 0);
  nextDate.setDate(nextDate.getDate() - day);
  return nextDate;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function isAppliedJob(job: BoardJob) {
  return Boolean(job.appliedAt) || job.columnId !== DEFAULT_COLUMN_IDS.wishlist;
}

function getAppliedCountSince(jobs: BoardJob[], startDate: Date, now: Date) {
  const startTime = startDate.getTime();
  const nowTime = now.getTime();

  return jobs.reduce((count, job) => {
    if (!job.appliedAt) {
      return count;
    }

    const appliedTime = new Date(job.appliedAt).getTime();
    return appliedTime >= startTime && appliedTime <= nowTime ? count + 1 : count;
  }, 0);
}

function toRate(numerator: number, denominator: number) {
  return denominator === 0 ? 0 : Math.round((numerator / denominator) * 100);
}

function topCounts(entries: Array<{ id: string; label: string }>, limit = 5) {
  const countsById = new Map<string, { id: string; label: string; value: number }>();

  for (const entry of entries) {
    const current = countsById.get(entry.id);

    if (current) {
      current.value += 1;
    } else {
      countsById.set(entry.id, { ...entry, value: 1 });
    }
  }

  return Array.from(countsById.values())
    .toSorted((a, b) => b.value - a.value || a.label.localeCompare(b.label))
    .slice(0, limit);
}

function getWeeklyActivity(jobs: BoardJob[], now: Date, weekCount = 12): WeeklyDatum[] {
  const currentWeekStart = startOfWeek(now);

  return Array.from({ length: weekCount }, (_, i) => {
    const weekStart = new Date(currentWeekStart);
    weekStart.setDate(weekStart.getDate() - (weekCount - 1 - i) * 7);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const count = jobs.filter((job) => {
      if (!job.appliedAt) return false;
      const t = new Date(job.appliedAt).getTime();
      return t >= weekStart.getTime() && t < weekEnd.getTime();
    }).length;

    const label = weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return { count, weekLabel: label, weekStart: weekStart.toISOString() };
  });
}

function getSourceConversion(
  jobs: BoardJob[],
  sourcesById: Map<string, Source>,
): SourceConversionDatum[] {
  const bySource = new Map<string, { id: string; label: string; applied: number; interviews: number }>();

  for (const job of jobs) {
    if (!isAppliedJob(job)) continue;

    const sourceId = job.sourceId ?? "source_direct";
    const source = job.sourceId ? sourcesById.get(job.sourceId) : undefined;
    const label = source?.name ?? job.sourceName ?? "Direct / Unknown";

    const entry = bySource.get(sourceId) ?? { id: sourceId, label, applied: 0, interviews: 0 };
    entry.applied += 1;
    if (laterStageColumnIds.has(job.columnId)) {
      entry.interviews += 1;
    }
    bySource.set(sourceId, entry);
  }

  return Array.from(bySource.values())
    .filter((s) => s.applied > 0)
    .map((s) => ({
      applied: s.applied,
      id: s.id,
      interviewRate: s.applied >= 3 ? toRate(s.interviews, s.applied) : null,
      label: s.label,
    }))
    .toSorted((a, b) => {
      if (a.interviewRate !== null && b.interviewRate !== null) return b.interviewRate - a.interviewRate;
      if (a.interviewRate !== null) return -1;
      if (b.interviewRate !== null) return 1;
      return b.applied - a.applied;
    })
    .slice(0, 7);
}

function avgDaysFromApplied(jobs: BoardJob[]): number | null {
  const qualifying = jobs.filter((job) => job.appliedAt);
  if (qualifying.length === 0) return null;

  const totalMs = qualifying.reduce((sum, job) => {
    const appliedMs = new Date(job.appliedAt!).getTime();
    const changedMs = new Date(job.lastStatusChangedAt).getTime();
    return sum + Math.max(0, changedMs - appliedMs);
  }, 0);

  return Math.round(totalMs / qualifying.length / 86_400_000);
}

export function calculateMetrics({
  columns,
  jobs,
  now = new Date(),
  sources,
}: {
  columns: Column[];
  jobs: BoardJob[];
  now?: Date;
  sources: Source[];
}): MetricsSummary {
  const columnsById = new Map(columns.map((column) => [column.id, column]));
  const sourcesById = new Map(sources.map((source) => [source.id, source]));
  const totalStatusMs = jobs.reduce((sum, job) => {
    return sum + Math.max(0, now.getTime() - new Date(getJobStatusDate(job)).getTime());
  }, 0);
  const appliedJobCount = jobs.filter(isAppliedJob).length;
  const interviewJobCount = jobs.filter((job) => laterStageColumnIds.has(job.columnId)).length;
  const offerJobCount = jobs.filter((job) => job.columnId === DEFAULT_COLUMN_IDS.offer).length;
  const rejectionCount = jobs.filter((job) => job.columnId === DEFAULT_COLUMN_IDS.rejected).length;
  const needsAttention = jobs
    .filter((job) => isNoUpdate14DaysJob(job, now))
    .toSorted(
      (a, b) => new Date(getJobStatusDate(a)).getTime() - new Date(getJobStatusDate(b)).getTime(),
    )
    .map((job) => ({
      companyName: job.companyName,
      id: job.id,
      lastUpdateAt: getJobStatusDate(job),
      status: job.columnName,
      title: job.title,
    }));

  // Jobs that left Applied/Wishlist (got some kind of movement)
  const movedJobs = jobs.filter(
    (job) =>
      job.appliedAt &&
      job.columnId !== DEFAULT_COLUMN_IDS.wishlist &&
      job.columnId !== DEFAULT_COLUMN_IDS.applied,
  );

  // Jobs currently in interview or offer with appliedAt set
  const interviewedJobs = jobs.filter(
    (job) => job.appliedAt && laterStageColumnIds.has(job.columnId),
  );

  void columnsById;

  return {
    applicationsThisMonth: getAppliedCountSince(jobs, startOfMonth(now), now),
    applicationsThisWeek: getAppliedCountSince(jobs, startOfWeek(now), now),
    appliedJobCount,
    averageDaysInCurrentStatus:
      jobs.length === 0 ? null : Math.round(totalStatusMs / jobs.length / 86_400_000),
    avgDaysToFirstResponse: avgDaysFromApplied(movedJobs),
    avgDaysToInterview: avgDaysFromApplied(interviewedJobs),
    interviewJobCount,
    interviewRate: toRate(interviewJobCount, appliedJobCount),
    jobsByColumn: columns.map((column) => ({
      color: column.color,
      id: column.id,
      label: column.name,
      value: jobs.filter((job) => job.columnId === column.id).length,
    })),
    needsAttention,
    noResponseCount: jobs.filter((job) => job.columnId === DEFAULT_COLUMN_IDS.noResponse).length,
    offerJobCount,
    offerRate: toRate(offerJobCount, appliedJobCount),
    pendingCount: jobs.filter(
      (job) => job.appliedAt && job.columnId === DEFAULT_COLUMN_IDS.applied,
    ).length,
    rejectionCount,
    responseRate: toRate(interviewJobCount + offerJobCount + rejectionCount, appliedJobCount),
    sourceConversion: getSourceConversion(jobs, sourcesById),
    staleJobCount: needsAttention.length,
    topSources: topCounts(
      jobs.map((job) => {
        const source = job.sourceId ? sourcesById.get(job.sourceId) : undefined;
        return {
          id: job.sourceId || "source_direct",
          label: source?.name ?? job.sourceName ?? "Direct / Unknown",
        };
      }),
    ),
    topTags: topCounts(
      jobs.flatMap((job) => job.tags.map((tag) => ({ id: tag, label: tag }))),
    ),
    totalJobs: jobs.length,
    weeklyActivity: getWeeklyActivity(jobs, now),
  };
}
