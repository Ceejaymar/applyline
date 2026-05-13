"use client";

import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Archive,
  CalendarClock,
  Edit3,
  ExternalLink,
  Link2,
  Save,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Badge } from "@/components/ui/badge";
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
import { ArchiveMoveDialog } from "@/features/jobs/archive-move-dialog";
import { DuplicateJobWarning } from "@/features/jobs/duplicate-job-warning";
import { getBoardIcon } from "@/features/jobs/board-icons";
import { JobFormFields } from "@/features/jobs/job-form-fields";
import {
  jobFormSchema,
  toJobFormValues,
  toJobInput,
  type JobFormValues,
} from "@/features/jobs/job-form-schema";
import { findPossibleDuplicateJob } from "@/features/jobs/job-helpers";
import {
  archiveJob,
  createContact,
  deleteJobPermanently,
  linkContactToJob,
  unlinkContactFromJob,
  updateJob,
} from "@/lib/db";
import type {
  Activity,
  ArchivedReason,
  Column,
  Company,
  Contact,
  JobContact,
  JobContactRelationshipType,
  Source,
} from "@/lib/schemas";
import { formatRelativeTimeFull } from "@/lib/dates";
import type { BoardJob } from "@/lib/use-jobs";
import { cn } from "@/lib/utils";
import { useApplylineUiStore } from "@/store/applyline-ui-store";

type JobDrawerProps = {
  activities: Activity[];
  columns: Column[];
  companies: Company[];
  contacts: Contact[];
  job: BoardJob | null;
  jobContacts: JobContact[];
  jobs: BoardJob[];
  sources: Source[];
};

type DetailRowProps = {
  label: string;
  value?: string;
};

const relationshipOptions: Array<{
  label: string;
  value: JobContactRelationshipType;
}> = [
  { label: "Referral", value: "referral" },
  { label: "Recruiter", value: "recruiter" },
  { label: "Hiring manager", value: "hiring_manager" },
  { label: "Employee", value: "employee" },
  { label: "Other", value: "other" },
];

const contactLinkSchema = z
  .object({
    contactId: z.string().optional(),
    name: z.string().trim().optional(),
    email: z.string().trim().optional(),
    role: z.string().trim().optional(),
    relationshipType: z.enum(["referral", "recruiter", "hiring_manager", "employee", "other"]),
  })
  .refine((input) => input.contactId || input.name, {
    message: "Choose a contact or enter a new name.",
    path: ["name"],
  })
  .refine((input) => !input.email || z.string().email().safeParse(input.email).success, {
    message: "Enter a valid email.",
    path: ["email"],
  });

type ContactLinkValues = z.infer<typeof contactLinkSchema>;

function formatFullDate(value?: string) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}


function relationLabel(value: JobContactRelationshipType) {
  return relationshipOptions.find((option) => option.value === value)?.label ?? "Other";
}

function DetailRow({ label, value }: DetailRowProps) {
  return (
    <div className="grid gap-1 rounded-md border bg-background/55 p-3">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="min-h-5 text-sm">{value || "Not set"}</span>
    </div>
  );
}

function PlainTextSection({ title, value }: { title: string; value?: string }) {
  return (
    <section className="grid gap-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div
        className={cn(
          "min-h-24 whitespace-pre-wrap rounded-md border bg-background/55 p-3 text-sm leading-6",
          !value && "text-muted-foreground",
          title === "Description" && "font-mono text-[13px]",
        )}
      >
        {value || "Nothing added yet."}
      </div>
    </section>
  );
}

