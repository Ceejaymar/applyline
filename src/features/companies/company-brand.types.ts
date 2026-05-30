export type CompanyBrandSource = "local" | "supabase" | "brandfetch" | "manual";

export type CompanyBrandSuggestion = {
  name: string;
  normalizedName: string;
  domain?: string;
  normalizedDomain?: string;
  websiteUrl?: string;
  iconUrl?: string;
  logoUrl?: string;
  brandColor?: string;
  brandfetchBrandId?: string;
  claimed?: boolean;
  source: CompanyBrandSource;
};
