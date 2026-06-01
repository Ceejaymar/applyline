"use client";

import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type KeyboardEvent,
} from "react";
import { Building2, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { getBrandfetchLogoUrl } from "@/features/companies/company-logo";
import {
  dedupeCompanySuggestions,
  normalizeCompanyName,
  normalizeDomain,
  normalizeHexColor,
  normalizeWebsiteUrl,
} from "@/features/companies/company-normalization";
import { searchBrandfetchBrands } from "@/features/companies/brandfetch-search";
import type {
  CompanyBrandSource,
  CompanyBrandSuggestion,
} from "@/features/companies/company-brand.types";
import { cn } from "@/lib/utils";
import type { Company, CompanyBrandMetadata } from "@/lib/schemas";

type CompanyAutocompleteForm = {
  getValues: (name: "companyName") => string;
  register: (name: "companyName") => {
    name?: string;
    onBlur: (event: FocusEvent<HTMLInputElement>) => unknown;
    onChange: (event: ChangeEvent<HTMLInputElement>) => unknown;
    ref?: (instance: HTMLInputElement | null) => void;
    value?: string;
  };
  setValue: (
    name: "companyName" | "companyId" | "companyMetadata",
    value: string | CompanyBrandMetadata | undefined,
    options?: { shouldDirty?: boolean; shouldValidate?: boolean },
  ) => void;
  watch: (name: "companyName") => string;
};

type CompanyAutocompleteProps = {
  companies: Company[];
  form: CompanyAutocompleteForm;
  inputId: string;
};

type CacheSearchResponse = {
  items?: CompanyBrandSuggestion[];
};

const SOURCE_LABELS: Record<CompanyBrandSource, string> = {
  local: "In this board",
  supabase: "Brand cache",
  brandfetch: "Brandfetch",
  manual: "Use typed name",
};

function getCompanyDomain(company: Company) {
  return normalizeDomain(company.domain ?? company.websiteUrl ?? company.website);
}

function isBrandEnrichedCompany(company: Company) {
  // TODO: Surface unmatched manual companies in a separate review/admin flow.
  return Boolean(
    company.brandfetchBrandId ||
      company.domain ||
      company.iconUrl ||
      company.logoUrl ||
      company.brandColor ||
      company.enrichmentSource === "brandfetch" ||
      company.enrichmentSource === "brandfetch-search" ||
      company.enrichmentSource === "supabase",
  );
}

function toLocalSuggestion(company: Company): CompanyBrandSuggestion {
  const domain = getCompanyDomain(company);
  const websiteUrl =
    company.websiteUrl ?? company.website ?? normalizeWebsiteUrl(domain);

  return {
    companyId: company.id,
    name: company.name,
    normalizedName: normalizeCompanyName(company.name),
    domain,
    normalizedDomain: domain,
    websiteUrl,
    iconUrl: company.iconUrl,
    logoUrl: company.logoUrl,
    brandColor: company.brandColor,
    brandfetchBrandId: company.brandfetchBrandId,
    enrichmentSource: company.enrichmentSource,
    enrichmentUpdatedAt: company.enrichmentUpdatedAt,
    source: "local",
  };
}

function findLocalCompanies(companies: Company[], query: string) {
  const normalizedQuery = normalizeCompanyName(query);
  const normalizedDomain = normalizeDomain(query);

  return companies
    .filter(isBrandEnrichedCompany)
    .filter((company) => {
      const companyName = normalizeCompanyName(company.name);
      const companyDomain = getCompanyDomain(company);

      return (
        companyName.includes(normalizedQuery) ||
        (normalizedDomain ? companyDomain?.includes(normalizedDomain) : false)
      );
    })
    .slice(0, 8)
    .map(toLocalSuggestion);
}

async function searchCachedCompanies(query: string, signal: AbortSignal) {
  const response = await fetch(
    `/api/companies/cache-search?q=${encodeURIComponent(query)}`,
    { signal },
  );

  if (!response.ok) {
    return [];
  }

  const body = (await response.json()) as CacheSearchResponse;
  return body.items ?? [];
}

function toManualSuggestion(query: string): CompanyBrandSuggestion {
  return {
    name: query,
    normalizedName: normalizeCompanyName(query),
    source: "manual",
  };
}

function getExactLocalCompanyId(companies: Company[], suggestion: CompanyBrandSuggestion) {
  const normalizedSuggestionName = normalizeCompanyName(suggestion.name);
  const normalizedSuggestionDomain = normalizeDomain(
    suggestion.domain ?? suggestion.websiteUrl,
  );

  return companies.find((company) => {
    const namesMatch =
      normalizeCompanyName(company.name) === normalizedSuggestionName;
    const domainsMatch =
      normalizedSuggestionDomain &&
      getCompanyDomain(company) === normalizedSuggestionDomain;

    return namesMatch || domainsMatch;
  })?.id;
}

function toIsoStringOrNow(value?: string) {
  if (value) {
    const date = new Date(value);

    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }

  return new Date().toISOString();
}

function normalizeCompanyMetadataForForm(suggestion: CompanyBrandSuggestion) {
  if (suggestion.source === "manual") {
    return undefined;
  }

  return {
    domain: suggestion.domain || undefined,
    websiteUrl: suggestion.websiteUrl || undefined,
    iconUrl: suggestion.iconUrl || undefined,
    logoUrl: suggestion.logoUrl || undefined,
    brandColor: normalizeHexColor(suggestion.brandColor),
    brandfetchBrandId: suggestion.brandfetchBrandId || undefined,
    enrichmentSource: suggestion.enrichmentSource ?? suggestion.source,
    enrichmentUpdatedAt: toIsoStringOrNow(suggestion.enrichmentUpdatedAt),
  };
}

function isOlderThanDays(value: string | undefined, days: number) {
  if (!value) {
    return false;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return Date.now() - date.getTime() > days * 24 * 60 * 60 * 1000;
}

function needsCompanyBrandRefresh(suggestion: CompanyBrandSuggestion) {
  const hasLookupKey = Boolean(suggestion.domain || suggestion.brandfetchBrandId);
  const missingBranding = !suggestion.brandColor || !suggestion.logoUrl;
  const isStale = isOlderThanDays(suggestion.enrichmentUpdatedAt, 30);

  return hasLookupKey && (missingBranding || isStale);
}

async function saveSelectedCompany(suggestion: CompanyBrandSuggestion) {
  if (suggestion.source === "manual") {
    return undefined;
  }

  if (suggestion.source === "local" && !needsCompanyBrandRefresh(suggestion)) {
    return undefined;
  }

  const response = await fetch("/api/companies/select", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: suggestion.name,
      domain: suggestion.domain,
      websiteUrl: suggestion.websiteUrl,
      iconUrl: suggestion.iconUrl,
      logoUrl: suggestion.logoUrl,
      brandColor: suggestion.brandColor,
      brandfetchBrandId: suggestion.brandfetchBrandId,
    }),
  }).catch(() => undefined);

  if (!response?.ok) {
    return undefined;
  }

  const body = (await response.json().catch(() => null)) as
    | { item?: CompanyBrandSuggestion }
    | null;

  return body?.item;
}

