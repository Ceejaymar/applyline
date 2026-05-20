import { cleanText, truncateText, type ApplylineJobDraft } from "../shared/job-draft";

export type JobDraft = {
  title: string;
  companyName: string;
  url: string;
  sourceName: string;
  location?: string;
  workplaceType?: "remote" | "hybrid" | "onsite" | "unknown";
  compensation?: string;
  description?: string;
  tags: string[];
  extractedAt: string;
  extractionConfidence: "high" | "medium" | "low";
};

type JsonLdValue =
  | string
  | string[]
  | number
  | { [key: string]: unknown; name?: unknown }
  | null
  | undefined;

type JobPostingJsonLd = {
  "@type"?: string | string[];
  title?: JsonLdValue;
  hiringOrganization?: JsonLdValue;
  jobLocation?: JsonLdValue | JsonLdValue[];
  applicantLocationRequirements?: JsonLdValue | JsonLdValue[];
  baseSalary?: unknown;
  employmentType?: JsonLdValue;
  description?: JsonLdValue;
};

const COMPANY_SELECTORS = [
  '[data-testid*="company" i]',
  '[data-automation-id*="company" i]',
  '[class*="company" i]',
  '[class*="employer" i]',
  '[class*="organization" i]',
  ".topcard__org-name-link",
  ".jobsearch-InlineCompanyRating a",
  ".posting-company",
];

const LOCATION_SELECTORS = [
  '[data-testid*="location" i]',
  '[data-automation-id*="location" i]',
  '[class*="location" i]',
  '[class*="job-location" i]',
  ".topcard__flavor--bullet",
  ".posting-categories",
];

const DESCRIPTION_SELECTORS = [
  '[data-testid*="description" i]',
  '[data-automation-id*="description" i]',
  '[class*="job-description" i]',
  '[class*="description" i]',
  "#jobDescriptionText",
  ".show-more-less-html__markup",
  ".posting-page",
];

const US_STATE_ABBREVIATIONS =
  "AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|IA|ID|IL|IN|KS|KY|LA|MA|MD|ME|MI|MN|MO|MS|MT|NC|ND|NE|NH|NJ|NM|NV|NY|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VA|VT|WA|WI|WV|WY|DC";

function getHostname() {
  return window.location.hostname.toLocaleLowerCase().replace(/^www\./, "");
}

function detectSourceName(hostname: string) {
  if (hostname.includes("linkedin.com")) {
    return "LinkedIn";
  }

  if (hostname.includes("greenhouse.io")) {
    return "Greenhouse";
  }

  if (hostname.includes("lever.co")) {
    return "Lever";
  }

  if (hostname.includes("myworkdayjobs.com") || hostname.includes("workdayjobs.com")) {
    return "Workday";
  }

  if (hostname.includes("indeed.com")) {
    return "Indeed";
  }

  if (hostname.includes("wellfound.com")) {
    return "Wellfound";
  }

  return "Current page";
}

function getMetaContent(...selectors: string[]) {
  for (const selector of selectors) {
    const content = document.querySelector<HTMLMetaElement>(selector)?.content;

    if (cleanText(content)) {
      return cleanText(content);
    }
  }

  return "";
}

function getVisibleText(element?: Element | null) {
  if (!element || !(element instanceof HTMLElement)) {
    return "";
  }

  const style = window.getComputedStyle(element);

  if (style.display === "none" || style.visibility === "hidden") {
    return "";
  }

  return cleanText(element.innerText || element.textContent);
}

function getTextFromSelectors(selectors: string[], maxLength = 240) {
  for (const selector of selectors) {
    for (const element of Array.from(document.querySelectorAll(selector))) {
      const text = truncateText(getVisibleText(element), maxLength);

      if (text) {
        return text;
      }
    }
  }

  return "";
}

function normalizeHtmlToText(value: string) {
  const template = document.createElement("template");
  template.innerHTML = value;

  for (const element of Array.from(template.content.querySelectorAll("script, style, noscript, svg"))) {
    element.remove();
  }

  return cleanText(template.content.textContent);
}

function stripHtml(value: string) {
  return /<\/?[a-z][\s\S]*>/i.test(value) ? normalizeHtmlToText(value) : cleanText(value);
}

