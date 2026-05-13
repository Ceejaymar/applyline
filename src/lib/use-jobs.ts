"use client";

import { useEffect, useState } from "react";
import { liveQuery } from "dexie";

import { getDatabase } from "@/lib/db";
import type { Job } from "@/lib/job-schema";

export function useJobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const subscription = liveQuery(() =>
      getDatabase().jobs.orderBy("position").toArray(),
    ).subscribe({
      next: (nextJobs) => {
        setJobs(nextJobs);
        setIsLoading(false);
      },
      error: (nextError) => {
        setError(nextError instanceof Error ? nextError : new Error("Database error"));
        setIsLoading(false);
      },
    });

    return () => subscription.unsubscribe();
  }, []);

  return { jobs, isLoading, error };
}
