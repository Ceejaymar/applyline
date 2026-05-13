import { z } from "zod";

export const jobStatuses = [
  "wishlist",
  "applied",
  "interviewing",
  "offer",
  "archived",
] as const;

export const jobStatusLabels: Record<JobStatus, string> = {
  wishlist: "Wishlist",
  applied: "Applied",
  interviewing: "Interviewing",
  offer: "Offer",
  archived: "Archived",
};

export const jobSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1, "Role is required"),
  company: z.string().min(1, "Company is required"),
  status: z.enum(jobStatuses),
  location: z.string().optional(),
  url: z.string().url("Enter a valid URL").optional().or(z.literal("")),
  contactName: z.string().optional(),
  notes: z.string().optional(),
  position: z.number(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const jobFormSchema = jobSchema.pick({
  title: true,
  company: true,
  status: true,
  location: true,
  url: true,
  contactName: true,
  notes: true,
});

export type Job = z.infer<typeof jobSchema>;
export type JobFormInput = z.infer<typeof jobFormSchema>;
export type JobStatus = (typeof jobStatuses)[number];
