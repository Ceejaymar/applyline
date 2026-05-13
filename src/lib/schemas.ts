import { z } from "zod";

export const archivedReasonSchema = z.enum([
  "expired",
  "deleted",
  "role_filled",
  "not_interested",
  "other",
]);

export const jobContactRelationshipTypeSchema = z.enum([
  "referral",
  "recruiter",
  "hiring_manager",
  "employee",
  "other",
]);

export const activityTypeSchema = z.enum([
  "created",
  "updated",
  "moved",
  "contact_added",
  "contact_removed",
  "note_added",
  "archived",
  "restored",
]);

export const columnSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  order: z.number(),
  icon: z.string().optional(),
  color: z.string().optional(),
  isDefault: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const jobSchema = z.object({
  id: z.string(),
  title: z.string().min(1, "Role is required"),
  companyId: z.string().min(1, "Company is required"),
  columnId: z.string().min(1, "Column is required"),
  sourceId: z.string().optional(),
  link: z.string().url("Enter a valid URL").optional().or(z.literal("")),
  location: z.string().optional(),
  compensation: z.string().optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
  resumeVersion: z.string().optional(),
  appliedAt: z.string().datetime().optional(),
  rejectedAt: z.string().datetime().optional(),
  lastStatusChangedAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  archivedReason: archivedReasonSchema.optional(),
  tags: z.array(z.string()).default([]),
});

export const companySchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Company is required"),
  website: z.string().url("Enter a valid URL").optional().or(z.literal("")),
  location: z.string().optional(),
  notes: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const contactSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Enter a valid email").optional().or(z.literal("")),
  linkedin: z.string().url("Enter a valid LinkedIn URL").optional().or(z.literal("")),
  role: z.string().optional(),
  companyId: z.string().optional(),
  notes: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const jobContactSchema = z.object({
  id: z.string(),
  jobId: z.string(),
  contactId: z.string(),
  relationshipType: jobContactRelationshipTypeSchema,
  createdAt: z.string().datetime(),
});

export const activitySchema = z.object({
  id: z.string(),
  jobId: z.string(),
  type: activityTypeSchema,
  message: z.string().min(1),
  fromColumnId: z.string().optional(),
  toColumnId: z.string().optional(),
  createdAt: z.string().datetime(),
});

export const sourceSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  icon: z.string().optional(),
  isDefault: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const createCompanySchema = companySchema.pick({
  name: true,
  website: true,
  location: true,
  notes: true,
});

export const createContactSchema = contactSchema.pick({
  name: true,
  email: true,
  linkedin: true,
  role: true,
  companyId: true,
  notes: true,
});

const createJobBaseSchema = jobSchema
  .pick({
    title: true,
    sourceId: true,
    link: true,
    location: true,
    compensation: true,
    description: true,
    notes: true,
    resumeVersion: true,
    appliedAt: true,
    rejectedAt: true,
    archivedReason: true,
    tags: true,
  })
  .extend({
    columnId: z.string().optional(),
    companyId: z.string().optional(),
    companyName: z.string().min(1, "Company is required").optional(),
  });

export const createJobSchema = createJobBaseSchema.refine(
  (input) => input.companyId || input.companyName,
  {
    message: "Company is required",
    path: ["companyName"],
  },
);

export const updateJobSchema = createJobBaseSchema.partial().refine(
  (input) => Object.keys(input).length > 0,
  "At least one field is required",
);

export const linkContactToJobSchema = jobContactSchema.pick({
  jobId: true,
  contactId: true,
  relationshipType: true,
});

export const createActivitySchema = activitySchema.pick({
  jobId: true,
  type: true,
  message: true,
  fromColumnId: true,
  toColumnId: true,
});

export const DEFAULT_COLUMN_IDS = {
  wishlist: "column_wishlist",
  applied: "column_applied",
  interview: "column_interview",
  offer: "column_offer",
  noResponse: "column_no_response",
  rejected: "column_rejected",
  archived: "column_archived",
} as const;

export const DEFAULT_SOURCE_IDS = {
  linkedin: "source_linkedin",
  indeed: "source_indeed",
  wellfound: "source_wellfound",
  greenhouse: "source_greenhouse",
  lever: "source_lever",
  workday: "source_workday",
  companyWebsite: "source_company_website",
  referral: "source_referral",
  recruiter: "source_recruiter",
  other: "source_other",
} as const;

