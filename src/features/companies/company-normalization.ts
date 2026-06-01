import type { CompanyBrandSuggestion } from "./company-brand.types";

const LEGAL_SUFFIXES =
  /\b(inc|inc\.|llc|ltd|co|corp|corporation|company)\b\.?/gi;

const SOURCE_PRIORITY: Record<CompanyBrandSuggestion["source"], number> = {
  local: 4,
  supabase: 3,
  brandfetch: 2,
  manual: 1,
};

export function normalizeCompanyName(value: string) {
  return value
    .trim()
    .replace(LEGAL_SUFFIXES, "")
    .replace(/[^\p{L}\p{N}\s.-]/gu, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function normalizeDomain(value?: string | null) {
  if (!value) return undefined;

  try {
    const withProtocol = /^https?:\/\//i.test(value)
      ? value
      : `https://${value}`;
    const url = new URL(withProtocol);

    return url.hostname
      .replace(/^www\./i, "")
      .trim()
      .toLowerCase();
  } catch {
    return (
      value
        .replace(/^https?:\/\//i, "")
        .replace(/^www\./i, "")
        .split("/")[0]
        ?.trim()
        .toLowerCase() || undefined
    );
  }
}

export function normalizeWebsiteUrl(value?: string | null) {
  const domain = normalizeDomain(value);
  return domain ? `https://${domain}` : undefined;
}

export function normalizeHexColor(value?: string | null) {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  const hexMatch = trimmed.match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);

  return hexMatch ? `#${hexMatch[1]}` : undefined;
}

export function isValidHexColor(value?: string | null): value is string {
  return Boolean(normalizeHexColor(value));
}

function mergeSuggestion(
  current: CompanyBrandSuggestion,
  next: CompanyBrandSuggestion,
): CompanyBrandSuggestion {
  const preferred =
    SOURCE_PRIORITY[next.source] > SOURCE_PRIORITY[current.source]
      ? next
      : current;
  const fallback = preferred === next ? current : next;

  return {
    ...fallback,
    ...preferred,
    domain: preferred.domain ?? fallback.domain,
    normalizedDomain: preferred.normalizedDomain ?? fallback.normalizedDomain,
    websiteUrl: preferred.websiteUrl ?? fallback.websiteUrl,
    iconUrl: preferred.iconUrl ?? fallback.iconUrl,
    logoUrl: preferred.logoUrl ?? fallback.logoUrl,
    brandColor: preferred.brandColor ?? fallback.brandColor,
    brandfetchBrandId:
      preferred.brandfetchBrandId ?? fallback.brandfetchBrandId,
    enrichmentSource: preferred.enrichmentSource ?? fallback.enrichmentSource,
    enrichmentUpdatedAt:
      preferred.enrichmentUpdatedAt ?? fallback.enrichmentUpdatedAt,
    claimed: preferred.claimed ?? fallback.claimed,
  };
}

export function dedupeCompanySuggestions(items: CompanyBrandSuggestion[]) {
  const byKey = new Map<string, CompanyBrandSuggestion>();

  for (const item of items) {
    const key = item.normalizedDomain
      ? `domain:${item.normalizedDomain}`
      : `name:${item.normalizedName}`;

    const existing = byKey.get(key);
    byKey.set(key, existing ? mergeSuggestion(existing, item) : item);
  }

  return Array.from(byKey.values()).sort((a, b) => {
    const sourceDiff = SOURCE_PRIORITY[b.source] - SOURCE_PRIORITY[a.source];
    if (sourceDiff !== 0) return sourceDiff;

    if (a.claimed !== b.claimed) return a.claimed ? -1 : 1;

    return a.name.localeCompare(b.name);
  });
}
