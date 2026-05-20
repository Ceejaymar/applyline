export type ApplylineTarget = "local" | "production";

export type ApplylineJobDraft = {
  title: string;
  companyName: string;
  link: string;
  sourceId?: string;
  sourceName?: string;
  extractionConfidence?: "high" | "medium" | "low";
  location?: string;
  roleType?: "remote" | "hybrid" | "in_person";
  compensation?: string;
  description?: string;
  notes?: string;
  tags?: string[];
  capturedAt: string;
};

export type SaveDraftMessage = {
  type: "APPLYLINE_SAVE_DRAFT";
  draft: ApplylineJobDraft;
  target: ApplylineTarget;
};

export type OverlayTargetMessage = {
  type: "APPLYLINE_SHOW_OVERLAY";
};

export const APPLYLINE_ORIGINS: Record<ApplylineTarget, string> = {
  local: "http://localhost:3000",
  production: "https://applyline.vercel.app",
};

export function cleanText(value?: string | null) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

export function truncateText(value: string | undefined, maxLength: number) {
  if (!value || value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1).trim()}…`;
}
