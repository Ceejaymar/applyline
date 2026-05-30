import type { CompanyBrandSuggestion } from "./company-brand.types";
import {
  normalizeCompanyName,
  normalizeDomain,
  normalizeWebsiteUrl,
} from "./company-normalization";

type BrandfetchSearchResult = {
  icon?: string | null;
  name?: string | null;
  domain?: string | null;
  claimed?: boolean;
  brandId?: string | null;
};

export async function searchBrandfetchBrands(
  query: string,
): Promise<CompanyBrandSuggestion[]> {
  const clientId = process.env.NEXT_PUBLIC_BRANDFETCH_CLIENT_ID;
  const cleanQuery = query.trim();

  if (!clientId || cleanQuery.length < 2) {
    return [];
  }

  const response = await fetch(
    `https://api.brandfetch.io/v2/search/${encodeURIComponent(cleanQuery)}?c=${encodeURIComponent(clientId)}`,
  );

  if (!response.ok) {
    return [];
  }

  const results = (await response.json()) as BrandfetchSearchResult[];

  return results
    .filter((item) => item.name || item.domain)
    .map((item) => {
      const domain = normalizeDomain(item.domain);
      const name = item.name?.trim() || domain || "Unknown company";

      return {
        name,
        normalizedName: normalizeCompanyName(name),
        domain,
        normalizedDomain: domain,
        websiteUrl: normalizeWebsiteUrl(domain),
        iconUrl: item.icon ?? undefined,
        brandfetchBrandId: item.brandId ?? undefined,
        claimed: item.claimed,
        source: "brandfetch",
      };
    });
}
