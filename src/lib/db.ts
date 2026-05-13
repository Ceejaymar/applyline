import Dexie, { type Table } from "dexie";

import {
  DEFAULT_COLUMN_IDS,
  activitySchema,
  columnSchema,
  companySchema,
  contactSchema,
  createActivitySchema,
  createCompanySchema,
  createContactSchema,
  createJobSchema,
  defaultColumns,
  defaultSources,
  jobContactSchema,
  jobSchema,
  linkContactToJobSchema,
  sourceSchema,
  updateJobSchema,
  type Activity,
  type ArchivedReason,
  type Column,
  type Company,
  type Contact,
  type CreateActivityInput,
  type CreateCompanyInput,
  type CreateContactInput,
  type CreateJobInput,
  type Job,
  type JobContact,
  type LinkContactToJobInput,
  type Source,
  type UpdateJobInput,
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

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function hasLegacyCompany(job: unknown): job is LegacyJob {
  return (
    typeof job === "object" &&
    job !== null &&
    "company" in job &&
    typeof (job as { company?: unknown }).company === "string"
  );
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
  }
}

let database: ApplylineDatabase | undefined;
let seedPromise: Promise<void> | undefined;

export function getDatabase() {
  if (typeof window === "undefined") {
    throw new Error("Applyline database is only available in the browser.");
  }

  database ??= new ApplylineDatabase();
  return database;
}

export async function seedDefaultData() {
  const db = getDatabase();

  await db.transaction("rw", db.columns, db.sources, async () => {
    const [existingColumns, existingSources] = await Promise.all([
      db.columns.count(),
      db.sources.count(),
    ]);

    if (existingColumns === 0) {
      await db.columns.bulkAdd(defaultColumns);
    }

    if (existingSources === 0) {
      await db.sources.bulkAdd(defaultSources);
    }
  });
}

export function initializeDatabase() {
  seedPromise ??= seedDefaultData();
  return seedPromise;
}

export async function createCompany(input: CreateCompanyInput) {
  const parsedInput = createCompanySchema.parse({
    ...input,
    name: normalizeName(input.name),
  });
  const timestamp = nowIso();
  const company = companySchema.parse({
    ...parsedInput,
    id: createId("company"),
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  await getDatabase().companies.add(company);
  return company;
}

export async function findOrCreateCompanyByName(name: string) {
  const normalizedName = normalizeName(name);
  const db = getDatabase();
  const existingCompany = await db.companies
    .where("name")
    .equalsIgnoreCase(normalizedName)
    .first();

  if (existingCompany) {
    return existingCompany;
  }

  return createCompany({ name: normalizedName });
}

export async function createActivity(input: CreateActivityInput) {
  const parsedInput = createActivitySchema.parse(input);
  const activity = activitySchema.parse({
    ...parsedInput,
    id: createId("activity"),
    createdAt: nowIso(),
  });

  await getDatabase().activities.add(activity);
  return activity;
}

export async function createJob(input: CreateJobInput) {
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
    createdAt: timestamp,
    updatedAt: timestamp,
    tags: parsedInput.tags ?? [],
  });

  await getDatabase().transaction("rw", getDatabase().jobs, getDatabase().activities, async () => {
    await getDatabase().jobs.add(job);
    await createActivity({
      jobId: job.id,
      type: "created",
      message: `Created ${job.title}.`,
      toColumnId: job.columnId,
    });
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

export async function moveJobToColumn(id: string, columnId: string) {
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
  const updates: Partial<Job> = {
    columnId,
    updatedAt: timestamp,
    lastStatusChangedAt: timestamp,
  };

  if (columnId === DEFAULT_COLUMN_IDS.applied && !job.appliedAt) {
    updates.appliedAt = timestamp;
  }

  if (columnId === DEFAULT_COLUMN_IDS.rejected && !job.rejectedAt) {
    updates.rejectedAt = timestamp;
  }

  await db.transaction("rw", db.jobs, db.activities, async () => {
    await db.jobs.update(id, updates);
    await db.activities.add(
      activitySchema.parse({
        id: createId("activity"),
        jobId: id,
        type: "moved",
        message: `Moved ${job.title} to ${targetColumn.name}.`,
        fromColumnId: job.columnId,
        toColumnId: columnId,
        createdAt: timestamp,
      }),
    );
  });
}

export async function archiveJob(
  id: string,
  archivedReason: ArchivedReason = "other",
) {
  const db = getDatabase();
  const job = await db.jobs.get(id);

  if (!job) {
    throw new Error("Job was not found.");
  }

  const timestamp = nowIso();

  await db.transaction("rw", db.jobs, db.activities, async () => {
    await db.jobs.update(id, {
      archivedReason,
      columnId: DEFAULT_COLUMN_IDS.archived,
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

export async function createContact(input: CreateContactInput) {
  const parsedInput = createContactSchema.parse(input);
  const timestamp = nowIso();
  const contact = contactSchema.parse({
    ...parsedInput,
    id: createId("contact"),
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  await getDatabase().contacts.add(contact);
  return contact;
}

export async function linkContactToJob(input: LinkContactToJobInput) {
  const parsedInput = linkContactToJobSchema.parse(input);
  const db = getDatabase();
  const timestamp = nowIso();
  const jobContact = jobContactSchema.parse({
    ...parsedInput,
    id: createId("job_contact"),
    createdAt: timestamp,
  });

  await db.transaction("rw", db.jobContacts, db.activities, async () => {
    const existingLink = await db.jobContacts
      .where("[jobId+contactId]")
      .equals([parsedInput.jobId, parsedInput.contactId])
      .first();

    if (existingLink) {
      return;
    }

    await db.jobContacts.add(jobContact);
    await db.activities.add(
      activitySchema.parse({
        id: createId("activity"),
        jobId: parsedInput.jobId,
        type: "contact_added",
        message: "Linked a contact to this job.",
        createdAt: timestamp,
      }),
    );
  });

  return jobContact;
}
