import {
  DEFAULT_COLUMN_IDS,
  activitySchema,
  createJobSchema,
  jobSchema,
  updateJobSchema,
  type ArchivedReason,
  type CreateJobInput,
  type Job,
  type UpdateJobInput,
} from "@/lib/schemas";

import { getDatabase } from "../client";
import { initializeDatabase } from "../seed";
import { createId, nowIso, sortJobsForPersistence } from "../utils";
import { findOrCreateCompanyByName } from "./companies";

type CreateJobOptions = {
  activityMessage?: string;
};

export async function createJob(input: CreateJobInput, options: CreateJobOptions = {}) {
  await initializeDatabase();

  const parsedInput = createJobSchema.parse(input);
  const company =
    parsedInput.companyId ?
      await getDatabase().companies.get(parsedInput.companyId)
    : await findOrCreateCompanyByName(parsedInput.companyName ?? "");

  if (!company) {
    throw new Error("Company was not found.");
  }

  const timestamp = nowIso();
  const columnId = parsedInput.columnId || DEFAULT_COLUMN_IDS.wishlist;
  const existingColumnJobs = await getDatabase()
    .jobs.where("columnId")
    .equals(columnId)
    .toArray();
  const nextPosition =
    parsedInput.position ??
    (existingColumnJobs.length === 0
      ? 1000
      : Math.max(...existingColumnJobs.map((job) => job.position ?? 0)) + 1000);
  const job = jobSchema.parse({
    ...parsedInput,
    id: createId("job"),
    companyId: company.id,
    columnId,
    appliedAt:
      parsedInput.appliedAt ??
      (columnId === DEFAULT_COLUMN_IDS.applied ? timestamp : undefined),
    rejectedAt:
      parsedInput.rejectedAt ??
      (columnId === DEFAULT_COLUMN_IDS.rejected ? timestamp : undefined),
    lastStatusChangedAt: timestamp,
    position: nextPosition,
    createdAt: timestamp,
    updatedAt: timestamp,
    tags: parsedInput.tags ?? [],
  });

  const db = getDatabase();
  await db.transaction("rw", db.jobs, db.activities, async () => {
    await db.jobs.add(job);
    await db.activities.add(
      activitySchema.parse({
        id: createId("activity"),
        jobId: job.id,
        type: "created",
        message: options.activityMessage ?? `Created ${job.title}.`,
        toColumnId: job.columnId,
        createdAt: nowIso(),
      }),
    );
  });

  return job;
}

export async function updateJob(id: string, input: UpdateJobInput) {
  const parsedInput = updateJobSchema.parse(input);
  const db = getDatabase();
  const existingJob = await db.jobs.get(id);

  if (!existingJob) {
    throw new Error("Job was not found.");
  }

  const companyId =
    parsedInput.companyId ??
    (parsedInput.companyName ?
      (await findOrCreateCompanyByName(parsedInput.companyName)).id
    : undefined);

  const nextColumnId = parsedInput.columnId;
  const nextJob = jobSchema.parse({
    ...existingJob,
    ...parsedInput,
    companyId: companyId ?? existingJob.companyId,
    columnId: nextColumnId ?? existingJob.columnId,
    updatedAt: nowIso(),
    tags: parsedInput.tags ?? existingJob.tags,
  });

  if (nextColumnId && nextColumnId !== existingJob.columnId) {
    await moveJobToColumn(id, nextColumnId);
  }

  await db.transaction("rw", db.jobs, db.activities, async () => {
    const latestJob = (await db.jobs.get(id)) ?? nextJob;
    await db.jobs.put({
      ...latestJob,
      ...nextJob,
      columnId: latestJob.columnId,
      lastStatusChangedAt: latestJob.lastStatusChangedAt,
      appliedAt: latestJob.appliedAt,
      rejectedAt: latestJob.rejectedAt,
      archivedReason: latestJob.archivedReason,
      updatedAt: nowIso(),
    });
    await db.activities.add(
      activitySchema.parse({
        id: createId("activity"),
        jobId: id,
        type: "updated",
        message: `Updated ${nextJob.title}.`,
        createdAt: nowIso(),
      }),
    );
  });
}

