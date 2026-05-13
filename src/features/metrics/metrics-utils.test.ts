import { describe, expect, it } from "vitest";

import { DEFAULT_COLUMN_IDS, DEFAULT_SOURCE_IDS, defaultColumns, defaultSources } from "@/lib/schemas";
import type { BoardJob } from "@/lib/use-jobs";

import { calculateMetrics } from "@/lib/metrics";

function makeJob(overrides: Partial<BoardJob> = {}): BoardJob {
  const now = new Date().toISOString();
  return {
    id: "job_1",
    title: "Software Engineer",
    companyId: "company_1",
    companyName: "Acme",
    columnId: DEFAULT_COLUMN_IDS.applied,
    columnName: "Applied",
    lastStatusChangedAt: now,
    createdAt: now,
    updatedAt: now,
    tags: [],
    ...overrides,
  };
}

const base = { columns: defaultColumns, sources: defaultSources };

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

describe("calculateMetrics – empty jobs", () => {
  it("returns zero counts for all numeric fields", () => {
    const m = calculateMetrics({ ...base, jobs: [] });
    expect(m.totalJobs).toBe(0);
    expect(m.applicationsThisWeek).toBe(0);
    expect(m.applicationsThisMonth).toBe(0);
    expect(m.appliedJobCount).toBe(0);
    expect(m.interviewRate).toBe(0);
    expect(m.offerRate).toBe(0);
    expect(m.rejectionCount).toBe(0);
    expect(m.noResponseCount).toBe(0);
    expect(m.staleJobCount).toBe(0);
  });

  it("returns null for averageDaysInCurrentStatus", () => {
    expect(calculateMetrics({ ...base, jobs: [] }).averageDaysInCurrentStatus).toBeNull();
  });

  it("returns empty arrays for lists", () => {
    const m = calculateMetrics({ ...base, jobs: [] });
    expect(m.needsAttention).toEqual([]);
    expect(m.topSources).toEqual([]);
    expect(m.topTags).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Counts
// ---------------------------------------------------------------------------

describe("calculateMetrics – counts", () => {
  it("counts total jobs", () => {
    const jobs = [makeJob({ id: "j1" }), makeJob({ id: "j2" }), makeJob({ id: "j3" })];
    expect(calculateMetrics({ ...base, jobs }).totalJobs).toBe(3);
  });

  it("counts rejection column jobs", () => {
    const jobs = [
      makeJob({ id: "j1", columnId: DEFAULT_COLUMN_IDS.rejected }),
      makeJob({ id: "j2", columnId: DEFAULT_COLUMN_IDS.rejected }),
      makeJob({ id: "j3", columnId: DEFAULT_COLUMN_IDS.applied }),
    ];
    expect(calculateMetrics({ ...base, jobs }).rejectionCount).toBe(2);
  });

  it("counts no-response column jobs", () => {
    const jobs = [
      makeJob({ id: "j1", columnId: DEFAULT_COLUMN_IDS.noResponse }),
      makeJob({ id: "j2", columnId: DEFAULT_COLUMN_IDS.applied }),
    ];
    expect(calculateMetrics({ ...base, jobs }).noResponseCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Application dates
// ---------------------------------------------------------------------------

describe("calculateMetrics – application dates", () => {
  // June 15, 2024 is a Saturday; week starts Sunday June 9
  const now = new Date("2024-06-15T12:00:00.000Z");

  it("counts applications this week (by appliedAt)", () => {
    const jobs = [
      makeJob({ id: "j1", appliedAt: "2024-06-12T08:00:00.000Z" }), // Wed — in week
      makeJob({ id: "j2", appliedAt: "2024-06-05T08:00:00.000Z" }), // previous week
      makeJob({ id: "j3" }), // no appliedAt
    ];
    expect(calculateMetrics({ ...base, jobs, now }).applicationsThisWeek).toBe(1);
  });

  it("counts applications this month (by appliedAt)", () => {
    // Use mid-month dates to avoid timezone boundary issues with startOfMonth
    const jobs = [
      makeJob({ id: "j1", appliedAt: "2024-06-10T12:00:00.000Z" }), // mid-June — in month
      makeJob({ id: "j2", appliedAt: "2024-05-20T12:00:00.000Z" }), // mid-May — previous month
    ];
    expect(calculateMetrics({ ...base, jobs, now }).applicationsThisMonth).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Rates
// ---------------------------------------------------------------------------

describe("calculateMetrics – interview and offer rates", () => {
  it("calculates interview rate as (interview+offer) / appliedJobCount", () => {
    // isAppliedJob: has appliedAt OR is not in wishlist
    // j1 (applied col, no appliedAt) → applied
    // j2 (applied col, no appliedAt) → applied
    // j3 (interview col) → applied + in laterStage
    // j4 (offer col) → applied + in laterStage
    // appliedJobCount = 4, interviewCount = 2 → rate = 50
    const jobs = [
      makeJob({ id: "j1", columnId: DEFAULT_COLUMN_IDS.applied }),
      makeJob({ id: "j2", columnId: DEFAULT_COLUMN_IDS.applied }),
      makeJob({ id: "j3", columnId: DEFAULT_COLUMN_IDS.interview }),
      makeJob({ id: "j4", columnId: DEFAULT_COLUMN_IDS.offer }),
    ];
    const m = calculateMetrics({ ...base, jobs });
    expect(m.appliedJobCount).toBe(4);
    expect(m.interviewRate).toBe(50);
  });

  it("calculates offer rate as offerCount / appliedJobCount", () => {
    const jobs = [
      makeJob({ id: "j1", columnId: DEFAULT_COLUMN_IDS.applied }),
      makeJob({ id: "j2", columnId: DEFAULT_COLUMN_IDS.offer }),
    ];
    expect(calculateMetrics({ ...base, jobs }).offerRate).toBe(50);
  });

  it("returns 0 for rates when there are no applied jobs", () => {
    const jobs = [makeJob({ id: "j1", columnId: DEFAULT_COLUMN_IDS.wishlist })];
    const m = calculateMetrics({ ...base, jobs });
    expect(m.interviewRate).toBe(0);
    expect(m.offerRate).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Stale / needs attention
// ---------------------------------------------------------------------------

describe("calculateMetrics – stale jobs", () => {
  const now = new Date("2024-06-15T00:00:00.000Z");
  const stale = "2024-05-01T00:00:00.000Z"; // 45 days ago
  const fresh = "2024-06-14T00:00:00.000Z"; // 1 day ago

  it("counts applied+interview jobs with no update in 14+ days", () => {
    const jobs = [
      makeJob({ id: "j1", columnId: DEFAULT_COLUMN_IDS.applied, lastStatusChangedAt: stale }),
      makeJob({ id: "j2", columnId: DEFAULT_COLUMN_IDS.interview, lastStatusChangedAt: stale }),
      makeJob({ id: "j3", columnId: DEFAULT_COLUMN_IDS.applied, lastStatusChangedAt: fresh }),
      makeJob({ id: "j4", columnId: DEFAULT_COLUMN_IDS.wishlist, lastStatusChangedAt: stale }),
    ];
    const m = calculateMetrics({ ...base, jobs, now });
    expect(m.staleJobCount).toBe(2);
    expect(m.needsAttention).toHaveLength(2);
    expect(m.needsAttention.map((j) => j.id).sort()).toEqual(["j1", "j2"]);
  });

  it("needsAttention entries include id, title, companyName, status, lastUpdateAt", () => {
    const jobs = [
      makeJob({
        id: "j1",
        title: "SWE",
        companyName: "Acme",
        columnId: DEFAULT_COLUMN_IDS.applied,
        columnName: "Applied",
        lastStatusChangedAt: stale,
      }),
    ];
    const [entry] = calculateMetrics({ ...base, jobs, now }).needsAttention;
    expect(entry.id).toBe("j1");
    expect(entry.title).toBe("SWE");
    expect(entry.companyName).toBe("Acme");
    expect(entry.status).toBe("Applied");
    expect(entry.lastUpdateAt).toBe(stale);
  });
});

// ---------------------------------------------------------------------------
// Top sources & tags
// ---------------------------------------------------------------------------

describe("calculateMetrics – top sources", () => {
  it("ranks sources by frequency descending", () => {
    const jobs = [
      makeJob({ id: "j1", sourceId: DEFAULT_SOURCE_IDS.linkedin }),
      makeJob({ id: "j2", sourceId: DEFAULT_SOURCE_IDS.linkedin }),
      makeJob({ id: "j3", sourceId: DEFAULT_SOURCE_IDS.indeed }),
    ];
    const { topSources } = calculateMetrics({ ...base, jobs });
    expect(topSources[0].id).toBe(DEFAULT_SOURCE_IDS.linkedin);
    expect(topSources[0].value).toBe(2);
    expect(topSources[1].id).toBe(DEFAULT_SOURCE_IDS.indeed);
    expect(topSources[1].value).toBe(1);
  });

  it("groups jobs without a sourceId under a single direct bucket", () => {
    const jobs = [makeJob({ id: "j1" }), makeJob({ id: "j2" })];
    const { topSources } = calculateMetrics({ ...base, jobs });
    expect(topSources[0].id).toBe("source_direct");
    expect(topSources[0].value).toBe(2);
  });
});

describe("calculateMetrics – top tags", () => {
  it("ranks tags by frequency descending", () => {
    const jobs = [
      makeJob({ id: "j1", tags: ["react", "typescript"] }),
      makeJob({ id: "j2", tags: ["react", "node"] }),
      makeJob({ id: "j3", tags: ["typescript"] }),
    ];
    const { topTags } = calculateMetrics({ ...base, jobs });
    expect(topTags[0].id).toBe("react");
    expect(topTags[0].value).toBe(2);
  });

  it("returns an empty array for jobs with no tags", () => {
    const jobs = [makeJob({ id: "j1" }), makeJob({ id: "j2" })];
    expect(calculateMetrics({ ...base, jobs }).topTags).toEqual([]);
  });
});
