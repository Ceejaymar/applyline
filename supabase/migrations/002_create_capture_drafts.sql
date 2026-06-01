-- Stores short-lived Chrome extension capture drafts before user review.
-- Drafts are fetched through server-side Next.js API routes by random token.
-- This table is not user-specific yet and should not be queried directly by clients.
-- Row level security is enabled by default; do not add public read policies.

create table if not exists public.capture_drafts (
  id uuid primary key default gen_random_uuid(),
  token text unique not null,
  draft jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  source text not null default 'chrome-extension'
);

create index if not exists capture_drafts_token_idx
  on public.capture_drafts (token);

create index if not exists capture_drafts_expires_at_idx
  on public.capture_drafts (expires_at);

alter table public.capture_drafts enable row level security;
