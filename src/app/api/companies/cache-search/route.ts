import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  normalizeCompanyName,
  normalizeDomain,
} from "@/features/companies/company-normalization";
import type { CompanyBrandSuggestion } from "@/features/companies/company-brand.types";

type BrandCacheRow = {
  brandfetch_brand_id: string | null;
  name: string;
  normalized_name: string;
  domain: string | null;
  normalized_domain: string | null;
  website_url: string | null;
  icon_url: string | null;
  logo_url: string | null;
  brand_color: string | null;
  source: string | null;
  fetched_at: string | null;
};

const BRAND_CACHE_SELECT =
  "brandfetch_brand_id,name,normalized_name,domain,normalized_domain,website_url,icon_url,logo_url,brand_color,source,fetched_at";

async function searchBrandCacheColumn(column: string, value?: string) {
  const searchValue = value?.trim();

  if (!searchValue) {
    return { data: [] as BrandCacheRow[], error: null };
  }

  const { data, error } = await supabaseAdmin
    .from("brand_cache")
    .select(BRAND_CACHE_SELECT)
    .ilike(column, `%${searchValue}%`)
    .limit(8);

  return { data: (data ?? []) as BrandCacheRow[], error };
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";

  if (q.length < 2) {
    return NextResponse.json({ items: [] });
  }

  const normalizedName = normalizeCompanyName(q);
  const normalizedDomain = normalizeDomain(q);

  const results = await Promise.all([
    searchBrandCacheColumn("normalized_name", normalizedName),
    searchBrandCacheColumn("name", q),
    searchBrandCacheColumn("normalized_domain", normalizedDomain),
    searchBrandCacheColumn("domain", normalizedDomain),
  ]);
  const error = results.find((result) => result.error)?.error;

  if (error) {
    return NextResponse.json(
      { items: [], error: "Could not search cached companies." },
      { status: 500 },
    );
  }

  const rowsByKey = new Map<string, BrandCacheRow>();

  for (const row of results.flatMap((result) => result.data)) {
    const key = row.normalized_domain
      ? `domain:${row.normalized_domain}`
      : `name:${row.normalized_name}`;

    rowsByKey.set(key, row);
  }

  const items: CompanyBrandSuggestion[] = Array.from(rowsByKey.values())
    .slice(0, 8)
    .map((row) => ({
      name: row.name,
      normalizedName: row.normalized_name,
      domain: row.domain ?? undefined,
      normalizedDomain: row.normalized_domain ?? undefined,
      websiteUrl: row.website_url ?? undefined,
      iconUrl: row.icon_url ?? undefined,
      logoUrl: row.logo_url ?? undefined,
      brandColor: row.brand_color ?? undefined,
      brandfetchBrandId: row.brandfetch_brand_id ?? undefined,
      enrichmentSource: row.source ?? undefined,
      enrichmentUpdatedAt: row.fetched_at ?? undefined,
      source: "supabase",
    }));

  return NextResponse.json({ items });
}
