import { z } from "zod";

import { roleTypeSchema } from "@/lib/schemas";

export const DESCRIPTION_LIMIT = 50_000;

export const captureDraftSchema = z.object({
  title: z.string().trim().min(1, "Role is required").max(180),
  companyName: z.string().trim().min(1, "Company is required").max(180),
  link: z.string().trim().url("Enter a valid URL").optional().or(z.literal("")),
  url: z.string().trim().url("Enter a valid URL").optional().or(z.literal("")),
  sourceId: z.string().trim().optional(),
  sourceName: z.string().trim().max(80).optional(),
  location: z.string().trim().max(180).optional(),
  roleType: roleTypeSchema.optional(),
  workplaceType: z.enum(["remote", "hybrid", "onsite", "unknown"]).optional(),
  compensation: z.string().trim().max(240).optional(),
  description: z.string().trim().max(DESCRIPTION_LIMIT).optional(),
  notes: z.string().trim().max(DESCRIPTION_LIMIT).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  capturedAt: z.string().datetime().optional(),
  extractedAt: z.string().datetime().optional(),
  extractionConfidence: z.enum(["high", "medium", "low"]).optional(),
  clientEditedAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

export type CaptureDraft = z.infer<typeof captureDraftSchema>;
