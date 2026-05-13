import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DEFAULT_COLUMN_IDS, defaultColumns, defaultSources } from "./schemas";
import { _resetDatabaseSingletonForTesting, getDatabase, moveJobToColumn } from "./db";

// Dexie only runs upgrade callbacks when migrating from an older version.
// A brand-new fake-indexeddb instance is empty, so we seed the defaults
// explicitly before each test.

beforeEach(async () => {
  const db = getDatabase();
  await db.columns.bulkAdd(defaultColumns);
  await db.sources.bulkAdd(defaultSources);
});

afterEach(async () => {
  await getDatabase().delete();
  _resetDatabaseSingletonForTesting();
});

function makeJob(overrides: Record<string, unknown> = {}) {
  const now = new Date().toISOString();
  return {
    id: "job_test",
    title: "Software Engineer",
    companyId: "company_test",
    columnId: DEFAULT_COLUMN_IDS.wishlist,
    lastStatusChangedAt: now,
    createdAt: now,
    updatedAt: now,
    position: 1000,
    tags: [] as string[],
    ...overrides,
  };
}

describe("moveJobToColumn", () => {
  it("updates columnId to the target column", async () => {
    const db = getDatabase();
    await db.jobs.add(makeJob());

    await moveJobToColumn("job_test", DEFAULT_COLUMN_IDS.applied);

    const updated = await db.jobs.get("job_test");
    expect(updated?.columnId).toBe(DEFAULT_COLUMN_IDS.applied);
  });

  it("updates updatedAt to a timestamp >= the time of the call", async () => {
    const db = getDatabase();
    await db.jobs.add(makeJob({ updatedAt: "2024-01-01T00:00:00.000Z" }));
    const before = Date.now();

    await moveJobToColumn("job_test", DEFAULT_COLUMN_IDS.applied);

    const updated = await db.jobs.get("job_test");
    expect(new Date(updated!.updatedAt).getTime()).toBeGreaterThanOrEqual(before);
  });

  it("updates lastStatusChangedAt to a timestamp >= the time of the call", async () => {
    const db = getDatabase();
    await db.jobs.add(makeJob({ lastStatusChangedAt: "2024-01-01T00:00:00.000Z" }));
    const before = Date.now();

    await moveJobToColumn("job_test", DEFAULT_COLUMN_IDS.applied);

    const updated = await db.jobs.get("job_test");
    expect(new Date(updated!.lastStatusChangedAt).getTime()).toBeGreaterThanOrEqual(before);
  });

  it("sets appliedAt when moved to the Applied column", async () => {
    const db = getDatabase();
    await db.jobs.add(makeJob({ columnId: DEFAULT_COLUMN_IDS.wishlist }));

    await moveJobToColumn("job_test", DEFAULT_COLUMN_IDS.applied);

    const updated = await db.jobs.get("job_test");
    expect(updated?.appliedAt).toBeDefined();
    expect(new Date(updated!.appliedAt!).getTime()).toBeGreaterThan(0);
  });

  it("does not overwrite an existing appliedAt", async () => {
    const existingAppliedAt = "2024-03-01T09:00:00.000Z";
    const db = getDatabase();
    await db.jobs.add(
      makeJob({ columnId: DEFAULT_COLUMN_IDS.wishlist, appliedAt: existingAppliedAt }),
    );

    await moveJobToColumn("job_test", DEFAULT_COLUMN_IDS.applied);

    const updated = await db.jobs.get("job_test");
    expect(updated?.appliedAt).toBe(existingAppliedAt);
  });

  it("sets rejectedAt when moved to the Rejected column", async () => {
    const db = getDatabase();
    await db.jobs.add(makeJob());
    const before = Date.now();

    await moveJobToColumn("job_test", DEFAULT_COLUMN_IDS.rejected);

    const updated = await db.jobs.get("job_test");
    expect(updated?.rejectedAt).toBeDefined();
    expect(new Date(updated!.rejectedAt!).getTime()).toBeGreaterThanOrEqual(before);
  });

  it("does not set rejectedAt when moving to a non-rejected column", async () => {
    const db = getDatabase();
    await db.jobs.add(makeJob());

    await moveJobToColumn("job_test", DEFAULT_COLUMN_IDS.applied);

    const updated = await db.jobs.get("job_test");
    expect(updated?.rejectedAt).toBeUndefined();
  });

  it("creates an activity record of type 'moved'", async () => {
    const db = getDatabase();
    await db.jobs.add(makeJob());

    await moveJobToColumn("job_test", DEFAULT_COLUMN_IDS.applied);

    const activities = await db.activities.where("jobId").equals("job_test").toArray();
    expect(activities.length).toBeGreaterThan(0);
    const moved = activities.find((a) => a.type === "moved");
    expect(moved).toBeDefined();
    expect(moved?.toColumnId).toBe(DEFAULT_COLUMN_IDS.applied);
    expect(moved?.fromColumnId).toBe(DEFAULT_COLUMN_IDS.wishlist);
  });

  it("throws when the job does not exist", async () => {
    await expect(
      moveJobToColumn("nonexistent_job", DEFAULT_COLUMN_IDS.applied),
    ).rejects.toThrow("Job was not found");
  });
});
