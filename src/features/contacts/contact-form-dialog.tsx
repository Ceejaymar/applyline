"use client";

import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  contactFormSchema,
  emptyContactFormValues,
  toContactInput,
  type ContactFormValues,
} from "@/features/contacts/contact-form-schema";
import { createContact, updateContact } from "@/lib/db";
import type { Company, Contact } from "@/lib/schemas";

type ContactFormDialogProps = {
  companies: Company[];
  contact: Contact | null;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-xs text-destructive">{message}</p> : null;
}

export function ContactFormDialog({
  companies,
  contact,
  onOpenChange,
  open,
}: ContactFormDialogProps) {
  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: emptyContactFormValues,
  });
  const errors = form.formState.errors;
  const isEditing = Boolean(contact);

  useEffect(() => {
    if (!open) {
      return;
    }

    form.reset(
      contact
        ? {
            companyId: contact.companyId ?? "",
            email: contact.email ?? "",
            linkedin: contact.linkedin ?? "",
            name: contact.name,
            notes: contact.notes ?? "",
            role: contact.role ?? "",
          }
        : emptyContactFormValues,
    );
  }, [contact, form, open]);

  async function onSubmit(values: ContactFormValues) {
    if (contact) {
      await updateContact(contact.id, toContactInput(values));
    } else {
      await createContact(toContactInput(values));
    }

    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit contact" : "Create contact"}</DialogTitle>
          <DialogDescription>
            Keep recruiters, referrals, and hiring contacts connected to jobs.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="grid gap-2">
            <Label htmlFor="contact-name">Name</Label>
            <Input id="contact-name" placeholder="Jordan Lee" {...form.register("name")} />
            <FieldError message={errors.name?.message} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="contact-role">Role</Label>
              <Input id="contact-role" placeholder="Recruiter" {...form.register("role")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="contact-company">Company</Label>
              <Select id="contact-company" {...form.register("companyId")}>
                <option value="">No company</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="contact-email">Email</Label>
              <Input id="contact-email" type="email" {...form.register("email")} />
              <FieldError message={errors.email?.message} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="contact-linkedin">LinkedIn</Label>
              <Input
                id="contact-linkedin"
                placeholder="https://linkedin.com/in/..."
                type="url"
                {...form.register("linkedin")}
              />
              <FieldError message={errors.linkedin?.message} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="contact-notes">Notes</Label>
            <Textarea
              className="min-h-28 resize-y leading-6"
              id="contact-notes"
              placeholder="Context, follow-up notes, introductions..."
              {...form.register("notes")}
            />
          </div>
          <div className="flex justify-end border-t pt-4">
            <Button disabled={form.formState.isSubmitting} type="submit">
              <Save />
              {isEditing ? "Save contact" : "Create contact"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
