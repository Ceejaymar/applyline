import { defaultColumns, defaultSources } from "@/lib/schemas";

import { getDatabase } from "./client";

let seedPromise: Promise<void> | undefined;

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
