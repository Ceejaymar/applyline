"use client";

import { useMemo, useState } from "react";
import {
  BriefcaseBusiness,
  ExternalLink,
  Mail,
  Pencil,
  Plus,
  Search,
  UserRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ContactDetailDialog } from "@/features/contacts/contact-detail-dialog";
import { ContactFormDialog } from "@/features/contacts/contact-form-dialog";
import { JobDrawer } from "@/features/jobs/job-drawer";
import type { Company, Contact, JobContact } from "@/lib/schemas";
import { useBoardData, type BoardJob } from "@/lib/use-jobs";
import { useApplylineUiStore } from "@/store/applyline-ui-store";

type ContactRow = {
  companyName?: string;
  contact: Contact;
  linkedJobCount: number;
};

function buildContactRows({
  companiesById,
  contacts,
  jobContacts,
}: {
  companiesById: Map<string, Company>;
  contacts: Contact[];
  jobContacts: JobContact[];
}) {
  const linkedCountByContactId = new Map<string, number>();

  for (const jobContact of jobContacts) {
    linkedCountByContactId.set(
      jobContact.contactId,
      (linkedCountByContactId.get(jobContact.contactId) ?? 0) + 1,
    );
  }

  return contacts.map((contact) => ({
    companyName: contact.companyId ? companiesById.get(contact.companyId)?.name : undefined,
    contact,
    linkedJobCount: linkedCountByContactId.get(contact.id) ?? 0,
  }));
}

function ContactTable({
  rows,
  onEdit,
  onView,
}: {
  onEdit: (contact: Contact) => void;
  onView: (contact: Contact) => void;
  rows: ContactRow[];
}) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card shadow-[0_18px_42px_-36px_hsl(var(--foreground)/0.55)]">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="border-b bg-secondary/45 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Name</th>
            <th className="px-4 py-3 font-medium">Role</th>
            <th className="px-4 py-3 font-medium">Company</th>
            <th className="px-4 py-3 font-medium">Email</th>
            <th className="px-4 py-3 font-medium">LinkedIn</th>
            <th className="px-4 py-3 text-right font-medium">Jobs</th>
            <th className="w-24 px-4 py-3 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ companyName, contact, linkedJobCount }) => (
            <tr
              className="border-b last:border-b-0 hover:bg-secondary/35"
              key={contact.id}
            >
              <td className="px-4 py-3">
                <button
                  className="font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => onView(contact)}
                  type="button"
                >
                  {contact.name}
                </button>
              </td>
              <td className="px-4 py-3 text-muted-foreground">{contact.role || "Not set"}</td>
              <td className="px-4 py-3 text-muted-foreground">{companyName || "No company"}</td>
              <td className="px-4 py-3">
                {contact.email ? (
                  <a
                    className="inline-flex items-center gap-1.5 text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                    href={`mailto:${contact.email}`}
                  >
                    <Mail className="size-3.5" />
                    {contact.email}
                  </a>
                ) : (
                  <span className="text-muted-foreground">Not set</span>
                )}
              </td>
              <td className="px-4 py-3">
                {contact.linkedin ? (
                  <a
                    className="inline-flex items-center gap-1.5 text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                    href={contact.linkedin}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <ExternalLink className="size-3.5" />
                    Profile
                  </a>
                ) : (
                  <span className="text-muted-foreground">Not set</span>
                )}
              </td>
              <td className="px-4 py-3 text-right font-medium">{linkedJobCount}</td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-1">
                  <Button
                    aria-label={`Edit ${contact.name}`}
                    onClick={() => onEdit(contact)}
                    size="icon"
                    title="Edit contact"
                    variant="ghost"
                  >
                    <Pencil />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyContacts({ onCreate }: { onCreate: () => void }) {
  return (
    <section className="grid min-h-80 place-items-center rounded-lg border border-dashed bg-card/70 p-8 text-center">
      <div className="grid place-items-center gap-3">
        <div className="grid size-11 place-items-center rounded-md bg-secondary">
          <UserRound className="size-5 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-sm font-semibold">No contacts yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Create contacts here or link them from application details.
          </p>
        </div>
        <Button onClick={onCreate}>
          <Plus />
          Create contact
        </Button>
      </div>
    </section>
  );
}

