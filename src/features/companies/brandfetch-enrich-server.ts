import type { CompanyBrandSuggestion } from "@/features/companies/company-brand.types";
import {
  normalizeCompanyName,
  normalizeDomain,
  normalizeHexColor,
  normalizeWebsiteUrl,
} from "@/features/companies/company-normalization";

type SelectedCompanyInput = {
  name: string;
  domain?: string;
  websiteUrl?: string;
  iconUrl?: string;
  logoUrl?: string;
  brandColor?: string;
  brandfetchBrandId?: string;
};

type ColorCandidate = {
  color: string;
  score: number;
};

type BrandfetchBrandResult = {
  brand?: unknown;
  brandApiStatus?: number;
  hasApiKey: boolean;
  parseSucceeded: boolean;
  requestSucceeded: boolean;
};

function nonEmpty(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function getServerBrandfetchLogoUrl(domain?: string) {
  if (!domain) {
    return undefined;
  }

  const clientId =
    process.env.BRANDFETCH_CLIENT_ID ?? process.env.NEXT_PUBLIC_BRANDFETCH_CLIENT_ID;
  const query = clientId ? `?c=${encodeURIComponent(clientId)}` : "";

  return `https://cdn.brandfetch.io/${encodeURIComponent(domain)}${query}`;
}

function scoreColorPath(pathText: string) {
  if (pathText.includes("primary") || pathText.includes("brand")) {
    return 4;
  }

  if (pathText.includes("hex")) {
    return 3;
  }

  if (pathText.includes("value") || pathText.includes("color")) {
    return 2;
  }

  return 1;
}

function collectColorCandidates(value: unknown, path: string[] = []): ColorCandidate[] {
  const pathText = path.join(".").toLocaleLowerCase();

  if (typeof value === "string") {
    const color = normalizeHexColor(value);
    return color
      ? [
          {
            color,
            score: scoreColorPath(pathText),
          },
        ]
      : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      collectColorCandidates(item, [...path, String(index)]),
    );
  }

  if (typeof value === "object" && value !== null) {
    return Object.entries(value).flatMap(([key, item]) =>
      collectColorCandidates(item, [...path, key]),
    );
  }

  return [];
}

function extractPrimaryBrandColor(brand: unknown) {
  if (typeof brand !== "object" || brand === null) {
    return undefined;
  }

  const data = brand as { colors?: unknown };
  const likelyCandidates = collectColorCandidates(data.colors, ["colors"]);
  const fallbackCandidates = collectColorCandidates(brand);

  return [...likelyCandidates, ...fallbackCandidates].sort(
    (a, b) => b.score - a.score,
  )[0]?.color;
}

function extractBrandId(brand: unknown) {
  if (typeof brand !== "object" || brand === null) {
    return undefined;
  }

  const data = brand as {
    id?: unknown;
    brandId?: unknown;
    brand_id?: unknown;
  };
  const value = data.brandId ?? data.brand_id ?? data.id;

  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

async function fetchBrandfetchBrand(domain: string): Promise<BrandfetchBrandResult> {
  const apiKey = process.env.BRANDFETCH_API_KEY;

  if (!apiKey) {
    return { hasApiKey: false, parseSucceeded: false, requestSucceeded: false };
  }

  const url = `https://api.brandfetch.io/v2/brands/domain/${encodeURIComponent(domain)}`;
  const response = await fetch(
    url,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    },
  ).catch(() => undefined);

  if (!response?.ok) {
    return {
      brandApiStatus: response?.status,
      hasApiKey: true,
      parseSucceeded: false,
      requestSucceeded: false,
    };
  }

  const brand = await response.json().catch(() => undefined);

  return {
    brand,
    brandApiStatus: response.status,
    hasApiKey: true,
    parseSucceeded: Boolean(brand),
    requestSucceeded: true,
  };
}

function logEnrichmentResult({
  brandApiStatus,
  brandColor,
  companyName,
  domain,
  hasApiKey,
  parseSucceeded,
  requestSucceeded,
}: {
  brandApiStatus?: number;
  brandColor?: string;
  companyName: string;
  domain?: string;
  hasApiKey: boolean;
  parseSucceeded: boolean;
  requestSucceeded: boolean;
}) {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  console.info("[Brandfetch enrichment]", {
    companyName,
    domain,
    hasApiKey,
    brandApiStatus,
    requestSucceeded,
    parseSucceeded,
    colorFound: Boolean(brandColor),
    brandColor,
  });
}

export async function enrichSelectedCompany(
  input: SelectedCompanyInput,
): Promise<CompanyBrandSuggestion> {
  const domain = normalizeDomain(input.domain ?? input.websiteUrl);
  const websiteUrl = normalizeWebsiteUrl(input.websiteUrl ?? domain);
  const brandResult =
    domain ?
      await fetchBrandfetchBrand(domain)
    : {
        hasApiKey: Boolean(process.env.BRANDFETCH_API_KEY),
        parseSucceeded: false,
        requestSucceeded: false,
      };
  const logoUrl = nonEmpty(input.logoUrl) ?? getServerBrandfetchLogoUrl(domain);
  const brandColor =
    extractPrimaryBrandColor(brandResult.brand) ?? normalizeHexColor(input.brandColor);
  const brandfetchBrandId = nonEmpty(input.brandfetchBrandId) ?? extractBrandId(brandResult.brand);
  const enrichmentSource =
    brandResult.brand ? "brandfetch"
    : brandfetchBrandId ? "brandfetch-search"
    : "selected";
  const enrichmentUpdatedAt = new Date().toISOString();

  logEnrichmentResult({
    brandApiStatus: brandResult.brandApiStatus,
    brandColor,
    companyName: input.name,
    domain,
    hasApiKey: brandResult.hasApiKey,
    parseSucceeded: brandResult.parseSucceeded,
    requestSucceeded: brandResult.requestSucceeded,
  });

  return {
    name: input.name,
    normalizedName: normalizeCompanyName(input.name),
    domain,
    normalizedDomain: domain,
    websiteUrl,
    iconUrl: nonEmpty(input.iconUrl) ?? logoUrl,
    logoUrl,
    brandColor,
    brandfetchBrandId,
    enrichmentSource,
    enrichmentUpdatedAt,
    source: "supabase",
  };
}
