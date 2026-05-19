import { describe, expect, it } from "vitest";

import { DEFAULT_COLUMN_IDS, defaultColumns } from "@/lib/schemas";
import type { Activity } from "@/lib/schemas";
import type { BoardJob } from "@/lib/use-jobs";

import { calculatePipelineMetrics, getColumnMetricColor } from "@/lib/pipeline-metrics";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOW = new Date().toISOString();

function makeJob(overrides: Partial<BoardJob> = {}): BoardJob {
  return {
    id: "job_1",
    title: "Software Engineer",
    companyId: "company_1",
    companyName: "Acme",
    columnId: DEFAULT_COLUMN_IDS.applied,
    columnName: "Applied",
    lastStatusChangedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    tags: [],
    ...overrides,
  };
}

function makeActivity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: "act_1",
    jobId: "job_1",
    type: "moved",
    message: "Moved",
    createdAt: NOW,
    ...overrides,
  };
}

const base = { activities: [] as Activity[], columns: defaultColumns };

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

describe("calculatePipelineMetrics – empty jobs", () => {
  it("returns zero for all counts", () => {
    const m = calculatePipelineMetrics({ ...base, jobs: [] });
    expect(m.appliedCount).toBe(0);
    expect(m.interviewReachedCount).toBe(0);
    expect(m.offerCount).toBe(0);
    expect(m.rejectedCount).toBe(0);
    expect(m.noResponseCount).toBe(0);
    expect(m.archivedCount).toBe(0);
    expect(m.pendingAppliedCount).toBe(0);
  });

  it("returns zero for all rates when no applied jobs", () => {
    const m = calculatePipelineMetrics({ ...base, jobs: [] });
    expect(m.interviewRate).toBe(0);
    expect(m.offerRate).toBe(0);
    expect(m.rejectionRate).toBe(0);
    expect(m.noResponseRate).toBe(0);
    expect(m.archivedRate).toBe(0);
  });

  it("returns empty archivedBreakdown", () => {
    expect(calculatePipelineMetrics({ ...base, jobs: [] }).archivedBreakdown).toEqual([]);
  });

  it("currentStatus includes all default columns with count 0", () => {
    const m = calculatePipelineMetrics({ ...base, jobs: [] });
    expect(m.currentStatus.length).toBe(defaultColumns.length);
    expect(m.currentStatus.every((s) => s.count === 0)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Applied count
// ---------------------------------------------------------------------------

describe("calculatePipelineMetrics – appliedCount", () => {
  it("counts jobs with appliedAt set", () => {
    const jobs = [
      makeJob({ id: "j1", appliedAt: NOW }),
      makeJob({ id: "j2", columnId: DEFAULT_COLUMN_IDS.wishlist }),
    ];
    expect(calculatePipelineMetrics({ ...base, jobs }).appliedCount).toBe(1);
  });

  it("counts jobs not in wishlist as applied even without appliedAt", () => {
    const jobs = [
      makeJob({ id: "j1", columnId: DEFAULT_COLUMN_IDS.applied }),
      makeJob({ id: "j2", columnId: DEFAULT_COLUMN_IDS.wishlist }),
    ];
    expect(calculatePipelineMetrics({ ...base, jobs }).appliedCount).toBe(1);
  });

  it("does not double-count a job with appliedAt that is also not in wishlist", () => {
    const jobs = [makeJob({ id: "j1", columnId: DEFAULT_COLUMN_IDS.applied, appliedAt: NOW })];
    expect(calculatePipelineMetrics({ ...base, jobs }).appliedCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// pendingAppliedCount
// ---------------------------------------------------------------------------

describe("calculatePipelineMetrics – pendingAppliedCount", () => {
  it("counts only jobs currently in the Applied column", () => {
    const jobs = [
      makeJob({ id: "j1", columnId: DEFAULT_COLUMN_IDS.applied }),
      makeJob({ id: "j2", columnId: DEFAULT_COLUMN_IDS.applied }),
      makeJob({ id: "j3", columnId: DEFAULT_COLUMN_IDS.interview }),
    ];
    expect(calculatePipelineMetrics({ ...base, jobs }).pendingAppliedCount).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Interview reached count — current column
// ---------------------------------------------------------------------------

describe("calculatePipelineMetrics – interviewReachedCount via current column", () => {
  it("counts jobs currently in interview", () => {
    const jobs = [
      makeJob({ id: "j1", columnId: DEFAULT_COLUMN_IDS.interview }),
      makeJob({ id: "j2", columnId: DEFAULT_COLUMN_IDS.applied }),
    ];
    expect(calculatePipelineMetrics({ ...base, jobs }).interviewReachedCount).toBe(1);
  });

  it("counts jobs currently in offer as having reached interview", () => {
    const jobs = [makeJob({ id: "j1", columnId: DEFAULT_COLUMN_IDS.offer })];
    expect(calculatePipelineMetrics({ ...base, jobs }).interviewReachedCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Interview reached count — activity history
// ---------------------------------------------------------------------------

describe("calculatePipelineMetrics – interviewReachedCount via activity history", () => {
  it("counts a job that moved to interview but is now in rejected", () => {
    const job = makeJob({ id: "j1", columnId: DEFAULT_COLUMN_IDS.rejected });
    const act = makeActivity({
      id: "a1",
      jobId: "j1",
      type: "moved",
      toColumnId: DEFAULT_COLUMN_IDS.interview,
    });
    expect(
      calculatePipelineMetrics({ activities: [act], columns: defaultColumns, jobs: [job] })
        .interviewReachedCount,
    ).toBe(1);
  });

  it("counts a job that moved to offer but is now in no response", () => {
    const job = makeJob({ id: "j1", columnId: DEFAULT_COLUMN_IDS.noResponse });
    const act = makeActivity({
      id: "a1",
      jobId: "j1",
      type: "moved",
      toColumnId: DEFAULT_COLUMN_IDS.offer,
    });
    expect(
      calculatePipelineMetrics({ activities: [act], columns: defaultColumns, jobs: [job] })
        .interviewReachedCount,
    ).toBe(1);
  });

  it("does not double-count a job that is currently in interview and has a matching activity", () => {
    const job = makeJob({ id: "j1", columnId: DEFAULT_COLUMN_IDS.interview });
    const act = makeActivity({
      id: "a1",
      jobId: "j1",
      type: "moved",
      toColumnId: DEFAULT_COLUMN_IDS.interview,
    });
    expect(
      calculatePipelineMetrics({ activities: [act], columns: defaultColumns, jobs: [job] })
        .interviewReachedCount,
    ).toBe(1);
  });

  it("ignores activities of other types when checking interview reached", () => {
    const job = makeJob({ id: "j1", columnId: DEFAULT_COLUMN_IDS.applied });
    const act = makeActivity({
      id: "a1",
      jobId: "j1",
      type: "updated",
      toColumnId: DEFAULT_COLUMN_IDS.interview,
    });
    expect(
      calculatePipelineMetrics({ activities: [act], columns: defaultColumns, jobs: [job] })
        .interviewReachedCount,
    ).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Offer count
// ---------------------------------------------------------------------------

describe("calculatePipelineMetrics – offerCount", () => {
  it("counts jobs currently in offer", () => {
    const jobs = [makeJob({ id: "j1", columnId: DEFAULT_COLUMN_IDS.offer })];
    expect(calculatePipelineMetrics({ ...base, jobs }).offerCount).toBe(1);
  });

  it("counts jobs that moved to offer but are now elsewhere", () => {
    const job = makeJob({ id: "j1", columnId: DEFAULT_COLUMN_IDS.rejected });
    const act = makeActivity({
      id: "a1",
      jobId: "j1",
      type: "moved",
      toColumnId: DEFAULT_COLUMN_IDS.offer,
    });
    expect(
      calculatePipelineMetrics({ activities: [act], columns: defaultColumns, jobs: [job] })
        .offerCount,
    ).toBe(1);
  });

  it("does not double-count a job currently in offer with a matching activity", () => {
    const job = makeJob({ id: "j1", columnId: DEFAULT_COLUMN_IDS.offer });
    const act = makeActivity({
      id: "a1",
      jobId: "j1",
      type: "moved",
      toColumnId: DEFAULT_COLUMN_IDS.offer,
    });
    expect(
      calculatePipelineMetrics({ activities: [act], columns: defaultColumns, jobs: [job] })
        .offerCount,
    ).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Rejected count
// ---------------------------------------------------------------------------

describe("calculatePipelineMetrics – rejectedCount", () => {
  it("counts jobs currently in rejected column", () => {
    const jobs = [makeJob({ id: "j1", columnId: DEFAULT_COLUMN_IDS.rejected })];
    expect(calculatePipelineMetrics({ ...base, jobs }).rejectedCount).toBe(1);
  });

  it("counts jobs with rejectedAt set regardless of current column", () => {
    const jobs = [
      makeJob({ id: "j1", columnId: DEFAULT_COLUMN_IDS.applied, rejectedAt: NOW }),
    ];
    expect(calculatePipelineMetrics({ ...base, jobs }).rejectedCount).toBe(1);
  });

  it("counts jobs that moved to rejected via activity history", () => {
    const job = makeJob({ id: "j1", columnId: DEFAULT_COLUMN_IDS.archived });
    const act = makeActivity({
      id: "a1",
      jobId: "j1",
      type: "moved",
      toColumnId: DEFAULT_COLUMN_IDS.rejected,
    });
    expect(
      calculatePipelineMetrics({ activities: [act], columns: defaultColumns, jobs: [job] })
        .rejectedCount,
    ).toBe(1);
  });

  it("does not double-count a job in rejected with rejectedAt and a matching activity", () => {
    const job = makeJob({
      id: "j1",
      columnId: DEFAULT_COLUMN_IDS.rejected,
      rejectedAt: NOW,
    });
    const act = makeActivity({
      id: "a1",
      jobId: "j1",
      type: "moved",
      toColumnId: DEFAULT_COLUMN_IDS.rejected,
    });
    expect(
      calculatePipelineMetrics({ activities: [act], columns: defaultColumns, jobs: [job] })
        .rejectedCount,
    ).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// No response count
// ---------------------------------------------------------------------------

describe("calculatePipelineMetrics – noResponseCount", () => {
  it("counts only jobs in the No Response column", () => {
    const jobs = [
      makeJob({ id: "j1", columnId: DEFAULT_COLUMN_IDS.noResponse }),
      makeJob({ id: "j2", columnId: DEFAULT_COLUMN_IDS.applied }),
    ];
    expect(calculatePipelineMetrics({ ...base, jobs }).noResponseCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Archived count and breakdown
// ---------------------------------------------------------------------------

describe("calculatePipelineMetrics – archivedCount and breakdown", () => {
  it("counts jobs in the archived column", () => {
    const jobs = [
      makeJob({ id: "j1", columnId: DEFAULT_COLUMN_IDS.archived }),
      makeJob({ id: "j2", columnId: DEFAULT_COLUMN_IDS.archived, archivedReason: "expired" }),
    ];
    expect(calculatePipelineMetrics({ ...base, jobs }).archivedCount).toBe(2);
  });

  it("groups archived jobs by reason", () => {
    const jobs = [
      makeJob({ id: "j1", columnId: DEFAULT_COLUMN_IDS.archived, archivedReason: "expired" }),
      makeJob({ id: "j2", columnId: DEFAULT_COLUMN_IDS.archived, archivedReason: "expired" }),
      makeJob({ id: "j3", columnId: DEFAULT_COLUMN_IDS.archived, archivedReason: "deleted" }),
    ];
    const { archivedBreakdown } = calculatePipelineMetrics({ ...base, jobs });
    const expiredEntry = archivedBreakdown.find((e) => e.reason === "expired");
    const deletedEntry = archivedBreakdown.find((e) => e.reason === "deleted");
    expect(expiredEntry?.count).toBe(2);
    expect(expiredEntry?.label).toBe("Expired");
    expect(deletedEntry?.count).toBe(1);
    expect(deletedEntry?.label).toBe("Deleted");
  });

  it("groups archived jobs with no reason under 'other'", () => {
    const jobs = [makeJob({ id: "j1", columnId: DEFAULT_COLUMN_IDS.archived })];
    const { archivedBreakdown } = calculatePipelineMetrics({ ...base, jobs });
    expect(archivedBreakdown[0].reason).toBe("other");
    expect(archivedBreakdown[0].label).toBe("Other");
  });
});

// ---------------------------------------------------------------------------
// Conversion rates
// ---------------------------------------------------------------------------

describe("calculatePipelineMetrics – rates", () => {
  it("calculates interviewRate as interviewReachedCount / appliedCount", () => {
    const jobs = [
      makeJob({ id: "j1", columnId: DEFAULT_COLUMN_IDS.applied }),
      makeJob({ id: "j2", columnId: DEFAULT_COLUMN_IDS.applied }),
      makeJob({ id: "j3", columnId: DEFAULT_COLUMN_IDS.interview }),
      makeJob({ id: "j4", columnId: DEFAULT_COLUMN_IDS.offer }),
    ];
    // appliedCount=4, interviewReached=2 → 50%
    expect(calculatePipelineMetrics({ ...base, jobs }).interviewRate).toBe(50);
  });

  it("calculates offerRate as offerCount / appliedCount", () => {
    const jobs = [
      makeJob({ id: "j1", columnId: DEFAULT_COLUMN_IDS.applied }),
      makeJob({ id: "j2", columnId: DEFAULT_COLUMN_IDS.offer }),
    ];
    expect(calculatePipelineMetrics({ ...base, jobs }).offerRate).toBe(50);
  });

  it("calculates rejectionRate as rejectedCount / appliedCount", () => {
    const jobs = [
      makeJob({ id: "j1", columnId: DEFAULT_COLUMN_IDS.applied }),
      makeJob({ id: "j2", columnId: DEFAULT_COLUMN_IDS.applied }),
      makeJob({ id: "j3", columnId: DEFAULT_COLUMN_IDS.rejected }),
      makeJob({ id: "j4", columnId: DEFAULT_COLUMN_IDS.rejected }),
    ];
    // appliedCount=4, rejectedCount=2 → 50%
    expect(calculatePipelineMetrics({ ...base, jobs }).rejectionRate).toBe(50);
  });

  it("returns 0 for all rates when no applied jobs", () => {
    const jobs = [makeJob({ id: "j1", columnId: DEFAULT_COLUMN_IDS.wishlist })];
    const m = calculatePipelineMetrics({ ...base, jobs });
    expect(m.interviewRate).toBe(0);
    expect(m.offerRate).toBe(0);
    expect(m.rejectionRate).toBe(0);
    expect(m.noResponseRate).toBe(0);
    expect(m.archivedRate).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// currentStatus distribution
// ---------------------------------------------------------------------------

describe("calculatePipelineMetrics – currentStatus", () => {
  it("includes all columns in currentStatus", () => {
    const jobs = [makeJob({ id: "j1", columnId: DEFAULT_COLUMN_IDS.applied })];
    const { currentStatus } = calculatePipelineMetrics({ ...base, jobs });
    expect(currentStatus.length).toBe(defaultColumns.length);
  });

  it("computes correct count per column", () => {
    const jobs = [
      makeJob({ id: "j1", columnId: DEFAULT_COLUMN_IDS.applied }),
      makeJob({ id: "j2", columnId: DEFAULT_COLUMN_IDS.applied }),
      makeJob({ id: "j3", columnId: DEFAULT_COLUMN_IDS.interview }),
    ];
    const { currentStatus } = calculatePipelineMetrics({ ...base, jobs });
    const applied = currentStatus.find((s) => s.columnId === DEFAULT_COLUMN_IDS.applied);
    const interview = currentStatus.find((s) => s.columnId === DEFAULT_COLUMN_IDS.interview);
    expect(applied?.count).toBe(2);
    expect(interview?.count).toBe(1);
  });

  it("computes percentOfTotal correctly", () => {
    const jobs = [
      makeJob({ id: "j1", columnId: DEFAULT_COLUMN_IDS.applied }),
      makeJob({ id: "j2", columnId: DEFAULT_COLUMN_IDS.applied }),
      makeJob({ id: "j3", columnId: DEFAULT_COLUMN_IDS.applied }),
      makeJob({ id: "j4", columnId: DEFAULT_COLUMN_IDS.interview }),
    ];
    const { currentStatus } = calculatePipelineMetrics({ ...base, jobs });
    const applied = currentStatus.find((s) => s.columnId === DEFAULT_COLUMN_IDS.applied);
    // 3/4 = 75%
    expect(applied?.percentOfTotal).toBe(75);
  });

  it("returns 0 percentOfTotal when there are no jobs", () => {
    const { currentStatus } = calculatePipelineMetrics({ ...base, jobs: [] });
    expect(currentStatus.every((s) => s.percentOfTotal === 0)).toBe(true);
  });

  it("carries column color through to currentStatus entries", () => {
    const jobs = [makeJob({ id: "j1", columnId: DEFAULT_COLUMN_IDS.applied })];
    const { currentStatus } = calculatePipelineMetrics({ ...base, jobs });
    const applied = currentStatus.find((s) => s.columnId === DEFAULT_COLUMN_IDS.applied);
    // default "Applied" column has color "teal"
    expect(applied?.color).toBe("teal");
  });
});

// ---------------------------------------------------------------------------
// funnelStages
// ---------------------------------------------------------------------------

describe("calculatePipelineMetrics – funnelStages", () => {
  it("returns three stages: Applied, Interview, Offer", () => {
    const m = calculatePipelineMetrics({ ...base, jobs: [] });
    const ids = m.funnelStages.map((s) => s.id);
    expect(ids).toEqual([
      DEFAULT_COLUMN_IDS.applied,
      DEFAULT_COLUMN_IDS.interview,
      DEFAULT_COLUMN_IDS.offer,
    ]);
  });

  it("applied stage always has rate 100", () => {
    const jobs = [makeJob({ id: "j1", columnId: DEFAULT_COLUMN_IDS.applied })];
    const { funnelStages } = calculatePipelineMetrics({ ...base, jobs });
    expect(funnelStages[0].rate).toBe(100);
  });

  it("funnel stage counts reflect ever-reached logic", () => {
    const job = makeJob({ id: "j1", columnId: DEFAULT_COLUMN_IDS.rejected });
    const act = makeActivity({
      jobId: "j1",
      type: "moved",
      toColumnId: DEFAULT_COLUMN_IDS.interview,
    });
    const m = calculatePipelineMetrics({
      activities: [act],
      columns: defaultColumns,
      jobs: [job],
    });
    expect(m.funnelStages[1].count).toBe(1); // interview stage
    expect(m.funnelStages[2].count).toBe(0); // offer stage
  });
});

// ---------------------------------------------------------------------------
// outcomes
// ---------------------------------------------------------------------------

describe("calculatePipelineMetrics – outcomes", () => {
  it("returns three outcomes: Rejected, No Response, Archived", () => {
    const m = calculatePipelineMetrics({ ...base, jobs: [] });
    const ids = m.outcomes.map((o) => o.id);
    expect(ids).toEqual([
      DEFAULT_COLUMN_IDS.rejected,
      DEFAULT_COLUMN_IDS.noResponse,
      DEFAULT_COLUMN_IDS.archived,
    ]);
  });

  it("outcome rates are relative to appliedCount", () => {
    const jobs = [
      makeJob({ id: "j1", columnId: DEFAULT_COLUMN_IDS.applied }),
      makeJob({ id: "j2", columnId: DEFAULT_COLUMN_IDS.applied }),
      makeJob({ id: "j3", columnId: DEFAULT_COLUMN_IDS.rejected }),
      makeJob({ id: "j4", columnId: DEFAULT_COLUMN_IDS.rejected }),
    ];
    // appliedCount=4, rejectedCount=2 → 50%
    const { outcomes } = calculatePipelineMetrics({ ...base, jobs });
    const rejected = outcomes.find((o) => o.id === DEFAULT_COLUMN_IDS.rejected);
    expect(rejected?.rate).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// getColumnMetricColor
// ---------------------------------------------------------------------------

describe("getColumnMetricColor", () => {
  it("returns a Tailwind class for known colors", () => {
    expect(getColumnMetricColor("teal")).toBe("bg-teal-500/55");
    expect(getColumnMetricColor("blue")).toBe("bg-blue-500/55");
    expect(getColumnMetricColor("red")).toBe("bg-rose-500/55");
    expect(getColumnMetricColor("green")).toBe("bg-emerald-500/55");
    expect(getColumnMetricColor("amber")).toBe("bg-amber-500/55");
    expect(getColumnMetricColor("violet")).toBe("bg-violet-500/55");
    expect(getColumnMetricColor("zinc")).toBe("bg-zinc-500/35");
    expect(getColumnMetricColor("slate")).toBe("bg-slate-500/40");
  });

  it("falls back to bg-primary/55 for unknown colors", () => {
    expect(getColumnMetricColor("magenta")).toBe("bg-primary/55");
    expect(getColumnMetricColor(undefined)).toBe("bg-primary/55");
  });
});

// ---------------------------------------------------------------------------
// Activity isolation (activities from other jobs don't bleed)
// ---------------------------------------------------------------------------

describe("calculatePipelineMetrics – activity isolation", () => {
  it("does not apply another job's activities to the wrong job", () => {
    const job = makeJob({ id: "j1", columnId: DEFAULT_COLUMN_IDS.applied });
    const act = makeActivity({
      id: "a1",
      jobId: "j2", // different job
      type: "moved",
      toColumnId: DEFAULT_COLUMN_IDS.interview,
    });
    expect(
      calculatePipelineMetrics({ activities: [act], columns: defaultColumns, jobs: [job] })
        .interviewReachedCount,
    ).toBe(0);
  });
});