function ContactLinkForm({
  contacts,
  job,
  linkedContactIds,
}: {
  contacts: Contact[];
  job: BoardJob;
  linkedContactIds: Set<string>;
}) {
  const form = useForm<ContactLinkValues>({
    resolver: zodResolver(contactLinkSchema),
    defaultValues: {
      contactId: "",
      name: "",
      email: "",
      role: "",
      relationshipType: "other",
    },
  });
  const [isCreating, setIsCreating] = useState(false);
  const availableContacts = contacts.filter((contact) => !linkedContactIds.has(contact.id));
  const selectedContactId = form.watch("contactId");

  async function onSubmit(values: ContactLinkValues) {
    let contactId = values.contactId;

    if (!contactId) {
      const contact = await createContact({
        name: values.name ?? "",
        email: values.email ?? "",
        role: values.role ?? "",
        companyId: job.companyId,
      });
      contactId = contact.id;
    }

    await linkContactToJob({
      contactId,
      jobId: job.id,
      relationshipType: values.relationshipType,
    });
    form.reset({
      contactId: "",
      name: "",
      email: "",
      role: "",
      relationshipType: "other",
    });
    setIsCreating(false);
  }

  return (
    <form className="grid gap-3 rounded-md border bg-background/55 p-3" onSubmit={form.handleSubmit(onSubmit)}>
      <div className="grid gap-2">
        <Label htmlFor="contact-existing">Existing contact</Label>
        <Select
          id="contact-existing"
          {...form.register("contactId")}
          onChange={(event) => {
            form.setValue("contactId", event.target.value, {
              shouldDirty: true,
              shouldValidate: true,
            });
            if (event.target.value) {
              setIsCreating(false);
            }
          }}
        >
          <option value="">Choose existing...</option>
          {availableContacts.map((contact) => (
            <option key={contact.id} value={contact.id}>
              {contact.name}
              {contact.role ? ` · ${contact.role}` : ""}
            </option>
          ))}
        </Select>
      </div>
      {!selectedContactId ? (
        <div className="grid gap-2">
          <Button
            className="justify-start"
            onClick={() => setIsCreating((next) => !next)}
            size="sm"
            type="button"
            variant="outline"
          >
            {isCreating ? <X /> : <UserPlus />}
            {isCreating ? "Cancel new contact" : "Create new contact"}
          </Button>
          {isCreating ? (
            <div className="grid gap-2">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="contact-name">Name</Label>
                  <Input id="contact-name" {...form.register("name")} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="contact-role">Role</Label>
                  <Input id="contact-role" placeholder="Recruiter" {...form.register("role")} />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="contact-email">Email</Label>
                <Input id="contact-email" type="email" {...form.register("email")} />
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <Select aria-label="Relationship type" {...form.register("relationshipType")}>
          {relationshipOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <Button disabled={form.formState.isSubmitting} type="submit">
          <Link2 />
          Link
        </Button>
      </div>
      {form.formState.errors.name ? (
        <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
      ) : null}
      {form.formState.errors.email ? (
        <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
      ) : null}
    </form>
  );
}

function ContactsSection({
  contacts,
  job,
  jobContacts,
}: {
  contacts: Contact[];
  job: BoardJob;
  jobContacts: JobContact[];
}) {
  const contactsById = useMemo(
    () => new Map(contacts.map((contact) => [contact.id, contact])),
    [contacts],
  );
  const linkedContacts = jobContacts
    .filter((jobContact) => jobContact.jobId === job.id)
    .map((jobContact) => ({
      jobContact,
      contact: contactsById.get(jobContact.contactId),
    }))
    .filter((entry): entry is { jobContact: JobContact; contact: Contact } =>
      Boolean(entry.contact),
    );
  const linkedContactIds = new Set(linkedContacts.map((entry) => entry.contact.id));

  return (
    <section className="grid gap-3">
      <h3 className="text-sm font-semibold">Contacts</h3>
      {linkedContacts.length > 0 ? (
        <div className="grid gap-2">
          {linkedContacts.map(({ contact, jobContact }) => (
            <div
              className="flex items-center justify-between gap-3 rounded-md border bg-background/55 p-3"
              key={jobContact.id}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{contact.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {relationLabel(jobContact.relationshipType)}
                  {contact.role ? ` · ${contact.role}` : ""}
                  {contact.email ? ` · ${contact.email}` : ""}
                </p>
              </div>
              <Button
                aria-label={`Remove ${contact.name}`}
                onClick={() => unlinkContactFromJob(jobContact.id)}
                size="icon"
                variant="ghost"
              >
                <X />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-md border border-dashed bg-background/55 p-3 text-sm text-muted-foreground">
          No contacts linked yet.
        </p>
      )}
      <ContactLinkForm contacts={contacts} job={job} linkedContactIds={linkedContactIds} />
    </section>
  );
}

function ActivitySection({ activities }: { activities: Activity[] }) {
  const sortedActivities = activities.toSorted(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <section className="grid gap-3">
      <h3 className="text-sm font-semibold">Activity</h3>
      {sortedActivities.length > 0 ? (
        <ol className="grid gap-2">
          {sortedActivities.map((activity) => (
            <li className="rounded-md border bg-background/55 p-3" key={activity.id}>
              <p className="text-sm">{activity.message}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {activity.type.replaceAll("_", " ")} · {formatRelativeTimeFull(activity.createdAt)}
              </p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="rounded-md border border-dashed bg-background/55 p-3 text-sm text-muted-foreground">
          No activity yet.
        </p>
      )}
    </section>
  );
}

function JobReadView({
  activities,
  contacts,
  job,
  jobContacts,
  source,
}: {
  activities: Activity[];
  contacts: Contact[];
  job: BoardJob;
  jobContacts: JobContact[];
  source?: Source;
}) {
  const SourceIcon = getBoardIcon(source?.icon);

  return (
    <div className="grid gap-5">
      <section className="grid gap-3">
        <h3 className="text-sm font-semibold">Main details</h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <DetailRow label="Location" value={job.location} />
          <DetailRow label="Compensation" value={job.compensation} />
          <DetailRow label="Resume" value={job.resumeVersion} />
          <div className="grid gap-1 rounded-md border bg-background/55 p-3">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Source
            </span>
            <span className="flex min-h-5 items-center gap-2 text-sm">
              {source ? <SourceIcon className="size-3.5 text-muted-foreground" /> : null}
              {source?.name ?? "Not set"}
            </span>
          </div>
        </div>
      </section>

      <section className="grid gap-3">
        <h3 className="text-sm font-semibold">Dates</h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <DetailRow label="Created" value={formatFullDate(job.createdAt)} />
          <DetailRow label="Updated" value={formatFullDate(job.updatedAt)} />
          <DetailRow label="Applied" value={formatFullDate(job.appliedAt)} />
          <DetailRow label="Status changed" value={formatFullDate(job.lastStatusChangedAt)} />
        </div>
      </section>

      <section className="grid gap-3">
        <h3 className="text-sm font-semibold">Tags</h3>
        {job.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {job.tags.map((tag) => (
              <Badge key={tag} variant="outline">
                {tag}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="rounded-md border border-dashed bg-background/55 p-3 text-sm text-muted-foreground">
            No tags yet.
          </p>
        )}
      </section>

      <ContactsSection contacts={contacts} job={job} jobContacts={jobContacts} />
      <PlainTextSection title="Description" value={job.description} />
      <PlainTextSection title="Notes" value={job.notes} />
      <ActivitySection activities={activities} />
    </div>
  );
}

export function JobDrawer({
  activities,
  columns,
  companies,
  contacts,
  job,
  jobContacts,
  jobs,
  sources,
}: JobDrawerProps) {
  const closeJob = useApplylineUiStore((state) => state.closeJob);
  const openJob = useApplylineUiStore((state) => state.openJob);
  const [isEditing, setIsEditing] = useState(false);
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false);
  const [duplicateJob, setDuplicateJob] = useState<BoardJob | null>(null);
  const [pendingValues, setPendingValues] = useState<JobFormValues | null>(null);
  const form = useForm<JobFormValues>({
    resolver: zodResolver(jobFormSchema),
  });
  const source = sources.find((nextSource) => nextSource.id === job?.sourceId);
  const jobActivities = activities.filter((activity) => activity.jobId === job?.id);

  useEffect(() => {
    if (!job) {
      setIsEditing(false);
      setDuplicateJob(null);
      setPendingValues(null);
      return;
    }

    form.reset(
      toJobFormValues({
        title: job.title,
        companyId: job.companyId,
        companyName: job.companyName,
        columnId: job.columnId,
        sourceId: job.sourceId ?? "",
        link: job.link ?? "",
        location: job.location ?? "",
        compensation: job.compensation ?? "",
        description: job.description ?? "",
        notes: job.notes ?? "",
        resumeVersion: job.resumeVersion ?? "",
        appliedAt: job.appliedAt,
        tags: job.tags,
      }),
    );
    setDuplicateJob(null);
    setPendingValues(null);
  }, [form, job]);

  async function saveJob(values: JobFormValues) {
    if (!job) {
      return;
    }

    await updateJob(job.id, toJobInput(values));
    setDuplicateJob(null);
    setPendingValues(null);
    setIsEditing(false);
  }

  async function onSubmit(values: JobFormValues) {
    if (!job) {
      return;
    }

    const possibleDuplicateJob = findPossibleDuplicateJob({
      companyName: values.companyName,
      excludeJobId: job.id,
      jobs,
      link: values.link,
      title: values.title,
    });

    if (possibleDuplicateJob) {
      setDuplicateJob(possibleDuplicateJob);
      setPendingValues(values);
      return;
    }

    await saveJob(values);
  }

  async function onDelete() {
    if (!job) {
      return;
    }

    await deleteJobPermanently(job.id);
    closeJob();
  }

  function onArchive() {
    setIsArchiveDialogOpen(true);
  }

  async function confirmArchive(archivedReason?: ArchivedReason) {
    if (!job) {
      return;
    }

    await archiveJob(job.id, archivedReason);
    setIsArchiveDialogOpen(false);
    setIsEditing(false);
  }

  return (
    <>
      <Dialog
        open={Boolean(job)}
        onOpenChange={(open) => {
          if (!open) {
            closeJob();
          }
        }}
      >
        <DialogContent className="w-[620px]">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4 pr-7">
            <div className="min-w-0">
              <DialogTitle className="truncate">{job?.title ?? "Application details"}</DialogTitle>
              <DialogDescription className="mt-1 flex flex-wrap items-center gap-2">
                {job ? (
                  <>
                    <span>{job.companyName}</span>
                    <span className="text-muted-foreground/60">·</span>
                    <Badge variant="secondary">{job.columnName}</Badge>
                  </>
                ) : null}
              </DialogDescription>
            </div>
            {job ? (
              <div className="flex shrink-0 items-center gap-1">
                {job.link ? (
                  <Button
                    aria-label="Open posting"
                    onClick={() => window.open(job.link, "_blank", "noopener,noreferrer")}
                    size="icon"
                    title="Open posting"
                    variant="outline"
                  >
                    <ExternalLink />
                  </Button>
                ) : null}
                <Button
                  aria-label={isEditing ? "Cancel edit" : "Edit job"}
                  onClick={() => setIsEditing((next) => !next)}
                  size="icon"
                  title={isEditing ? "Cancel edit" : "Edit job"}
                  variant="outline"
                >
                  {isEditing ? <X /> : <Edit3 />}
                </Button>
              </div>
            ) : null}
          </div>
        </DialogHeader>

        {job ? (
          isEditing ? (
            <form className="grid gap-5" onSubmit={form.handleSubmit(onSubmit)}>
              {duplicateJob ? (
                <DuplicateJobWarning
                  duplicateJob={duplicateJob}
                  onContinue={() => {
                    void saveJob(pendingValues ?? form.getValues());
                  }}
                  onOpenExisting={() => {
                    setIsEditing(false);
                    openJob(duplicateJob.id);
                  }}
                />
              ) : null}
              <JobFormFields
                columns={columns}
                companies={companies}
                form={form}
                sources={sources}
              />
              <div className="flex items-center justify-between gap-3 border-t pt-4">
                <Button onClick={onDelete} type="button" variant="destructive">
                  <Trash2 />
                  Delete
                </Button>
                <div className="flex gap-2">
                  <Button onClick={onArchive} type="button" variant="outline">
                    <Archive />
                    Archive
                  </Button>
                  <Button disabled={form.formState.isSubmitting} type="submit">
                    <Save />
                    Save changes
                  </Button>
                </div>
              </div>
            </form>
          ) : (
            <div className="grid gap-5">
              <div className="flex flex-wrap gap-2 rounded-md border bg-background/55 p-3 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarClock className="size-3.5" />
                  Updated {formatRelativeTimeFull(job.updatedAt)}
                </span>
                {source ? (
                  <span>
                    {source.name}
                    {source.isDefault ? "" : " · custom"}
                  </span>
                ) : null}
              </div>
              <JobReadView
                activities={jobActivities}
                contacts={contacts}
                job={job}
                jobContacts={jobContacts}
                source={source}
              />
              <div className="flex justify-between border-t pt-4">
                <Button onClick={onDelete} type="button" variant="destructive">
                  <Trash2 />
                  Delete
                </Button>
                <Button onClick={onArchive} type="button" variant="outline">
                  <Archive />
                  Archive
                </Button>
              </div>
            </div>
          )
        ) : null}
        </DialogContent>
      </Dialog>
      <ArchiveMoveDialog
        job={job}
        onCancel={() => setIsArchiveDialogOpen(false)}
        onConfirm={confirmArchive}
        open={isArchiveDialogOpen}
      />
    </>
  );
}