function CompanySuggestionMark({ suggestion }: { suggestion: CompanyBrandSuggestion }) {
  const [failed, setFailed] = useState(false);
  const imageUrl =
    failed ? undefined : (
      suggestion.iconUrl ?? suggestion.logoUrl ?? getBrandfetchLogoUrl(suggestion.domain)
    );

  if (imageUrl) {
    return (
      <img
        alt=""
        className="size-8 rounded border bg-background object-contain p-1"
        onError={() => setFailed(true)}
        src={imageUrl}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className="grid size-8 place-items-center rounded border text-xs font-semibold text-foreground"
      style={{ backgroundColor: suggestion.brandColor ?? undefined }}
    >
      {suggestion.name[0]?.toUpperCase() ?? <Building2 className="size-4" />}
    </span>
  );
}

export function CompanyAutocomplete({
  companies,
  form,
  inputId,
}: CompanyAutocompleteProps) {
  const companyName = form.watch("companyName");
  const [suggestions, setSuggestions] = useState<CompanyBrandSuggestion[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const listboxId = `${inputId}-suggestions`;
  const {
    onBlur,
    onChange,
    ...companyNameRegistration
  } = form.register("companyName");
  const visibleSuggestions = useMemo(
    () => suggestions.slice(0, 10),
    [suggestions],
  );
  const isOpen = isFocused && visibleSuggestions.length > 0;

  useEffect(() => {
    const query = companyName.trim();

    if (query.length < 2) {
      setSuggestions([]);
      setIsLoading(false);
      return;
    }

    const abortController = new AbortController();
    const timeoutId = window.setTimeout(() => {
      const localSuggestions = findLocalCompanies(companies, query);
      const manualSuggestion = toManualSuggestion(query);

      setSuggestions(dedupeCompanySuggestions([...localSuggestions, manualSuggestion]));
      setIsLoading(true);

      Promise.all([
        searchCachedCompanies(query, abortController.signal).catch(() => []),
        searchBrandfetchBrands(query).catch(() => []),
      ])
        .then(([cachedSuggestions, brandfetchSuggestions]) => {
          if (abortController.signal.aborted) {
            return;
          }

          setSuggestions(
            dedupeCompanySuggestions([
              ...localSuggestions,
              ...cachedSuggestions,
              ...brandfetchSuggestions,
              manualSuggestion,
            ]),
          );
        })
        .finally(() => {
          if (!abortController.signal.aborted) {
            setIsLoading(false);
          }
        });
    }, 350);

    return () => {
      abortController.abort();
      window.clearTimeout(timeoutId);
    };
  }, [companies, companyName]);

  useEffect(() => {
    setActiveIndex(0);
  }, [visibleSuggestions.length, companyName]);

  async function selectSuggestion(suggestion: CompanyBrandSuggestion) {
    const companyId =
      suggestion.companyId ?? getExactLocalCompanyId(companies, suggestion);

    form.setValue("companyName", suggestion.name, {
      shouldDirty: true,
      shouldValidate: true,
    });
    form.setValue("companyId", companyId ?? "", {
      shouldDirty: true,
      shouldValidate: true,
    });
    form.setValue("companyMetadata", normalizeCompanyMetadataForForm(suggestion), {
      shouldDirty: true,
      shouldValidate: true,
    });
    setIsFocused(false);
    const enrichedSuggestion = await saveSelectedCompany(suggestion);

    if (!enrichedSuggestion || form.getValues("companyName") !== suggestion.name) {
      return;
    }

    form.setValue("companyMetadata", normalizeCompanyMetadataForForm(enrichedSuggestion), {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!isOpen) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % visibleSuggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex(
        (index) =>
          (index - 1 + visibleSuggestions.length) % visibleSuggestions.length,
      );
    } else if (event.key === "Enter") {
      event.preventDefault();
      void selectSuggestion(visibleSuggestions[activeIndex]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setIsFocused(false);
    }
  }

  return (
    <div className="relative">
      <Input
        aria-activedescendant={
          isOpen ? `${listboxId}-${visibleSuggestions[activeIndex]?.source}-${activeIndex}` : undefined
        }
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-expanded={isOpen}
        className="pr-9"
        id={inputId}
        {...companyNameRegistration}
        onBlur={(event) => {
          void onBlur(event);
          window.setTimeout(() => setIsFocused(false), 100);
        }}
        onChange={(event) => {
          void onChange(event);

          const typedName = event.target.value.trim();
          const existingCompanyId = getExactLocalCompanyId(companies, {
            name: typedName,
            normalizedName: normalizeCompanyName(typedName),
            source: "manual",
          });

          form.setValue("companyId", existingCompanyId ?? "", {
            shouldDirty: true,
            shouldValidate: true,
          });
          form.setValue("companyMetadata", undefined, {
            shouldDirty: true,
            shouldValidate: true,
          });
        }}
        onFocus={() => setIsFocused(true)}
        onKeyDown={onKeyDown}
        placeholder="Acme"
        role="combobox"
      />
      {isLoading ? (
        <Loader2 className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
      ) : null}
      {isOpen ? (
        <div
          className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-lg"
          id={listboxId}
          role="listbox"
        >
          {visibleSuggestions.map((suggestion, index) => {
            const optionId = `${listboxId}-${suggestion.source}-${index}`;
            const isActive = index === activeIndex;

            return (
              <button
                aria-selected={isActive}
                className={cn(
                  "flex w-full items-center gap-3 rounded px-2 py-2 text-left text-sm outline-none transition-colors",
                  isActive ? "bg-accent text-accent-foreground" : "hover:bg-accent",
                )}
                id={optionId}
                key={`${suggestion.source}-${suggestion.normalizedDomain ?? suggestion.normalizedName}-${index}`}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => {
                  void selectSuggestion(suggestion);
                }}
                role="option"
                tabIndex={-1}
                type="button"
              >
                <CompanySuggestionMark suggestion={suggestion} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{suggestion.name}</span>
                  {suggestion.domain ? (
                    <span className="block truncate text-xs text-muted-foreground">
                      {suggestion.domain}
                    </span>
                  ) : null}
                </span>
                <Badge
                  className="shrink-0"
                  variant={suggestion.source === "brandfetch" ? "outline" : "secondary"}
                >
                  {SOURCE_LABELS[suggestion.source]}
                </Badge>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
