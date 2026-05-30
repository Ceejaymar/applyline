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
};

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";

  if (q.length < 2) {
    return NextResponse.json({ items: [] });
  }

  const normalizedName = normalizeCompanyName(q);
  const normalizedDomain = normalizeDomain(q);

  const filters = [
    `normalized_name.ilike.%${normalizedName}%`,
    `name.ilike.%${q}%`,
  ];

  if (normalizedDomain) {
    filters.push(`normalized_domain.ilike.%${normalizedDomain}%`);
    filters.push(`domain.ilike.%${normalizedDomain}%`);
  }

  const { data, error } = await supabaseAdmin
    .from("brand_cache")
    .select(
      "brandfetch_brand_id,name,normalized_name,domain,normalized_domain,website_url,icon_url,logo_url,brand_color",
    )
    .or(filters.join(","))
    .limit(8);

  if (error) {
    return NextResponse.json(
      { items: [], error: "Could not search cached companies." },
      { status: 500 },
    );
  }

  const items: CompanyBrandSuggestion[] = ((data ?? []) as BrandCacheRow[]).map(
    (row) => ({
      name: row.name,
      normalizedName: row.normalized_name,
      domain: row.domain ?? undefined,
      normalizedDomain: row.normalized_domain ?? undefined,
      websiteUrl: row.website_url ?? undefined,
      iconUrl: row.icon_url ?? undefined,
      logoUrl: row.logo_url ?? undefined,
      brandColor: row.brand_color ?? undefined,
      brandfetchBrandId: row.brandfetch_brand_id ?? undefined,
      source: "supabase",
    }),
  );

  return NextResponse.json({ items });
}