type MoveJobOptions = {
  archivedReason?: ArchivedReason;
  targetIndex?: number;
};

export async function moveJobToColumn(
  id: string,
  columnId: string,
  options: MoveJobOptions = {},
) {
  const db = getDatabase();
  const [job, targetColumn] = await Promise.all([
    db.jobs.get(id),
    db.columns.get(columnId),
  ]);

  if (!job) {
    throw new Error("Job was not found.");
  }

  if (!targetColumn) {
    throw new Error("Column was not found.");
  }

  const timestamp = nowIso();
  const targetJobs = (await db.jobs.where("columnId").equals(columnId).toArray())
    .filter((targetJob) => targetJob.id !== id)
    .sort(sortJobsForPersistence);
  const targetIndex = Math.max(
    0,
    Math.min(options.targetIndex ?? targetJobs.length, targetJobs.length),
  );
  const orderedTargetJobs = [
    ...targetJobs.slice(0, targetIndex),
    job,
    ...targetJobs.slice(targetIndex),
  ];
  const didChangeColumn = job.columnId !== columnId;
  const updates: Partial<Job> = {
    columnId,
    lastStatusChangedAt: timestamp,
    updatedAt: timestamp,
    position: (targetIndex + 1) * 1000,
  };

  if (columnId === DEFAULT_COLUMN_IDS.applied && !job.appliedAt) {
    updates.appliedAt = timestamp;
  }

  if (columnId === DEFAULT_COLUMN_IDS.rejected && !job.rejectedAt) {
    updates.rejectedAt = timestamp;
  }

  if (columnId === DEFAULT_COLUMN_IDS.archived) {
    updates.archivedReason = options.archivedReason ?? job.archivedReason;
  } else if (job.columnId === DEFAULT_COLUMN_IDS.archived) {
    updates.archivedReason = undefined;
  }

  await db.transaction("rw", db.jobs, db.activities, async () => {
    await Promise.all(
      orderedTargetJobs.map((targetJob, index) =>
        db.jobs.update(targetJob.id, {
          ...(targetJob.id === id ? updates : {}),
          position: (index + 1) * 1000,
        }),
      ),
    );

    await db.activities.add(
      activitySchema.parse({
        id: createId("activity"),
        jobId: id,
        type: "moved",
        message: didChangeColumn
          ? `Moved ${job.title} to ${targetColumn.name}.`
          : `Reordered ${job.title} in ${targetColumn.name}.`,
        fromColumnId: job.columnId,
        toColumnId: columnId,
        createdAt: timestamp,
      }),
    );
  });
}

export async function archiveJob(id: string, archivedReason?: ArchivedReason) {
  const db = getDatabase();
  const job = await db.jobs.get(id);

  if (!job) {
    throw new Error("Job was not found.");
  }

  const timestamp = nowIso();
  const archivedJobs = await db.jobs
    .where("columnId")
    .equals(DEFAULT_COLUMN_IDS.archived)
    .toArray();
  const nextPosition =
    archivedJobs.length === 0
      ? 1000
      : Math.max(...archivedJobs.map((archivedJob) => archivedJob.position ?? 0)) + 1000;

  await db.transaction("rw", db.jobs, db.activities, async () => {
    await db.jobs.update(id, {
      ...(archivedReason ? { archivedReason } : {}),
      columnId: DEFAULT_COLUMN_IDS.archived,
      position: nextPosition,
      updatedAt: timestamp,
      lastStatusChangedAt: timestamp,
    });
    await db.activities.add(
      activitySchema.parse({
        id: createId("activity"),
        jobId: id,
        type: "archived",
        message: `Archived ${job.title}.`,
        fromColumnId: job.columnId,
        toColumnId: DEFAULT_COLUMN_IDS.archived,
        createdAt: timestamp,
      }),
    );
  });
}

export async function deleteJobPermanently(id: string) {
  const db = getDatabase();

  await db.transaction("rw", db.jobs, db.jobContacts, db.activities, async () => {
    await db.jobs.delete(id);
    await db.jobContacts.where("jobId").equals(id).delete();
    await db.activities.where("jobId").equals(id).delete();
  });
}

export const deleteJob = deleteJobPermanently;
