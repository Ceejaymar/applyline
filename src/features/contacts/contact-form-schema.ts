import { z } from "zod";

import type { CreateContactInput } from "@/lib/schemas";

const optionalEmailSchema = z
  .string()
  .trim()
  .refine((value) => !value || z.string().email().safeParse(value).success, {
    message: "Enter a valid email.",
  });

const optionalUrlSchema = z
  .string()
  .trim()
  .refine((value) => !value || URL.canParse(value), {
    message: "Enter a valid URL.",
  });

export const contactFormSchema = z.object({
  companyId: z.string().optional(),
  email: optionalEmailSchema,
  linkedin: optionalUrlSchema,
  name: z.string().trim().min(1, "Name is required"),
  notes: z.string().optional(),
  role: z.string().trim().optional(),
});

export type ContactFormValues = z.infer<typeof contactFormSchema>;

export const emptyContactFormValues: ContactFormValues = {
  companyId: "",
  email: "",
  linkedin: "",
  name: "",
  notes: "",
  role: "",
};

function emptyToUndefined(value?: string) {
  const nextValue = value?.trim();
  return nextValue ? nextValue : undefined;
}

export function toContactInput(values: ContactFormValues): CreateContactInput {
  return {
    companyId: emptyToUndefined(values.companyId),
    email: emptyToUndefined(values.email) ?? "",
    linkedin: emptyToUndefined(values.linkedin) ?? "",
    name: values.name.trim(),
    notes: values.notes?.trim() ? values.notes : undefined,
    role: emptyToUndefined(values.role),
  };
}
