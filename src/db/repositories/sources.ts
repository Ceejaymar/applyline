import {
  createSourceSchema,
  sourceSchema,
  type CreateSourceInput,
} from "@/lib/schemas";

import { getDatabase } from "../client";
import { createId, normalizeName, nowIso } from "../utils";
import { initializeDatabase } from "../seed";

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

export async function findOrCreateSourceByName(name: string) {
  return createSource({ name, icon: "circle-help" });
}
