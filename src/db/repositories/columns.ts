import {
  DEFAULT_COLUMN_IDS,
  activitySchema,
  columnSchema,
  type Job,
} from "@/lib/schemas";

import { getDatabase } from "../client";
import { createId, normalizeName, nowIso, sortJobsForPersistence } from "../utils";
import { initializeDatabase } from "../seed";

type ColumnInput = {
  color?: string;
  icon?: string;
  name: string;
};

export async function createColumn(input: string | ColumnInput) {
  await initializeDatabase();

  const columnInput = typeof input === "string" ? { name: input } : input;
  const normalizedName = normalizeName(columnInput.name);

  if (!normalizedName) {
    throw new Error("Column name is required.");
  }

  const db = getDatabase();
  const timestamp = nowIso();
  const columns = await db.columns.toArray();
  const nextOrder =
    columns.length === 0
      ? 1
      : Math.max(...columns.map((column) => column.order)) + 1;
  const column = columnSchema.parse({
    id: createId("column"),
    name: normalizedName,
    order: nextOrder,
    icon: columnInput.icon || "list-plus",
    color: columnInput.color || "violet",
    isDefault: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  await db.columns.add(column);
  return column;
}

export async function updateColumn(id: string, input: Partial<ColumnInput>) {
  const normalizedName = input.name ? normalizeName(input.name) : undefined;

  if (input.name !== undefined && !normalizedName) {
    throw new Error("Column name is required.");
  }

  await getDatabase().columns.update(id, {
    ...(normalizedName ? { name: normalizedName } : {}),
    ...(input.icon ? { icon: input.icon } : {}),
    ...(input.color ? { color: input.color } : {}),
    updatedAt: nowIso(),
  });
}

export async function renameColumn(id: string, name: string) {
  await updateColumn(id, { name });
}

export async function reorderColumn(id: string, direction: "left" | "right") {
  const db = getDatabase();
  const columns = (await db.columns.toArray()).sort((a, b) => a.order - b.order);
  const currentIndex = columns.findIndex((column) => column.id === id);
  const nextIndex = direction === "left" ? currentIndex - 1 : currentIndex + 1;

  if (currentIndex < 0 || nextIndex < 0 || nextIndex >= columns.length) {
    return;
  }

  const currentColumn = columns[currentIndex];
  const nextColumn = columns[nextIndex];
  const timestamp = nowIso();

  await db.transaction("rw", db.columns, async () => {
    await Promise.all([
      db.columns.update(currentColumn.id, {
        order: nextColumn.order,
        updatedAt: timestamp,
      }),
      db.columns.update(nextColumn.id, {
        order: currentColumn.order,
        updatedAt: timestamp,
      }),
    ]);
  });
}

export async function deleteColumn(id: string, migrateToColumnId?: string) {
  const db = getDatabase();
  const [column, jobs] = await Promise.all([
    db.columns.get(id),
    db.jobs.where("columnId").equals(id).toArray(),
  ]);

  if (!column) {
    throw new Error("Column was not found.");
  }

  if (jobs.length > 0 && !migrateToColumnId) {
    throw new Error("Choose another column before deleting this one.");
  }

  if (migrateToColumnId === id) {
    throw new Error("Choose a different migration column.");
  }

  const targetColumn =
    migrateToColumnId ? await db.columns.get(migrateToColumnId) : undefined;

  if (jobs.length > 0 && !targetColumn) {
    throw new Error("Migration column was not found.");
  }

  const timestamp = nowIso();
  const targetJobs =
    migrateToColumnId
      ? (await db.jobs.where("columnId").equals(migrateToColumnId).toArray()).sort(
          sortJobsForPersistence,
        )
      : [];
  const migratedJobs = [...targetJobs, ...jobs.sort(sortJobsForPersistence)];
  const sourceJobIds = new Set(jobs.map((job) => job.id));

  await db.transaction("rw", db.columns, db.jobs, db.activities, async () => {
    if (migrateToColumnId && targetColumn) {
      await Promise.all(
        migratedJobs.map((job, index) => {
          const isSourceJob = sourceJobIds.has(job.id);
          const updates: Partial<Job> = {
            columnId: migrateToColumnId,
            lastStatusChangedAt: isSourceJob ? timestamp : job.lastStatusChangedAt,
            position: (index + 1) * 1000,
            updatedAt: timestamp,
          };

          if (isSourceJob && migrateToColumnId === DEFAULT_COLUMN_IDS.applied && !job.appliedAt) {
            updates.appliedAt = timestamp;
          }

          if (
            isSourceJob &&
            migrateToColumnId === DEFAULT_COLUMN_IDS.rejected &&
            !job.rejectedAt
          ) {
            updates.rejectedAt = timestamp;
          }

          if (isSourceJob && migrateToColumnId === DEFAULT_COLUMN_IDS.archived) {
            updates.archivedReason = job.archivedReason ?? "other";
          }

          return db.jobs.update(job.id, updates);
        }),
      );

      await db.activities.bulkAdd(
        jobs.map((job) =>
          activitySchema.parse({
            id: createId("activity"),
            jobId: job.id,
            type: "moved",
            message: `Moved ${job.title} to ${targetColumn.name}.`,
            fromColumnId: id,
            toColumnId: migrateToColumnId,
            createdAt: timestamp,
          }),
        ),
      );
    }

    await db.columns.delete(id);
  });
}
