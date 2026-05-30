import { normalizeDomain } from "./company-normalization";

export function getBrandfetchLogoUrl(domain?: string | null) {
  const clientId = process.env.NEXT_PUBLIC_BRANDFETCH_CLIENT_ID;
  const normalizedDomain = normalizeDomain(domain);

  if (!clientId || !normalizedDomain) {
    return undefined;
  }

  return `https://cdn.brandfetch.io/${encodeURIComponent(normalizedDomain)}/fallback/lettermark/icon?c=${encodeURIComponent(clientId)}`;
}
