import {
  normalizeHexColor,
  normalizeDomain,
  normalizeWebsiteUrl,
} from "@/features/companies/company-normalization";
import { getBrandfetchLogoUrl } from "@/features/companies/company-logo";
import {
  companyBrandMetadataSchema,
  companySchema,
  createCompanySchema,
  type Company,
  type CompanyBrandMetadata,
  type CreateCompanyInput,
} from "@/lib/schemas";

import { getDatabase } from "../client";
import { createId, normalizeName, nowIso } from "../utils";

function isAbsoluteHttpUrl(value?: string) {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value);
    return (
      Boolean(url.hostname) &&
      (url.protocol === "http:" || url.protocol === "https:")
    );
  } catch {
    return false;
  }
}

function compactMetadata(input?: CompanyBrandMetadata) {
  if (!input) {
    return {};
  }

  const parsedInput = companyBrandMetadataSchema.parse(input);
  const metadata: CompanyBrandMetadata & { website?: string } = {};

  for (const [key, value] of Object.entries(parsedInput)) {
    if (typeof value === "string" && value.trim()) {
      metadata[key as keyof CompanyBrandMetadata] = value.trim();
    }
  }

  const domain = normalizeDomain(metadata.domain ?? metadata.websiteUrl);

  if (domain) {
    metadata.domain = domain;
  }

  const websiteUrl = normalizeWebsiteUrl(metadata.websiteUrl ?? domain);

  if (websiteUrl && isAbsoluteHttpUrl(websiteUrl)) {
    metadata.websiteUrl = websiteUrl;
  } else {
    delete metadata.websiteUrl;
  }

  if (!metadata.logoUrl && domain) {
    metadata.logoUrl = getBrandfetchLogoUrl(domain);
  }

  const brandColor = normalizeHexColor(metadata.brandColor);

  if (brandColor) {
    metadata.brandColor = brandColor;
  } else {
    delete metadata.brandColor;
  }

  if (isAbsoluteHttpUrl(metadata.websiteUrl)) {
    metadata.website = metadata.websiteUrl;
  } else {
    delete metadata.website;
  }

  return metadata;
}

export async function updateCompanyBrandMetadata(
  company: Company,
  metadata?: CompanyBrandMetadata,
) {
  const metadataUpdates = compactMetadata(metadata);

  if (Object.keys(metadataUpdates).length === 0) {
    return company;
  }

  const updatedCompany = companySchema.parse({
    ...company,
    ...metadataUpdates,
    updatedAt: nowIso(),
  });

  await getDatabase().companies.put(updatedCompany);
  return updatedCompany;
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

export async function findOrCreateCompanyByName(
  name: string,
  metadata?: CompanyBrandMetadata,
) {
  const normalizedName = normalizeName(name);
  const db = getDatabase();
  const existingCompany = await db.companies
    .where("name")
    .equalsIgnoreCase(normalizedName)
    .first();

  if (existingCompany) {
    return updateCompanyBrandMetadata(existingCompany, metadata);
  }

  return createCompany({ name: normalizedName, ...compactMetadata(metadata) });
}
