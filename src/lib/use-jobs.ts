"use client";

import { useEffect, useState } from "react";
import { liveQuery } from "dexie";

import { getDatabase, initializeDatabase } from "@/lib/db";
import type {
  Activity,
  Column,
  Company,
  Contact,
  Job,
  JobContact,
  Source,
} from "@/lib/schemas";

export type BoardJob = Job & {
  columnColor?: string;
  columnIcon?: string;
  columnName: string;
  companyName: string;
  sourceIcon?: string;
  sourceName?: string;
};

type BoardData = {
  activities: Activity[];
  columns: Column[];
  companies: Company[];
  contacts: Contact[];
  jobContacts: JobContact[];
  jobs: BoardJob[];
  sources: Source[];
};

const emptyBoardData: BoardData = {
  activities: [],
  columns: [],
  companies: [],
  contacts: [],
  jobContacts: [],
  jobs: [],
  sources: [],
};

function sortByOrder(a: Column, b: Column) {
  return a.order - b.order;
}

export function useBoardData() {
  const [data, setData] = useState<BoardData>(emptyBoardData);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isCancelled = false;
    let subscription: { unsubscribe: () => void } | undefined;

    async function subscribeToBoardData() {
      await initializeDatabase();

      if (isCancelled) {
        return;
      }

      subscription = liveQuery(async () => {
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
        const companiesById = new Map(companies.map((company) => [company.id, company]));
        const columnsById = new Map(columns.map((column) => [column.id, column]));
        const sourcesById = new Map(sources.map((source) => [source.id, source]));

        return {
          activities,
          columns: columns.toSorted(sortByOrder),
          companies,
          contacts,
          jobContacts,
          jobs: jobs.map((job) => ({
            ...job,
            columnColor: columnsById.get(job.columnId)?.color,
            columnIcon: columnsById.get(job.columnId)?.icon,
            columnName: columnsById.get(job.columnId)?.name ?? "Unknown",
            companyName: companiesById.get(job.companyId)?.name ?? "Unknown company",
            sourceIcon: job.sourceId ? sourcesById.get(job.sourceId)?.icon : undefined,
            sourceName: job.sourceId ? sourcesById.get(job.sourceId)?.name : undefined,
          })),
          sources,
        };
      }).subscribe({
        next: (nextData) => {
          setData(nextData);
          setIsLoading(false);
        },
        error: (nextError) => {
          setError(nextError instanceof Error ? nextError : new Error("Database error"));
          setIsLoading(false);
        },
      });
    }

    subscribeToBoardData().catch((nextError) => {
      setError(nextError instanceof Error ? nextError : new Error("Database error"));
      setIsLoading(false);
    });

    return () => {
      isCancelled = true;
      subscription?.unsubscribe();
    };
  }, []);

  return { ...data, isLoading, error };
}

export function useJobs() {
  const { jobs, isLoading, error } = useBoardData();

  return { jobs, isLoading, error };
}
