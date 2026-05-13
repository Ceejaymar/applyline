"use client";

import { ExternalLink, Mail, Pencil, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteContactPermanently } from "@/lib/db";
import type { Company, Contact, JobContact, JobContactRelationshipType } from "@/lib/schemas";
import type { BoardJob } from "@/lib/use-jobs";

type ContactDetailDialogProps = {
  companiesById: Map<string, Company>;
  contact: Contact | null;
  jobContacts: JobContact[];
  jobsById: Map<string, BoardJob>;
  onEdit: (contact: Contact) => void;
  onOpenChange: (open: boolean) => void;
  onOpenJob: (jobId: string) => void;
  open: boolean;
};

const relationshipLabels: Record<JobContactRelationshipType, string> = {
  employee: "Employee",
  hiring_manager: "Hiring manager",
  other: "Other",
  recruiter: "Recruiter",
  referral: "Referral",
};

function DetailItem({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-md border bg-background/55 p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 min-h-5 text-sm">{value || "Not set"}</p>
    </div>
  );
}

export function ContactDetailDialog({
  companiesById,
  contact,
  jobContacts,
  jobsById,
  onEdit,
  onOpenChange,
  onOpenJob,
  open,
}: ContactDetailDialogProps) {
  const linkedJobs = contact
    ? jobContacts
        .filter((jobContact) => jobContact.contactId === contact.id)
        .map((jobContact) => ({
          job: jobsById.get(jobContact.jobId),
          jobContact,
        }))
        .filter((entry): entry is { job: BoardJob; jobContact: JobContact } =>
          Boolean(entry.job),
        )
    : [];
  const companyName = contact?.companyId
    ? companiesById.get(contact.companyId)?.name
    : undefined;

  async function onDelete() {
    if (!contact) {
      return;
    }

    await deleteContactPermanently(contact.id);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[560px]">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4 pr-7">
            <div className="min-w-0">
              <DialogTitle className="truncate">{contact?.name ?? "Contact"}</DialogTitle>
              <DialogDescription className="mt-1">
                {[contact?.role, companyName].filter(Boolean).join(" · ") || "Contact details"}
              </DialogDescription>
            </div>
            {contact ? (
              <div className="flex shrink-0 gap-1">
                {contact.email ? (
                  <Button
                    aria-label={`Email ${contact.name}`}
                    onClick={() => window.open(`mailto:${contact.email}`, "_blank")}
                    size="icon"
                    title="Email"
                    variant="outline"
                  >
                    <Mail />
                  </Button>
                ) : null}
                {contact.linkedin ? (
                  <Button
                    aria-label={`Open ${contact.name} on LinkedIn`}
                    onClick={() => window.open(contact.linkedin, "_blank", "noopener,noreferrer")}
                    size="icon"
                    title="LinkedIn"
                    variant="outline"
                  >
                    <ExternalLink />
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        </DialogHeader>

        {contact ? (
          <div className="grid gap-5">
            <section className="grid gap-3">
              <h3 className="text-sm font-semibold">Basic info</h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <DetailItem label="Role" value={contact.role} />
                <DetailItem label="Company" value={companyName} />
                <DetailItem label="Email" value={contact.email} />
                <DetailItem label="LinkedIn" value={contact.linkedin} />
              </div>
            </section>

            <section className="grid gap-3">
              <h3 className="text-sm font-semibold">Linked jobs</h3>
              {linkedJobs.length > 0 ? (
                <div className="grid gap-2">
                  {linkedJobs.map(({ job, jobContact }) => (
                    <div
                      className="flex items-center justify-between gap-3 rounded-md border bg-background/55 p-3"
                      key={jobContact.id}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{job.title}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {job.companyName} · {job.columnName}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge variant="outline">
                          {relationshipLabels[jobContact.relationshipType]}
                        </Badge>
                        <Button onClick={() => onOpenJob(job.id)} size="sm" variant="outline">
                          Open
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-md border border-dashed bg-background/55 p-3 text-sm text-muted-foreground">
                  This contact is not linked to any jobs yet.
                </p>
              )}
            </section>

            <section className="grid gap-2">
              <h3 className="text-sm font-semibold">Notes</h3>
              <div className="min-h-28 whitespace-pre-wrap rounded-md border bg-background/55 p-3 text-sm leading-6 text-muted-foreground">
                {contact.notes || "No notes yet."}
              </div>
            </section>

            <div className="flex justify-between border-t pt-4">
              <Button onClick={onDelete} variant="destructive">
                <Trash2 />
                Delete
              </Button>
              <Button onClick={() => onEdit(contact)} variant="outline">
                <Pencil />
                Edit
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
