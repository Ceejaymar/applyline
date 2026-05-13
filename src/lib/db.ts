import Dexie, { type Table } from "dexie";

import type { Job, JobFormInput, JobStatus } from "@/lib/job-schema";

class ApplylineDatabase extends Dexie {
  jobs!: Table<Job, string>;

  constructor() {
    super("applyline");
    this.version(1).stores({
      jobs: "id, status, company, updatedAt, position",
    });
  }
}

let database: ApplylineDatabase | undefined;

export function getDatabase() {
  if (typeof window === "undefined") {
    throw new Error("Applyline database is only available in the browser.");
  }

  database ??= new ApplylineDatabase();
  return database;
}

export async function createJob(input: JobFormInput) {
  const now = new Date().toISOString();
  const job: Job = {
    ...input,
    id: crypto.randomUUID(),
    position: Date.now(),
    createdAt: now,
    updatedAt: now,
  };

  await getDatabase().jobs.add(job);
  return job;
}

export async function updateJob(id: string, input: JobFormInput) {
  await getDatabase().jobs.update(id, {
    ...input,
    updatedAt: new Date().toISOString(),
  });
}

export async function moveJob(id: string, status: JobStatus, position = Date.now()) {
  await getDatabase().jobs.update(id, {
    status,
    position,
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteJob(id: string) {
  await getDatabase().jobs.delete(id);
}
