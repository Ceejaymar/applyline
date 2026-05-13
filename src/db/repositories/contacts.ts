import {
  activitySchema,
  contactSchema,
  createContactSchema,
  jobContactSchema,
  linkContactToJobSchema,
  type CreateContactInput,
  type LinkContactToJobInput,
} from "@/lib/schemas";

import { getDatabase } from "../client";
import { createId, nowIso } from "../utils";

export async function createContact(input: CreateContactInput) {
  const parsedInput = createContactSchema.parse(input);
  const timestamp = nowIso();
  const contact = contactSchema.parse({
    ...parsedInput,
    id: createId("contact"),
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  await getDatabase().contacts.add(contact);
  return contact;
}

export async function updateContact(id: string, input: Partial<CreateContactInput>) {
  const parsedInput = createContactSchema.partial().parse(input);
  const db = getDatabase();
  const existingContact = await db.contacts.get(id);

  if (!existingContact) {
    throw new Error("Contact was not found.");
  }

  await db.contacts.update(id, {
    ...parsedInput,
    updatedAt: nowIso(),
  });
}

export async function deleteContactPermanently(id: string) {
  const db = getDatabase();
  const linkedJobs = await db.jobContacts.where("contactId").equals(id).toArray();
  const timestamp = nowIso();

  await db.transaction("rw", db.contacts, db.jobContacts, db.activities, async () => {
    await db.contacts.delete(id);
    await db.jobContacts.where("contactId").equals(id).delete();

    if (linkedJobs.length > 0) {
      await db.activities.bulkAdd(
        linkedJobs.map((jobContact) =>
          activitySchema.parse({
            id: createId("activity"),
            jobId: jobContact.jobId,
            type: "contact_removed",
            message: "Removed a contact from this job.",
            createdAt: timestamp,
          }),
        ),
      );
    }
  });
}

export async function unlinkContactFromJob(jobContactId: string) {
  const db = getDatabase();
  const jobContact = await db.jobContacts.get(jobContactId);

  if (!jobContact) {
    return;
  }

  const timestamp = nowIso();

  await db.transaction("rw", db.jobContacts, db.activities, async () => {
    await db.jobContacts.delete(jobContactId);
    await db.activities.add(
      activitySchema.parse({
        id: createId("activity"),
        jobId: jobContact.jobId,
        type: "contact_removed",
        message: "Removed a contact from this job.",
        createdAt: timestamp,
      }),
    );
  });
}

export async function linkContactToJob(input: LinkContactToJobInput) {
  const parsedInput = linkContactToJobSchema.parse(input);
  const db = getDatabase();
  const timestamp = nowIso();
  const jobContact = jobContactSchema.parse({
    ...parsedInput,
    id: createId("job_contact"),
    createdAt: timestamp,
  });

  await db.transaction("rw", db.jobContacts, db.activities, async () => {
    const existingLink = await db.jobContacts
      .where("[jobId+contactId]")
      .equals([parsedInput.jobId, parsedInput.contactId])
      .first();

    if (existingLink) {
      return;
    }

    await db.jobContacts.add(jobContact);
    await db.activities.add(
      activitySchema.parse({
        id: createId("activity"),
        jobId: parsedInput.jobId,
        type: "contact_added",
        message: "Linked a contact to this job.",
        createdAt: timestamp,
      }),
    );
  });

  return jobContact;
}
