import { DEFAULT_COLUMN_IDS, DEFAULT_SOURCE_IDS, type Source } from "@/lib/schemas";
import type { BoardJob } from "@/lib/use-jobs";

const noUpdateThresholdMs = 14 * 24 * 60 * 60 * 1000;

type DuplicateJobInput = {
  companyName?: string;
  excludeJobId?: string;
  jobs: BoardJob[];
  link?: string;
  title?: string;
};

export type JobSortDirection = "asc" | "desc";
export type JobSortMode = "latest" | "oldest" | "manual";
export type JobColumnSort = JobSortMode | JobSortDirection;

const sourceMatchers = [
  { sourceId: DEFAULT_SOURCE_IDS.greenhouse, patterns: ["greenhouse.io"] },
  { sourceId: DEFAULT_SOURCE_IDS.lever, patterns: ["lever.co"] },
  { sourceId: DEFAULT_SOURCE_IDS.linkedin, patterns: ["linkedin.com"] },
  { sourceId: DEFAULT_SOURCE_IDS.indeed, patterns: ["indeed.com"] },
  { sourceId: DEFAULT_SOURCE_IDS.workday, patterns: ["workdayjobs.com", "myworkdayjobs.com"] },
] as const;

export function normalizeJobText(value?: string) {
  return (value ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

export function normalizeJobLink(value?: string) {
  const trimmedValue = value?.trim();

  if (!trimmedValue) {
    return "";
  }

  try {
    const url = new URL(trimmedValue);
    url.hash = "";
    return url.toString().replace(/\/$/, "").toLocaleLowerCase();
  } catch {
    return trimmedValue.replace(/\/$/, "").toLocaleLowerCase();
  }
}

export function getJobStatusDate(job: BoardJob) {
  return job.lastStatusChangedAt || job.updatedAt;
}

function toTimestamp(value?: string) {
  if (!value) {
    return 0;
  }

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

export function getJobSortTimestamp(job: BoardJob) {
  return toTimestamp(job.lastStatusChangedAt || job.updatedAt || job.createdAt);
}

function normalizeJobColumnSort(sort: JobColumnSort = "latest"): JobSortMode {
  if (sort === "asc") {
    return "oldest";
  }

  if (sort === "desc") {
    return "latest";
  }

  return sort;
}

export function sortJobsForColumn(jobs: BoardJob[], sort: JobColumnSort = "latest") {
  const sortMode = normalizeJobColumnSort(sort);

  if (sortMode === "manual") {
    return jobs.toSorted((a, b) => {
      const aPosition = a.position ?? Number.POSITIVE_INFINITY;
      const bPosition = b.position ?? Number.POSITIVE_INFINITY;

      if (aPosition !== bPosition) {
        return aPosition - bPosition;
      }

      const timestampDifference = getJobSortTimestamp(b) - getJobSortTimestamp(a);

      if (timestampDifference !== 0) {
        return timestampDifference;
      }

      return a.id.localeCompare(b.id);
    });
  }

  const directionMultiplier = sortMode === "oldest" ? 1 : -1;

  return jobs.toSorted((a, b) => {
    const timestampDifference = getJobSortTimestamp(a) - getJobSortTimestamp(b);

    if (timestampDifference !== 0) {
      return timestampDifference * directionMultiplier;
    }

    const aPosition = a.position ?? Number.POSITIVE_INFINITY;
    const bPosition = b.position ?? Number.POSITIVE_INFINITY;

    if (aPosition !== bPosition) {
      return aPosition - bPosition;
    }

    const createdAtDifference = toTimestamp(a.createdAt) - toTimestamp(b.createdAt);

    if (createdAtDifference !== 0) {
      return createdAtDifference * directionMultiplier;
    }

    return a.id.localeCompare(b.id);
  });
}

export function isNoUpdate14DaysJob(job: BoardJob, now = new Date()) {
  if (
    job.columnId !== DEFAULT_COLUMN_IDS.applied &&
    job.columnId !== DEFAULT_COLUMN_IDS.interview
  ) {
    return false;
  }

  return now.getTime() - new Date(getJobStatusDate(job)).getTime() >= noUpdateThresholdMs;
}

export function findPossibleDuplicateJob({
  companyName,
  excludeJobId,
  jobs,
  link,
  title,
}: DuplicateJobInput) {
  const normalizedCompanyName = normalizeJobText(companyName);
  const normalizedTitle = normalizeJobText(title);
  const normalizedLink = normalizeJobLink(link);

  return jobs.find((job) => {
    if (job.id === excludeJobId) {
      return false;
    }

    if (normalizedLink && normalizeJobLink(job.link) === normalizedLink) {
      return true;
    }

    return (
      normalizedCompanyName &&
      normalizedTitle &&
      normalizeJobText(job.companyName) === normalizedCompanyName &&
      normalizeJobText(job.title) === normalizedTitle
    );
  });
}

export function inferSourceIdFromLink(link: string | undefined, sources: Source[]) {
  const normalizedLink = normalizeJobLink(link);

  if (!normalizedLink) {
    return undefined;
  }

  const match = sourceMatchers.find((matcher) =>
    matcher.patterns.some((pattern) => normalizedLink.includes(pattern)),
  );

  if (!match) {
    return undefined;
  }

  return sources.some((source) => source.id === match.sourceId) ? match.sourceId : undefined;
}

export function isReferralSource(sourceId: string | undefined, sources: Source[]) {
  if (!sourceId) {
    return false;
  }

  const source = sources.find((nextSource) => nextSource.id === sourceId);
  return sourceId === DEFAULT_SOURCE_IDS.referral || source?.name.toLocaleLowerCase() === "referral";
}