const seededAt = "2026-01-01T00:00:00.000Z";

export const defaultColumns = [
  { id: DEFAULT_COLUMN_IDS.wishlist, name: "Wishlist", order: 1, icon: "bookmark", color: "slate", isDefault: true, createdAt: seededAt, updatedAt: seededAt },
  { id: DEFAULT_COLUMN_IDS.applied, name: "Applied", order: 2, icon: "send", color: "teal", isDefault: true, createdAt: seededAt, updatedAt: seededAt },
  { id: DEFAULT_COLUMN_IDS.interview, name: "Interview", order: 3, icon: "messages", color: "blue", isDefault: true, createdAt: seededAt, updatedAt: seededAt },
  { id: DEFAULT_COLUMN_IDS.offer, name: "Offer", order: 4, icon: "badge-check", color: "green", isDefault: true, createdAt: seededAt, updatedAt: seededAt },
  { id: DEFAULT_COLUMN_IDS.noResponse, name: "No Response", order: 5, icon: "clock", color: "amber", isDefault: true, createdAt: seededAt, updatedAt: seededAt },
  { id: DEFAULT_COLUMN_IDS.rejected, name: "Rejected", order: 6, icon: "circle-x", color: "red", isDefault: true, createdAt: seededAt, updatedAt: seededAt },
  { id: DEFAULT_COLUMN_IDS.archived, name: "Archived / Expired / Deleted", order: 7, icon: "archive", color: "zinc", isDefault: true, createdAt: seededAt, updatedAt: seededAt },
] satisfies Column[];

export const defaultSources = [
  { id: DEFAULT_SOURCE_IDS.linkedin, name: "LinkedIn", icon: "linkedin", isDefault: true, createdAt: seededAt, updatedAt: seededAt },
  { id: DEFAULT_SOURCE_IDS.indeed, name: "Indeed", icon: "search", isDefault: true, createdAt: seededAt, updatedAt: seededAt },
  { id: DEFAULT_SOURCE_IDS.wellfound, name: "Wellfound", icon: "rocket", isDefault: true, createdAt: seededAt, updatedAt: seededAt },
  { id: DEFAULT_SOURCE_IDS.greenhouse, name: "Greenhouse", icon: "sprout", isDefault: true, createdAt: seededAt, updatedAt: seededAt },
  { id: DEFAULT_SOURCE_IDS.lever, name: "Lever", icon: "layers", isDefault: true, createdAt: seededAt, updatedAt: seededAt },
  { id: DEFAULT_SOURCE_IDS.workday, name: "Workday", icon: "briefcase", isDefault: true, createdAt: seededAt, updatedAt: seededAt },
  { id: DEFAULT_SOURCE_IDS.companyWebsite, name: "Company Website", icon: "globe", isDefault: true, createdAt: seededAt, updatedAt: seededAt },
  { id: DEFAULT_SOURCE_IDS.referral, name: "Referral", icon: "user-plus", isDefault: true, createdAt: seededAt, updatedAt: seededAt },
  { id: DEFAULT_SOURCE_IDS.recruiter, name: "Recruiter", icon: "mail", isDefault: true, createdAt: seededAt, updatedAt: seededAt },
  { id: DEFAULT_SOURCE_IDS.other, name: "Other", icon: "circle-help", isDefault: true, createdAt: seededAt, updatedAt: seededAt },
] satisfies Source[];

export type ArchivedReason = z.infer<typeof archivedReasonSchema>;
export type JobContactRelationshipType = z.infer<typeof jobContactRelationshipTypeSchema>;
export type ActivityType = z.infer<typeof activityTypeSchema>;
export type Column = z.infer<typeof columnSchema>;
export type Job = z.infer<typeof jobSchema>;
export type Company = z.infer<typeof companySchema>;
export type Contact = z.infer<typeof contactSchema>;
export type JobContact = z.infer<typeof jobContactSchema>;
export type Activity = z.infer<typeof activitySchema>;
export type Source = z.infer<typeof sourceSchema>;
export type CreateCompanyInput = z.infer<typeof createCompanySchema>;
export type CreateContactInput = z.infer<typeof createContactSchema>;
export type CreateJobInput = z.infer<typeof createJobSchema>;
export type UpdateJobInput = z.infer<typeof updateJobSchema>;
export type LinkContactToJobInput = z.infer<typeof linkContactToJobSchema>;
export type CreateActivityInput = z.infer<typeof createActivitySchema>;