function flattenJsonLd(value: unknown): unknown[] {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap(flattenJsonLd);
  }

  if (typeof value === "object") {
    const graph = (value as { "@graph"?: unknown })["@graph"];

    if (Array.isArray(graph)) {
      return [value, ...graph.flatMap(flattenJsonLd)];
    }
  }

  return [value];
}

function isJobPosting(value: unknown): value is JobPostingJsonLd {
  if (!value || typeof value !== "object") {
    return false;
  }

  const type = (value as JobPostingJsonLd)["@type"];
  const types = Array.isArray(type) ? type : [type];

  return types.some((item) => typeof item === "string" && item.toLocaleLowerCase().includes("jobposting"));
}

function getJobPostingJsonLd() {
  for (const script of Array.from(document.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]'))) {
    try {
      const parsed = JSON.parse(script.textContent ?? "");
      const jobPosting = flattenJsonLd(parsed).find(isJobPosting);

      if (jobPosting) {
        return jobPosting;
      }
    } catch {
      // Ignore malformed structured data and continue with fallbacks.
    }
  }

  return undefined;
}

function stringifyJsonLdValue(value: JsonLdValue): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return stripHtml(value);
  }

  if (typeof value === "number") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return cleanText(value.map(stringifyJsonLdValue).filter(Boolean).join(", "));
  }

  if (typeof value === "object") {
    if (typeof value.name === "string") {
      return stripHtml(value.name);
    }

    if (typeof value.text === "string") {
      return stripHtml(value.text);
    }
  }

  return "";
}

function getCompanyFromJsonLd(value: JsonLdValue) {
  if (Array.isArray(value)) {
    return stringifyJsonLdValue(value[0]);
  }

  return stringifyJsonLdValue(value);
}

function getLocationFromJsonLd(value: JobPostingJsonLd["jobLocation"] | JobPostingJsonLd["applicantLocationRequirements"]) {
  const locations = Array.isArray(value) ? value : [value];
  const labels = locations
    .map((location) => {
      if (!location) {
        return "";
      }

      if (typeof location === "string") {
        return stripHtml(location);
      }

      if (Array.isArray(location)) {
        return cleanText(location.map(stringifyJsonLdValue).filter(Boolean).join(", "));
      }

      if (typeof location !== "object") {
        return "";
      }

      if (typeof location.name === "string") {
        return stripHtml(location.name);
      }

      const address = location.address && typeof location.address === "object" ? location.address : location;
      const addressParts = [
        "streetAddress",
        "addressLocality",
        "addressRegion",
        "postalCode",
        "addressCountry",
      ]
        .map((key) => {
          const part = (address as Record<string, unknown>)[key];
          return typeof part === "string" ? stripHtml(part) : "";
        })
        .filter(Boolean);

      return cleanText(addressParts.join(", "));
    })
    .filter(Boolean);

  return cleanText(Array.from(new Set(labels)).join(" / "));
}

function formatCurrency(value: number | string | undefined, currency?: string) {
  if (value === undefined || value === "") {
    return "";
  }

  const numericValue = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));

  if (!Number.isFinite(numericValue)) {
    return cleanText(`${currency ?? ""} ${value}`);
  }

  const rounded = Number.isInteger(numericValue) ? numericValue : Number(numericValue.toFixed(2));
  const formatted = rounded.toLocaleString("en-US");

  if (currency === "USD" || currency === "$") {
    return `$${formatted}`;
  }

  return cleanText(`${currency ?? ""} ${formatted}`);
}

