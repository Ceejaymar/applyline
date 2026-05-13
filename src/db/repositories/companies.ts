import {
  companySchema,
  createCompanySchema,
  type CreateCompanyInput,
} from "@/lib/schemas";

import { getDatabase } from "../client";
import { createId, normalizeName, nowIso } from "../utils";

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
