-- Stores cached public company/brand metadata.
-- Used for Applyline company autocomplete and enrichment.
-- Intended for metadata from official APIs like Brandfetch, not scraped company data.
-- Intentionally not user-specific yet.
-- Row level security is enabled by default.
-- Access should happen through server-side Next.js API routes, not directly from client components.

create table if not exists public.brand_cache (
  id uuid primary key default gen_random_uuid(),

  brandfetch_brand_id text unique,
  name text not null,
  normalized_name text not null,
  domain text,
  normalized_domain text unique,
  website_url text,

  icon_url text,
  logo_url text,
  brand_color text,

  source text not null default 'brandfetch',
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists brand_cache_normalized_name_idx
  on public.brand_cache (normalized_name);

create index if not exists brand_cache_domain_idx
  on public.brand_cache (normalized_domain);

alter table public.brand_cache enable row level security;
