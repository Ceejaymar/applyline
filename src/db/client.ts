import Dexie, { type Table } from "dexie";

import {
  DEFAULT_COLUMN_IDS,
  companySchema,
  defaultColumns,
  defaultSources,
  jobSchema,
  type Activity,
  type Column,
  type Company,
  type Contact,
  type Job,
  type JobContact,
  type Source,
} from "@/lib/schemas";

type LegacyJob = {
  id: string;
  title: string;
  company: string;
  status: string;
  location?: string;
  url?: string;
  notes?: string;
  position?: number;
  createdAt: string;
  updatedAt: string;
};

const legacyStatusToColumnId: Record<string, string> = {
  wishlist: DEFAULT_COLUMN_IDS.wishlist,
  applied: DEFAULT_COLUMN_IDS.applied,
  interviewing: DEFAULT_COLUMN_IDS.interview,
  offer: DEFAULT_COLUMN_IDS.offer,
  archived: DEFAULT_COLUMN_IDS.archived,
};

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function createId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function hasLegacyCompany(job: unknown): job is LegacyJob {
  return (
    typeof job === "object" &&
    job !== null &&
    "company" in job &&
    typeof (job as { company?: unknown }).company === "string"
  );
}

function sortJobsForPersistence(a: Job, b: Job) {
  const aPosition = a.position ?? Number.POSITIVE_INFINITY;
  const bPosition = b.position ?? Number.POSITIVE_INFINITY;

  if (aPosition !== bPosition) {
    return aPosition - bPosition;
  }

  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
}

export class ApplylineDatabase extends Dexie {
  activities!: Table<Activity, string>;
  columns!: Table<Column, string>;
  companies!: Table<Company, string>;
  contacts!: Table<Contact, string>;
  jobContacts!: Table<JobContact, string>;
  jobs!: Table<Job, string>;
  sources!: Table<Source, string>;

  constructor() {
    super("applyline");

    this.version(1).stores({
      jobs: "id, status, company, updatedAt, position",
    });

    this.version(2)
      .stores({
        activities: "id, jobId, type, createdAt, fromColumnId, toColumnId",
        columns: "id, order, isDefault, updatedAt",
        companies: "id, name, updatedAt",
        contacts: "id, name, email, companyId, updatedAt",
        jobContacts: "id, jobId, contactId, [jobId+contactId], relationshipType",
        jobs:
          "id, companyId, columnId, sourceId, createdAt, updatedAt, appliedAt, rejectedAt, lastStatusChangedAt, archivedReason, *tags",
        sources: "id, name, isDefault, updatedAt",
      })
      .upgrade(async (transaction) => {
        const jobsTable = transaction.table("jobs");
        const companiesTable = transaction.table("companies");
        const legacyJobs = (await jobsTable.toArray()).filter(hasLegacyCompany);
        const companyIdsByName = new Map<string, string>();

        await transaction.table("columns").bulkPut(defaultColumns);
        await transaction.table("sources").bulkPut(defaultSources);

        for (const legacyJob of legacyJobs) {
          const companyName = normalizeName(legacyJob.company);
          const companyKey = companyName.toLocaleLowerCase();
          let companyId = companyIdsByName.get(companyKey);

          if (!companyId) {
            const existingCompany = await companiesTable
              .where("name")
              .equalsIgnoreCase(companyName)
              .first();
            const resolvedCompanyId = existingCompany?.id ?? createId("company");
            companyId = resolvedCompanyId;
            companyIdsByName.set(companyKey, resolvedCompanyId);

            if (!existingCompany) {
              await companiesTable.add(
                companySchema.parse({
                  id: companyId,
                  name: companyName,
                  createdAt: legacyJob.createdAt,
                  updatedAt: legacyJob.updatedAt,
                }),
              );
            }
          }

          const columnId =
            legacyStatusToColumnId[legacyJob.status] ?? DEFAULT_COLUMN_IDS.wishlist;
          const migratedJob = jobSchema.parse({
            id: legacyJob.id,
            title: legacyJob.title,
            companyId,
            columnId,
            link: legacyJob.url,
            location: legacyJob.location,
            notes: legacyJob.notes,
            lastStatusChangedAt: legacyJob.updatedAt,
            createdAt: legacyJob.createdAt,
            updatedAt: legacyJob.updatedAt,
            tags: [],
          });

          await jobsTable.put(migratedJob);
        }
      });

    this.version(3)
      .stores({
        activities: "id, jobId, type, createdAt, fromColumnId, toColumnId",
        columns: "id, order, isDefault, updatedAt",
        companies: "id, name, updatedAt",
        contacts: "id, name, email, companyId, updatedAt",
        jobContacts: "id, jobId, contactId, [jobId+contactId], relationshipType",
        jobs:
          "id, companyId, columnId, sourceId, createdAt, updatedAt, appliedAt, rejectedAt, lastStatusChangedAt, archivedReason, position, *tags",
        sources: "id, name, isDefault, updatedAt",
      })
      .upgrade(async (transaction) => {
        const jobsTable = transaction.table("jobs");
        const jobs = (await jobsTable.toArray()) as Job[];
        const jobsByColumn = new Map<string, Job[]>();

        for (const job of jobs) {
          const columnJobs = jobsByColumn.get(job.columnId) ?? [];
          columnJobs.push(job);
          jobsByColumn.set(job.columnId, columnJobs);
        }

        for (const columnJobs of jobsByColumn.values()) {
          await Promise.all(
            columnJobs.sort(sortJobsForPersistence).map((job, index) =>
              jobsTable.update(job.id, { position: (index + 1) * 1000 }),
            ),
          );
        }
      });
  }
}

let database: ApplylineDatabase | undefined;

export function getDatabase(): ApplylineDatabase {
  if (typeof window === "undefined") {
    throw new Error("Applyline database is only available in the browser.");
  }

  database ??= new ApplylineDatabase();
  return database;
}

export function _resetDatabaseSingletonForTesting() {
  if (database?.isOpen()) {
    database.close();
  }
  database = undefined;
}
