import { DEFAULT_COLUMN_IDS, type Column, type Source } from "@/lib/schemas";
import type { BoardJob } from "@/lib/use-jobs";

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

export type MetricsSummary = {
  applicationsThisMonth: number;
  applicationsThisWeek: number;
  appliedJobCount: number;
  averageDaysInCurrentStatus: number | null;
  interviewRate: number;
  jobsByColumn: CountDatum[];
  needsAttention: AttentionJob[];
  noResponseCount: number;
  offerRate: number;
  rejectionCount: number;
  staleJobCount: number;
  topSources: CountDatum[];
  topTags: CountDatum[];
  totalJobs: number;
};

const staleThresholdMs = 14 * 24 * 60 * 60 * 1000;
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

function getStatusDate(job: BoardJob) {
  return job.lastStatusChangedAt || job.updatedAt;
}

function isAppliedJob(job: BoardJob) {
  return Boolean(job.appliedAt) || job.columnId !== DEFAULT_COLUMN_IDS.wishlist;
}

function isAttentionJob(job: BoardJob, now: Date) {
  if (
    job.columnId !== DEFAULT_COLUMN_IDS.applied &&
    job.columnId !== DEFAULT_COLUMN_IDS.interview
  ) {
    return false;
  }

  return now.getTime() - new Date(getStatusDate(job)).getTime() >= staleThresholdMs;
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
    return sum + Math.max(0, now.getTime() - new Date(getStatusDate(job)).getTime());
  }, 0);
  const appliedJobCount = jobs.filter(isAppliedJob).length;
  const interviewCount = jobs.filter((job) => laterStageColumnIds.has(job.columnId)).length;
  const offerCount = jobs.filter((job) => job.columnId === DEFAULT_COLUMN_IDS.offer).length;
  const needsAttention = jobs
    .filter((job) => isAttentionJob(job, now))
    .toSorted(
      (a, b) => new Date(getStatusDate(a)).getTime() - new Date(getStatusDate(b)).getTime(),
    )
    .map((job) => ({
      companyName: job.companyName,
      id: job.id,
      lastUpdateAt: getStatusDate(job),
      status: job.columnName,
      title: job.title,
    }));

  return {
    applicationsThisMonth: getAppliedCountSince(jobs, startOfMonth(now), now),
    applicationsThisWeek: getAppliedCountSince(jobs, startOfWeek(now), now),
    appliedJobCount,
    averageDaysInCurrentStatus:
      jobs.length === 0 ? null : Math.round(totalStatusMs / jobs.length / 86_400_000),
    interviewRate: toRate(interviewCount, appliedJobCount),
    jobsByColumn: columns.map((column) => ({
      color: column.color,
      id: column.id,
      label: column.name,
      value: jobs.filter((job) => job.columnId === column.id).length,
    })),
    needsAttention,
    noResponseCount: jobs.filter((job) => job.columnId === DEFAULT_COLUMN_IDS.noResponse).length,
    offerRate: toRate(offerCount, appliedJobCount),
    rejectionCount: jobs.filter((job) => job.columnId === DEFAULT_COLUMN_IDS.rejected).length,
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
  };
}
