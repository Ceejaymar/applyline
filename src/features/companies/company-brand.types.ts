export type CompanyBrandSource = "local" | "supabase" | "brandfetch" | "manual";

export type CompanyBrandSuggestion = {
  companyId?: string;
  name: string;
  normalizedName: string;
  domain?: string;
  normalizedDomain?: string;
  websiteUrl?: string;
  iconUrl?: string;
  logoUrl?: string;
  brandColor?: string;
  brandfetchBrandId?: string;
  enrichmentSource?: string;
  enrichmentUpdatedAt?: string;
  claimed?: boolean;
  source: CompanyBrandSource;
};