function formatSalaryFromJsonLd(value: unknown): string {
  if (!value || typeof value !== "object") {
    return "";
  }

  const salary = value as {
    currency?: string;
    value?: {
      minValue?: number | string;
      maxValue?: number | string;
      value?: number | string;
      unitText?: string;
    } | number | string;
    minValue?: number | string;
    maxValue?: number | string;
    unitText?: string;
  };
  const currency = salary.currency;

  if (typeof salary.value === "number" || typeof salary.value === "string") {
    return formatCurrency(salary.value, currency);
  }

  const min = salary.value?.minValue ?? salary.minValue;
  const max = salary.value?.maxValue ?? salary.maxValue;
  const single = salary.value?.value;
  const unit = (salary.value?.unitText ?? salary.unitText)?.toLocaleLowerCase();

  if (single !== undefined) {
    return cleanText(`${formatCurrency(single, currency)}${unit ? ` / ${unit}` : ""}`);
  }

  const range = [formatCurrency(min, currency), formatCurrency(max, currency)].filter(Boolean).join(" - ");

  return cleanText(`${range}${range && unit ? ` / ${unit}` : ""}`);
}

function getMetaTitle() {
  return getMetaContent('meta[property="og:title"]', 'meta[name="twitter:title"]');
}

function splitTitleAndCompany(title: string) {
  const parts = title
    .split(/\s(?:[-|–—•]|at)\s/i)
    .map(cleanText)
    .filter(Boolean);

  return {
    title: parts[0] ?? title,
    companyName: parts.length > 1 ? parts[parts.length - 1] : "",
  };
}

function getNearbyTextLines(titleElement: HTMLElement | null) {
  const container = titleElement?.closest("section, article, header, main, div") ?? titleElement?.parentElement;
  const text = getVisibleText(container);

  if (!text) {
    return [];
  }

  const title = getVisibleText(titleElement);

  return text
    .split(/\n+/)
    .map(cleanText)
    .filter((line) => line && line !== title)
    .slice(0, 8);
}

function looksLikeLocation(value: string) {
  return (
    /\b(remote|hybrid|onsite|on-site|on site)\b/i.test(value) ||
    new RegExp(`\\b([A-Z][a-zA-Z .'-]+,\\s*(?:${US_STATE_ABBREVIATIONS})\\b)`).test(value) ||
    /\b[A-Z][a-zA-Z .'-]+,\s*[A-Z][a-zA-Z .'-]+\b/.test(value)
  );
}

function getDomHeuristics(titleFromEarlier: string) {
  const titleElement = document.querySelector<HTMLElement>("h1");
  const title = titleFromEarlier || truncateText(getVisibleText(titleElement), 180) || "";
  const nearbyLines = getNearbyTextLines(titleElement);
  const companyFromSelector = getTextFromSelectors(COMPANY_SELECTORS, 180);
  const locationFromSelector = getTextFromSelectors(LOCATION_SELECTORS, 180);
  const nearbyCompany = nearbyLines.find(
    (line) =>
      line.length <= 100 &&
      !looksLikeLocation(line) &&
      !/\b(apply|save|share|posted|full[- ]time|part[- ]time)\b/i.test(line),
  );
  const nearbyLocation = nearbyLines.find(looksLikeLocation);

  return {
    title,
    companyName: companyFromSelector || nearbyCompany || "",
    location: locationFromSelector || nearbyLocation || "",
  };
}

function getDescriptionFromDom() {
  for (const selector of DESCRIPTION_SELECTORS) {
    for (const element of Array.from(document.querySelectorAll(selector))) {
      const text = getVisibleText(element);

      if (text.length >= 80) {
        return truncateText(text, 4000) ?? "";
      }
    }
  }

  return "";
}

function getSalaryFromText(value: string) {
  const compactText = cleanText(value);
  const money = String.raw`\$\s?\d{2,3}(?:,\d{3})*(?:\.\d{1,2})?(?:\s?[kK])?`;
  const hourly = String.raw`\$\s?\d{2,3}(?:\.\d{1,2})?\s?(?:\/|per\s?)\s?(?:hr|hour)`;
  const salaryRegex = new RegExp(
    String.raw`(?:${hourly}|${money})(?:\s?(?:-|–|—|to)\s?(?:${hourly}|${money}))?`,
    "i",
  );
  const match = compactText.match(salaryRegex)?.[0];

  return match ? cleanText(match.replace(/\s+/g, " ")) : "";
}

function getWorkplaceType(value: string): JobDraft["workplaceType"] {
  const text = value.toLocaleLowerCase();

  if (/\bhybrid\b/.test(text)) {
    return "hybrid";
  }

  if (/\bremote\b|\bwork from home\b|\bwfh\b/.test(text)) {
    return "remote";
  }

  if (/\bon[- ]?site\b|\bin[- ]?person\b|\boffice[- ]based\b/.test(text)) {
    return "onsite";
  }

  return "unknown";
}

