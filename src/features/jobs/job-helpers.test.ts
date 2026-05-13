import { describe, expect, it } from "vitest";

import { DEFAULT_COLUMN_IDS, DEFAULT_SOURCE_IDS, defaultSources } from "@/lib/schemas";
import type { BoardJob } from "@/lib/use-jobs";

import {
  findPossibleDuplicateJob,
  getJobSortTimestamp,
  inferSourceIdFromLink,
  isNoUpdate14DaysJob,
  isReferralSource,
  normalizeJobLink,
  normalizeJobText,
  sortJobsForColumn,
} from "./job-helpers";

function makeJob(overrides: Partial<BoardJob> = {}): BoardJob {
  const now = new Date().toISOString();
  return {
    id: "job_1",
    title: "Software Engineer",
    companyId: "company_1",
    companyName: "Acme Corp",
    columnId: DEFAULT_COLUMN_IDS.applied,
    columnName: "Applied",
    lastStatusChangedAt: now,
    createdAt: now,
    updatedAt: now,
    tags: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// normalizeJobText
// ---------------------------------------------------------------------------

describe("normalizeJobText", () => {
  it("trims leading and trailing whitespace", () => {
    expect(normalizeJobText("  hello  ")).toBe("hello");
  });

  it("collapses multiple internal spaces", () => {
    expect(normalizeJobText("hello   world")).toBe("hello world");
  });

  it("lowercases the text", () => {
    expect(normalizeJobText("Software ENGINEER")).toBe("software engineer");
  });

  it("returns empty string for undefined", () => {
    expect(normalizeJobText(undefined)).toBe("");
  });

  it("returns empty string for empty input", () => {
    expect(normalizeJobText("")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// normalizeJobLink
// ---------------------------------------------------------------------------

describe("normalizeJobLink", () => {
  it("strips the URL hash fragment", () => {
    expect(normalizeJobLink("https://example.com/job#apply")).toBe("https://example.com/job");
  });

  it("removes a trailing slash", () => {
    expect(normalizeJobLink("https://example.com/job/")).toBe("https://example.com/job");
  });

  it("lowercases the URL", () => {
    expect(normalizeJobLink("HTTPS://Example.COM/Job")).toBe("https://example.com/job");
  });

  it("returns empty string for undefined", () => {
    expect(normalizeJobLink(undefined)).toBe("");
  });

  it("returns empty string for an empty string", () => {
    expect(normalizeJobLink("")).toBe("");
  });

  it("handles an invalid URL string gracefully", () => {
    expect(normalizeJobLink("not-a-url")).toBe("not-a-url");
  });

  it("preserves query parameters", () => {
    expect(normalizeJobLink("https://example.com/job?ref=linkedin")).toBe(
      "https://example.com/job?ref=linkedin",
    );
  });
});

// ---------------------------------------------------------------------------
// isNoUpdate14DaysJob
// ---------------------------------------------------------------------------

describe("isNoUpdate14DaysJob", () => {
  it("returns false for a wishlist column regardless of age", () => {
    const stale = new Date(Date.now() - 20 * 86_400_000).toISOString();
    const job = makeJob({ columnId: DEFAULT_COLUMN_IDS.wishlist, lastStatusChangedAt: stale });
    expect(isNoUpdate14DaysJob(job)).toBe(false);
  });

  it("returns false for a rejected column regardless of age", () => {
    const stale = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const job = makeJob({ columnId: DEFAULT_COLUMN_IDS.rejected, lastStatusChangedAt: stale });
    expect(isNoUpdate14DaysJob(job)).toBe(false);
  });

  it("returns false for an applied job updated less than 14 days ago", () => {
    const recent = new Date(Date.now() - 3 * 86_400_000).toISOString();
    const job = makeJob({ columnId: DEFAULT_COLUMN_IDS.applied, lastStatusChangedAt: recent });
    expect(isNoUpdate14DaysJob(job)).toBe(false);
  });

  it("returns true for an applied job stale for 15+ days", () => {
    const stale = new Date(Date.now() - 15 * 86_400_000).toISOString();
    const job = makeJob({ columnId: DEFAULT_COLUMN_IDS.applied, lastStatusChangedAt: stale });
    expect(isNoUpdate14DaysJob(job)).toBe(true);
  });

  it("returns true for an interview job stale for 15+ days", () => {
    const stale = new Date(Date.now() - 20 * 86_400_000).toISOString();
    const job = makeJob({ columnId: DEFAULT_COLUMN_IDS.interview, lastStatusChangedAt: stale });
    expect(isNoUpdate14DaysJob(job)).toBe(true);
  });

  it("respects the custom `now` parameter", () => {
    const statusDate = "2024-01-01T00:00:00.000Z";
    const job = makeJob({ columnId: DEFAULT_COLUMN_IDS.applied, lastStatusChangedAt: statusDate });

    const after31Days = new Date("2024-02-01T00:00:00.000Z");
    expect(isNoUpdate14DaysJob(job, after31Days)).toBe(true);

    const after1Day = new Date("2024-01-02T00:00:00.000Z");
    expect(isNoUpdate14DaysJob(job, after1Day)).toBe(false);
  });

  it("falls back to updatedAt when lastStatusChangedAt is absent", () => {
    const stale = new Date(Date.now() - 15 * 86_400_000).toISOString();
    const job = makeJob({
      columnId: DEFAULT_COLUMN_IDS.applied,
      lastStatusChangedAt: "",
      updatedAt: stale,
    });
    expect(isNoUpdate14DaysJob(job)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// job column sorting
// ---------------------------------------------------------------------------

describe("getJobSortTimestamp", () => {
  it("uses lastStatusChangedAt first", () => {
    const job = makeJob({
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-10T00:00:00.000Z",
      lastStatusChangedAt: "2024-01-20T00:00:00.000Z",
    });

    expect(getJobSortTimestamp(job)).toBe(new Date("2024-01-20T00:00:00.000Z").getTime());
  });

  it("falls back to updatedAt", () => {
    const job = makeJob({
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-10T00:00:00.000Z",
      lastStatusChangedAt: "",
    });

    expect(getJobSortTimestamp(job)).toBe(new Date("2024-01-10T00:00:00.000Z").getTime());
  });

  it("falls back to createdAt", () => {
    const job = makeJob({
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "",
      lastStatusChangedAt: "",
    });

    expect(getJobSortTimestamp(job)).toBe(new Date("2024-01-01T00:00:00.000Z").getTime());
  });
});

describe("sortJobsForColumn", () => {
  it("sorts newest first by default", () => {
    const oldJob = makeJob({
      id: "job_old",
      lastStatusChangedAt: "2024-01-01T00:00:00.000Z",
    });
    const newJob = makeJob({
      id: "job_new",
      lastStatusChangedAt: "2024-02-01T00:00:00.000Z",
    });

    expect(sortJobsForColumn([oldJob, newJob]).map((job) => job.id)).toEqual([
      "job_new",
      "job_old",
    ]);
  });

  it("can sort oldest first when requested", () => {
    const oldJob = makeJob({
      id: "job_old",
      lastStatusChangedAt: "2024-01-01T00:00:00.000Z",
    });
    const newJob = makeJob({
      id: "job_new",
      lastStatusChangedAt: "2024-02-01T00:00:00.000Z",
    });

    expect(sortJobsForColumn([newJob, oldJob], "oldest").map((job) => job.id)).toEqual([
      "job_old",
      "job_new",
    ]);
  });

  it("keeps moved jobs above older jobs after lastStatusChangedAt changes", () => {
    const olderJob = makeJob({
      id: "job_older",
      lastStatusChangedAt: "2024-02-01T00:00:00.000Z",
    });
    const movedJob = makeJob({
      id: "job_moved",
      lastStatusChangedAt: "2024-03-01T00:00:00.000Z",
    });

    expect(sortJobsForColumn([olderJob, movedJob], "latest").map((job) => job.id)).toEqual([
      "job_moved",
      "job_older",
    ]);
  });

  it("supports the legacy ascending direction alias", () => {
    const oldJob = makeJob({
      id: "job_old",
      lastStatusChangedAt: "2024-01-01T00:00:00.000Z",
    });
    const newJob = makeJob({
      id: "job_new",
      lastStatusChangedAt: "2024-02-01T00:00:00.000Z",
    });

    expect(sortJobsForColumn([newJob, oldJob], "asc").map((job) => job.id)).toEqual([
      "job_old",
      "job_new",
    ]);
  });

  it("can sort by manual position", () => {
    const latestJob = makeJob({
      id: "job_latest",
      lastStatusChangedAt: "2024-03-01T00:00:00.000Z",
      position: 2000,
    });
    const firstManualJob = makeJob({
      id: "job_manual_first",
      lastStatusChangedAt: "2024-01-01T00:00:00.000Z",
      position: 1000,
    });

    expect(sortJobsForColumn([latestJob, firstManualJob], "manual").map((job) => job.id)).toEqual([
      "job_manual_first",
      "job_latest",
    ]);
  });

  it("uses position as a stable tie-breaker without making it the primary sort", () => {
    const timestamp = "2024-02-01T00:00:00.000Z";
    const firstPosition = makeJob({
      id: "job_position_1",
      lastStatusChangedAt: timestamp,
      position: 1000,
    });
    const secondPosition = makeJob({
      id: "job_position_2",
      lastStatusChangedAt: timestamp,
      position: 2000,
    });
    const newest = makeJob({
      id: "job_newest",
      lastStatusChangedAt: "2024-03-01T00:00:00.000Z",
      position: 9000,
    });

    expect(sortJobsForColumn([secondPosition, newest, firstPosition]).map((job) => job.id)).toEqual(
      ["job_newest", "job_position_1", "job_position_2"],
    );
  });

  it("uses job id as the final deterministic tie-breaker", () => {
    const timestamp = "2024-02-01T00:00:00.000Z";
    const jobB = makeJob({ id: "job_b", lastStatusChangedAt: timestamp });
    const jobA = makeJob({ id: "job_a", lastStatusChangedAt: timestamp });

    expect(sortJobsForColumn([jobB, jobA]).map((job) => job.id)).toEqual(["job_a", "job_b"]);
  });
});

// ---------------------------------------------------------------------------
// findPossibleDuplicateJob
// ---------------------------------------------------------------------------

describe("findPossibleDuplicateJob", () => {
  const existing = makeJob({
    id: "job_1",
    title: "Software Engineer",
    companyName: "Acme Corp",
    link: "https://acme.com/jobs/se",
  });

  it("returns undefined when there are no jobs", () => {
    expect(
      findPossibleDuplicateJob({ jobs: [], title: "Engineer", companyName: "Acme" }),
    ).toBeUndefined();
  });

  it("matches by normalized URL (trailing slash ignored)", () => {
    const result = findPossibleDuplicateJob({
      jobs: [existing],
      link: "https://acme.com/jobs/se/",
    });
    expect(result?.id).toBe("job_1");
  });

  it("matches by URL with hash stripped", () => {
    const result = findPossibleDuplicateJob({
      jobs: [existing],
      link: "https://acme.com/jobs/se#apply",
    });
    expect(result?.id).toBe("job_1");
  });

  it("matches by normalized company + title pair", () => {
    const result = findPossibleDuplicateJob({
      jobs: [existing],
      title: "  SOFTWARE ENGINEER  ",
      companyName: "ACME CORP",
    });
    expect(result?.id).toBe("job_1");
  });

  it("respects excludeJobId", () => {
    const result = findPossibleDuplicateJob({
      excludeJobId: "job_1",
      jobs: [existing],
      title: "Software Engineer",
      companyName: "Acme Corp",
    });
    expect(result).toBeUndefined();
  });

  it("does not match when only the title matches", () => {
    const result = findPossibleDuplicateJob({
      jobs: [existing],
      title: "Software Engineer",
      companyName: "Different Corp",
    });
    expect(result).toBeUndefined();
  });

  it("does not match when only the company matches", () => {
    const result = findPossibleDuplicateJob({
      jobs: [existing],
      title: "Product Manager",
      companyName: "Acme Corp",
    });
    expect(result).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// inferSourceIdFromLink
// ---------------------------------------------------------------------------

describe("inferSourceIdFromLink", () => {
  it("infers LinkedIn from a linkedin.com URL", () => {
    expect(
      inferSourceIdFromLink("https://www.linkedin.com/jobs/view/123456", defaultSources),
    ).toBe(DEFAULT_SOURCE_IDS.linkedin);
  });

  it("infers Greenhouse from a greenhouse.io URL", () => {
    expect(
      inferSourceIdFromLink("https://boards.greenhouse.io/acme/jobs/123", defaultSources),
    ).toBe(DEFAULT_SOURCE_IDS.greenhouse);
  });

  it("infers Lever from a lever.co URL", () => {
    expect(inferSourceIdFromLink("https://jobs.lever.co/acme/abc-123", defaultSources)).toBe(
      DEFAULT_SOURCE_IDS.lever,
    );
  });

  it("infers Indeed from an indeed.com URL", () => {
    expect(
      inferSourceIdFromLink("https://www.indeed.com/viewjob?jk=abc123", defaultSources),
    ).toBe(DEFAULT_SOURCE_IDS.indeed);
  });

  it("infers Workday from a myworkdayjobs.com URL", () => {
    expect(
      inferSourceIdFromLink("https://acme.myworkdayjobs.com/careers/job/123", defaultSources),
    ).toBe(DEFAULT_SOURCE_IDS.workday);
  });

  it("infers Workday from a workdayjobs.com URL", () => {
    expect(
      inferSourceIdFromLink("https://wd3.workdayjobs.com/acme/job/123", defaultSources),
    ).toBe(DEFAULT_SOURCE_IDS.workday);
  });

  it("returns undefined for an unrecognised company domain", () => {
    expect(inferSourceIdFromLink("https://acme.com/careers/software-engineer", defaultSources)).toBeUndefined();
  });

  it("returns undefined for undefined link", () => {
    expect(inferSourceIdFromLink(undefined, defaultSources)).toBeUndefined();
  });

  it("returns undefined for an empty string", () => {
    expect(inferSourceIdFromLink("", defaultSources)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// isReferralSource
// ---------------------------------------------------------------------------

describe("isReferralSource", () => {
  it("returns true for the default referral source ID", () => {
    expect(isReferralSource(DEFAULT_SOURCE_IDS.referral, defaultSources)).toBe(true);
  });

  it("returns false for a non-referral default source", () => {
    expect(isReferralSource(DEFAULT_SOURCE_IDS.linkedin, defaultSources)).toBe(false);
  });

  it("returns false for undefined sourceId", () => {
    expect(isReferralSource(undefined, defaultSources)).toBe(false);
  });

  it("returns true for a custom source whose name is 'referral'", () => {
    const now = new Date().toISOString();
    const customSources = [
      ...defaultSources,
      {
        id: "source_custom",
        name: "referral",
        icon: "user-plus",
        isDefault: false,
        createdAt: now,
        updatedAt: now,
      },
    ];
    expect(isReferralSource("source_custom", customSources)).toBe(true);
  });
});
