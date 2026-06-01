import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { enrichSelectedCompany } from "@/features/companies/brandfetch-enrich-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { CompanyBrandSuggestion } from "@/features/companies/company-brand.types";

const selectedCompanySchema = z.object({
  name: z.string().trim().min(1).max(180),
  domain: z.string().trim().max(240).optional(),
  websiteUrl: z.string().trim().max(300).optional(),
  iconUrl: z.string().trim().max(1000).optional(),
  logoUrl: z.string().trim().max(1000).optional(),
  brandColor: z.string().trim().max(40).optional(),
  brandfetchBrandId: z.string().trim().max(200).optional(),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = selectedCompanySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid selected company.",
        details: parsed.error.issues,
      },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const enriched = await enrichSelectedCompany(input);

  const payload = {
    brandfetch_brand_id: enriched.brandfetchBrandId ?? null,
    name: enriched.name,
    normalized_name: enriched.normalizedName,
    domain: enriched.domain ?? null,
    normalized_domain: enriched.normalizedDomain ?? null,
    website_url: enriched.websiteUrl ?? null,
    icon_url: enriched.iconUrl ?? null,
    logo_url: enriched.logoUrl ?? null,
    brand_color: enriched.brandColor ?? null,
    source: enriched.enrichmentSource ?? "selected",
    fetched_at: enriched.enrichmentUpdatedAt,
    updated_at: enriched.enrichmentUpdatedAt,
  };

  let existingQuery = supabaseAdmin.from("brand_cache").select("*").limit(1);

  if (enriched.normalizedDomain) {
    existingQuery = existingQuery.eq("normalized_domain", enriched.normalizedDomain);
  } else if (enriched.brandfetchBrandId) {
    existingQuery = existingQuery.eq(
      "brandfetch_brand_id",
      enriched.brandfetchBrandId,
    );
  } else {
    existingQuery = existingQuery.eq("normalized_name", enriched.normalizedName);
  }

  const { data: existingRows, error: existingError } = await existingQuery;

  if (existingError) {
    return NextResponse.json(
      { error: "Could not check cached company." },
      { status: 500 },
    );
  }

  const existing = existingRows?.[0];

  const result = existing
    ? await supabaseAdmin
        .from("brand_cache")
        .update(payload)
        .eq("id", existing.id)
        .select("*")
        .single()
    : await supabaseAdmin
        .from("brand_cache")
        .insert({
          ...payload,
          created_at: new Date().toISOString(),
        })
        .select("*")
        .single();

  if (result.error) {
    return NextResponse.json(
      { error: "Could not save selected company." },
      { status: 500 },
    );
  }

  const row = result.data;

  const item: CompanyBrandSuggestion = {
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
  };

  return NextResponse.json({ item });
}