function getConfidence(input: {
  structuredDataFound: boolean;
  title: string;
  companyName: string;
  description?: string;
  location?: string;
}) {
  if (input.structuredDataFound && input.title && input.companyName) {
    return "high";
  }

  if (input.title && input.companyName && (input.description || input.location)) {
    return "medium";
  }

  return "low";
}

function toApplylineRoleType(workplaceType: JobDraft["workplaceType"]): ApplylineJobDraft["roleType"] | undefined {
  if (workplaceType === "onsite") {
    return "in_person";
  }

  if (workplaceType === "unknown") {
    return undefined;
  }

  return workplaceType;
}

function toApplylineSourceId(sourceName: string): ApplylineJobDraft["sourceId"] {
  const sourceIds: Record<string, NonNullable<ApplylineJobDraft["sourceId"]>> = {
    LinkedIn: "source_linkedin",
    Greenhouse: "source_greenhouse",
    Lever: "source_lever",
    Workday: "source_workday",
    Indeed: "source_indeed",
    Wellfound: "source_wellfound",
    "Current page": "source_company_website",
  };

  return sourceIds[sourceName] ?? "source_other";
}

export function extractJobDraftFromPage(): JobDraft {
  const url = window.location.href;
  const sourceName = detectSourceName(getHostname());
  const jsonLd = getJobPostingJsonLd();
  const metaTitle = getMetaTitle();
  const parsedMetaTitle = splitTitleAndCompany(metaTitle);
  const structuredDescription = stringifyJsonLdValue(jsonLd?.description);
  const metaDescription = getMetaContent(
    'meta[name="description"]',
    'meta[property="og:description"]',
    'meta[name="twitter:description"]',
  );
  const domHeuristics = getDomHeuristics(stringifyJsonLdValue(jsonLd?.title) || parsedMetaTitle.title);
  const title =
    stringifyJsonLdValue(jsonLd?.title) ||
    parsedMetaTitle.title ||
    domHeuristics.title;
  const companyName =
    getCompanyFromJsonLd(jsonLd?.hiringOrganization) ||
    parsedMetaTitle.companyName ||
    domHeuristics.companyName;
  const location =
    getLocationFromJsonLd(jsonLd?.jobLocation) ||
    getLocationFromJsonLd(jsonLd?.applicantLocationRequirements) ||
    domHeuristics.location;
  const description =
    structuredDescription ||
    metaDescription ||
    getDescriptionFromDom();
  const compensation =
    formatSalaryFromJsonLd(jsonLd?.baseSalary) ||
    getSalaryFromText([title, location, description].filter(Boolean).join(" "));
  const workplaceType = getWorkplaceType(
    [
      title,
      location,
      stringifyJsonLdValue(jsonLd?.employmentType),
      description,
    ]
      .filter(Boolean)
      .join(" "),
  );
  const extractionConfidence = getConfidence({
    structuredDataFound: Boolean(jsonLd),
    title,
    companyName,
    description,
    location,
  });

  return {
    title: truncateText(title, 180) ?? "",
    companyName: truncateText(companyName, 180) ?? "",
    url,
    sourceName,
    location: truncateText(location, 180),
    workplaceType,
    compensation: truncateText(compensation, 180),
    description: truncateText(description, 4000),
    tags: [],
    extractedAt: new Date().toISOString(),
    extractionConfidence,
  };
}

export function extractJobDraft(): ApplylineJobDraft {
  const draft = extractJobDraftFromPage();

  return {
    title: draft.title,
    companyName: draft.companyName,
    link: draft.url,
    sourceId: toApplylineSourceId(draft.sourceName),
    sourceName: draft.sourceName,
    extractionConfidence: draft.extractionConfidence,
    location: draft.location,
    roleType: toApplylineRoleType(draft.workplaceType),
    compensation: draft.compensation,
    description: draft.description,
    tags: draft.tags,
    capturedAt: draft.extractedAt,
  };
}
