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
  createSourceSchema,
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
  type CreateSourceInput,
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

function sortJobsForPersistence(a: Job, b: Job) {
  const aPosition = a.position ?? Number.POSITIVE_INFINITY;
  const bPosition = b.position ?? Number.POSITIVE_INFINITY;

  if (aPosition !== bPosition) {
    return aPosition - bPosition;
  }

  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
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

export async function createSource(input: CreateSourceInput) {
  await initializeDatabase();

  const parsedInput = createSourceSchema.parse({
    ...input,
    name: normalizeName(input.name),
  });
  const db = getDatabase();
  const existingSource = await db.sources
    .where("name")
    .equalsIgnoreCase(parsedInput.name)
    .first();

  if (existingSource) {
    return existingSource;
  }

  const timestamp = nowIso();
  const source = sourceSchema.parse({
    ...parsedInput,
    id: createId("source"),
    icon: parsedInput.icon || "circle-help",
    isDefault: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  await db.sources.add(source);
  return source;
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

export async function archiveJob(
  id: string,
  archivedReason?: ArchivedReason,
) {
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

export async function updateContact(id: string, input: Partial<CreateContactInput>) {
  const parsedInput = createContactSchema.partial().parse(input);
  const db = getDatabase();
  const existingContact = await db.contacts.get(id);

  if (!existingContact) {
    throw new Error("Contact was not found.");
  }

  await db.contacts.update(id, {
    ...parsedInput,
    updatedAt: nowIso(),
  });
}

export async function deleteContactPermanently(id: string) {
  const db = getDatabase();
  const linkedJobs = await db.jobContacts.where("contactId").equals(id).toArray();
  const timestamp = nowIso();

  await db.transaction("rw", db.contacts, db.jobContacts, db.activities, async () => {
    await db.contacts.delete(id);
    await db.jobContacts.where("contactId").equals(id).delete();

    if (linkedJobs.length > 0) {
      await db.activities.bulkAdd(
        linkedJobs.map((jobContact) =>
          activitySchema.parse({
            id: createId("activity"),
            jobId: jobContact.jobId,
            type: "contact_removed",
            message: "Removed a contact from this job.",
            createdAt: timestamp,
          }),
        ),
      );
    }
  });
}

export async function unlinkContactFromJob(jobContactId: string) {
  const db = getDatabase();
  const jobContact = await db.jobContacts.get(jobContactId);

  if (!jobContact) {
    return;
  }

  const timestamp = nowIso();

  await db.transaction("rw", db.jobContacts, db.activities, async () => {
    await db.jobContacts.delete(jobContactId);
    await db.activities.add(
      activitySchema.parse({
        id: createId("activity"),
        jobId: jobContact.jobId,
        type: "contact_removed",
        message: "Removed a contact from this job.",
        createdAt: timestamp,
      }),
    );
  });
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
