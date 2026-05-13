import { z } from "zod";

import { getDatabase, initializeDatabase } from "@/lib/db";
import {
  activitySchema,
  columnSchema,
  companySchema,
  contactSchema,
  jobContactSchema,
  jobSchema,
  sourceSchema,
  type Activity,
  type Column,
  type Company,
  type Contact,
  type Job,
  type JobContact,
  type Source,
} from "@/lib/schemas";

export const APPLYLINE_BACKUP_SCHEMA_VERSION = 3;

export const applylineBackupSchema = z.object({
  metadata: z.object({
    appName: z.literal("Applyline"),
    schemaVersion: z.number().int().min(1),
    exportedAt: z.string().datetime(),
  }),
  data: z.object({
    activities: z.array(activitySchema),
    columns: z.array(columnSchema),
    companies: z.array(companySchema),
    contacts: z.array(contactSchema),
    jobContacts: z.array(jobContactSchema),
    jobs: z.array(jobSchema),
    sources: z.array(sourceSchema),
  }),
});

export type ApplylineBackup = z.infer<typeof applylineBackupSchema>;
export type BackupImportMode = "merge" | "replace";

export type BackupPreview = {
  activities: number;
  columns: number;
  companies: number;
  contacts: number;
  jobs: number;
  sources: number;
};

function formatDateForFilename(date: Date) {
  return date.toISOString().slice(0, 10);
}

function downloadTextFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

async function bulkAddMissingById<T extends { id: string }>(
  existingRecords: T[],
  incomingRecords: T[],
  addRecords: (records: T[]) => Promise<unknown>,
) {
  const existingIds = new Set(existingRecords.map((record) => record.id));
  const missingRecords = incomingRecords.filter((record) => !existingIds.has(record.id));

  if (missingRecords.length > 0) {
    await addRecords(missingRecords);
  }
}

export function parseApplylineBackup(input: unknown) {
  return applylineBackupSchema.parse(input);
}

export function createBackupPreview(backup: ApplylineBackup): BackupPreview {
  return {
    activities: backup.data.activities.length,
    columns: backup.data.columns.length,
    companies: backup.data.companies.length,
    contacts: backup.data.contacts.length,
    jobs: backup.data.jobs.length,
    sources: backup.data.sources.length,
  };
}

export async function createApplylineBackup(): Promise<ApplylineBackup> {
  await initializeDatabase();

  const db = getDatabase();
  const [activities, columns, companies, contacts, jobContacts, jobs, sources] =
    await Promise.all([
      db.activities.toArray(),
      db.columns.toArray(),
      db.companies.toArray(),
      db.contacts.toArray(),
      db.jobContacts.toArray(),
      db.jobs.toArray(),
      db.sources.toArray(),
    ]);

  return applylineBackupSchema.parse({
    metadata: {
      appName: "Applyline",
      schemaVersion: APPLYLINE_BACKUP_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
    },
    data: {
      activities,
      columns,
      companies,
      contacts,
      jobContacts,
      jobs,
      sources,
    },
  });
}

export async function downloadApplylineBackup() {
  const backup = await createApplylineBackup();
  const filename = `applyline-backup-${formatDateForFilename(new Date())}.json`;

  downloadTextFile(
    filename,
    `${JSON.stringify(backup, null, 2)}\n`,
    "application/json;charset=utf-8",
  );
}

export async function importApplylineBackup(
  backup: ApplylineBackup,
  mode: BackupImportMode,
) {
  const parsedBackup = applylineBackupSchema.parse(backup);
  const db = getDatabase();

  if (mode === "replace") {
    await db.transaction("rw", db.tables, async () => {
      await Promise.all([
        db.columns.clear(),
        db.jobs.clear(),
        db.companies.clear(),
        db.contacts.clear(),
        db.jobContacts.clear(),
        db.activities.clear(),
        db.sources.clear(),
      ]);
      await Promise.all([
        db.columns.bulkPut(parsedBackup.data.columns),
        db.jobs.bulkPut(parsedBackup.data.jobs),
        db.companies.bulkPut(parsedBackup.data.companies),
        db.contacts.bulkPut(parsedBackup.data.contacts),
        db.jobContacts.bulkPut(parsedBackup.data.jobContacts),
        db.activities.bulkPut(parsedBackup.data.activities),
        db.sources.bulkPut(parsedBackup.data.sources),
      ]);
    });
    return;
  }

  await db.transaction("rw", db.tables, async () => {
      await bulkAddMissingById<Column>(
        await db.columns.toArray(),
        parsedBackup.data.columns,
        (records) => db.columns.bulkAdd(records),
      );
      await bulkAddMissingById<Company>(
        await db.companies.toArray(),
        parsedBackup.data.companies,
        (records) => db.companies.bulkAdd(records),
      );
      await bulkAddMissingById<Source>(
        await db.sources.toArray(),
        parsedBackup.data.sources,
        (records) => db.sources.bulkAdd(records),
      );
      await bulkAddMissingById<Job>(
        await db.jobs.toArray(),
        parsedBackup.data.jobs,
        (records) => db.jobs.bulkAdd(records),
      );
      await bulkAddMissingById<Contact>(
        await db.contacts.toArray(),
        parsedBackup.data.contacts,
        (records) => db.contacts.bulkAdd(records),
      );
      await bulkAddMissingById<JobContact>(
        await db.jobContacts.toArray(),
        parsedBackup.data.jobContacts,
        (records) => db.jobContacts.bulkAdd(records),
      );
      await bulkAddMissingById<Activity>(
        await db.activities.toArray(),
        parsedBackup.data.activities,
        (records) => db.activities.bulkAdd(records),
      );
    });
}

function escapeCsvCell(value: unknown) {
  const stringValue = String(value ?? "");
  return `"${stringValue.replaceAll("\"", "\"\"")}"`;
}

export async function downloadJobsCsv() {
  await initializeDatabase();

  const db = getDatabase();
  const [columns, companies, jobs, sources] = await Promise.all([
    db.columns.toArray(),
    db.companies.toArray(),
    db.jobs.toArray(),
    db.sources.toArray(),
  ]);
  const columnsById = new Map(columns.map((column) => [column.id, column]));
  const companiesById = new Map(companies.map((company) => [company.id, company]));
  const sourcesById = new Map(sources.map((source) => [source.id, source]));
  const rows = [
    ["title", "company", "status", "source", "link", "appliedAt", "updatedAt", "tags"],
    ...jobs.map((job) => [
      job.title,
      companiesById.get(job.companyId)?.name ?? "",
      columnsById.get(job.columnId)?.name ?? "",
      job.sourceId ? sourcesById.get(job.sourceId)?.name ?? "" : "",
      job.link ?? "",
      job.appliedAt ?? "",
      job.updatedAt,
      job.tags.join("; "),
    ]),
  ];
  const csv = `${rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n")}\n`;
  const filename = `applyline-jobs-${formatDateForFilename(new Date())}.csv`;

  downloadTextFile(filename, csv, "text/csv;charset=utf-8");
}