export function ContactsPage() {
  const {
    activities,
    columns,
    companies,
    contacts,
    jobContacts,
    jobs,
    sources,
    isLoading,
    error,
  } = useBoardData();
  const activeJobId = useApplylineUiStore((state) => state.activeJobId);
  const openJob = useApplylineUiStore((state) => state.openJob);
  const [search, setSearch] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [viewingContactId, setViewingContactId] = useState<string | null>(null);
  const companiesById = useMemo(
    () => new Map(companies.map((company) => [company.id, company])),
    [companies],
  );
  const jobsById = useMemo(() => new Map(jobs.map((job) => [job.id, job])), [jobs]);
  const rows = useMemo(
    () => buildContactRows({ companiesById, contacts, jobContacts }),
    [companiesById, contacts, jobContacts],
  );
  const filteredRows = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();

    return rows.filter(({ companyName, contact }) => {
      const matchesCompany = !companyFilter || contact.companyId === companyFilter;
      const matchesSearch =
        !normalizedSearch ||
        [contact.name, contact.role, contact.email, contact.linkedin, companyName]
          .filter(Boolean)
          .some((value) => value!.toLocaleLowerCase().includes(normalizedSearch));

      return matchesCompany && matchesSearch;
    });
  }, [companyFilter, rows, search]);
  const viewingContact =
    contacts.find((contact) => contact.id === viewingContactId) ?? editingContact ?? null;
  const activeJob = jobs.find((job) => job.id === activeJobId) ?? null;

  function openCreateDialog() {
    setEditingContact(null);
    setIsFormOpen(true);
  }

  function openEditDialog(contact: Contact) {
    setEditingContact(contact);
    setIsFormOpen(true);
  }

  function openRelatedJob(jobId: string) {
    setViewingContactId(null);
    openJob(jobId);
  }

  if (error) {
    return (
      <div className="rounded-lg border bg-card p-5 text-sm text-destructive shadow-sm">
        {error.message}
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Contacts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {contacts.length === 1
              ? "1 person in your hiring network"
              : `${contacts.length} people in your hiring network`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Search contacts"
              className="pl-9"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search contacts"
              value={search}
            />
          </div>
          <Select
            aria-label="Filter by company"
            className="w-full sm:w-48"
            onChange={(event) => setCompanyFilter(event.target.value)}
            value={companyFilter}
          >
            <option value="">All companies</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </Select>
          <Button onClick={openCreateDialog}>
            <Plus />
            Contact
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-2 rounded-lg border bg-card p-3">
          {Array.from({ length: 7 }).map((_, index) => (
            <div className="h-12 animate-pulse rounded-md bg-muted" key={index} />
          ))}
        </div>
      ) : contacts.length === 0 ? (
        <EmptyContacts onCreate={openCreateDialog} />
      ) : filteredRows.length === 0 ? (
        <section className="grid min-h-72 place-items-center rounded-lg border border-dashed bg-card/70 p-8 text-center">
          <div>
            <BriefcaseBusiness className="mx-auto size-8 text-muted-foreground" />
            <h2 className="mt-3 text-sm font-semibold">No contacts match those filters</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Try a different search or company filter.
            </p>
          </div>
        </section>
      ) : (
        <ContactTable
          onEdit={openEditDialog}
          onView={(contact) => setViewingContactId(contact.id)}
          rows={filteredRows}
        />
      )}

      <ContactFormDialog
        companies={companies}
        contact={editingContact}
        onOpenChange={(open) => {
          setIsFormOpen(open);
          if (!open) {
            setEditingContact(null);
          }
        }}
        open={isFormOpen}
      />
      <ContactDetailDialog
        companiesById={companiesById}
        contact={viewingContact}
        jobContacts={jobContacts}
        jobsById={jobsById}
        onEdit={(contact) => {
          setViewingContactId(null);
          openEditDialog(contact);
        }}
        onOpenChange={(open) => {
          if (!open) {
            setViewingContactId(null);
          }
        }}
        onOpenJob={openRelatedJob}
        open={Boolean(viewingContactId)}
      />
      <JobDrawer
        activities={activities}
        columns={columns}
        companies={companies}
        contacts={contacts}
        job={activeJob}
        jobContacts={jobContacts}
        jobs={jobs}
        sources={sources}
      />
    </div>
  );
}
