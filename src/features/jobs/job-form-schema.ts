import { z } from "zod";

import type { CreateJobInput, UpdateJobInput } from "@/lib/schemas";
import { roleTypeSchema } from "@/lib/schemas";

const optionalUrlSchema = z
  .string()
  .trim()
  .refine(
    (value) => !value || URL.canParse(value),
    "Enter a valid URL",
  );

export const jobFormSchema = z.object({
  title: z.string().trim().min(1, "Role is required"),
  companyName: z.string().trim().min(1, "Company is required"),
  companyId: z.string().optional(),
  columnId: z.string().optional(),
  sourceId: z.string().optional(),
  link: optionalUrlSchema,
  location: z.string().trim().optional(),
  roleType: roleTypeSchema.optional().or(z.literal("")),
  compensation: z.string().trim().optional(),
  tagsText: z.string().optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
  resumeVersion: z.string().trim().optional(),
  appliedAt: z.string().optional(),
});

export type JobFormValues = z.infer<typeof jobFormSchema>;

export const emptyJobFormValues: JobFormValues = {
  title: "",
  companyName: "",
  companyId: undefined,
  columnId: undefined,
  sourceId: "",
  link: "",
  location: "",
  roleType: "",
  compensation: "",
  tagsText: "",
  description: "",
  notes: "",
  resumeVersion: "",
  appliedAt: "",
};

function emptyToUndefined(value?: string) {
  const nextValue = value?.trim();
  return nextValue ? nextValue : undefined;
}

export function parseTags(value?: string) {
  return Array.from(
    new Set(
      (value ?? "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  );
}

export function toDatetimeLocal(value?: string) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const timezoneOffsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 16);
}

export function fromDatetimeLocal(value?: string) {
  return value ? new Date(value).toISOString() : undefined;
}

export function toJobFormValues(
  input: Partial<JobFormValues> & { appliedAt?: string; tags?: string[] },
): JobFormValues {
  return {
    ...emptyJobFormValues,
    ...input,
    appliedAt: toDatetimeLocal(input.appliedAt),
    tagsText: input.tags?.join(", ") ?? input.tagsText ?? "",
  };
}

export function toJobInput(values: JobFormValues): CreateJobInput & UpdateJobInput {
  return {
    title: values.title.trim(),
    companyId: emptyToUndefined(values.companyId),
    companyName: values.companyName.trim(),
    columnId: emptyToUndefined(values.columnId),
    sourceId: emptyToUndefined(values.sourceId),
    link: emptyToUndefined(values.link) ?? "",
    location: emptyToUndefined(values.location),
    roleType: emptyToUndefined(values.roleType) as CreateJobInput["roleType"],
    compensation: emptyToUndefined(values.compensation),
    tags: parseTags(values.tagsText),
    description: values.description?.trim() ? values.description : undefined,
    notes: values.notes?.trim() ? values.notes : undefined,
    resumeVersion: emptyToUndefined(values.resumeVersion),
    appliedAt: fromDatetimeLocal(values.appliedAt),
  };
}
