"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
} from "react";
import { CheckCircle2, Loader2, Pencil, Plus, Save, TriangleAlert, X } from "lucide-react";
import { z } from "zod";

import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CompanyAutocomplete } from "@/features/companies/company-autocomplete";
import { findPossibleDuplicateJob } from "@/features/jobs/job-helpers";
import { createJob, findOrCreateSourceByName } from "@/lib/db";
import {
  DEFAULT_COLUMN_IDS,
  DEFAULT_SOURCE_IDS,
  type CompanyBrandMetadata,
  roleTypeSchema,
  type Source,
} from "@/lib/schemas";
import { useBoardData, type BoardJob } from "@/lib/use-jobs";
import { cn } from "@/lib/utils";

const DESCRIPTION_LIMIT = 50_000;

const extensionMessageSchema = z.object({
  source: z.literal("applyline-extension"),
  type: z.literal("APPLYLINE_JOB_DRAFT"),
  draftId: z.string().min(1),
  draft: z.unknown(),
});

const missingDraftMessageSchema = z.object({
  source: z.literal("applyline-extension"),
  type: z.literal("APPLYLINE_JOB_DRAFT_MISSING"),
  draftId: z.string().min(1),
});

const captureDraftSchema = z
  .object({
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
  });

type CaptureDraft = z.infer<typeof captureDraftSchema>;
type CaptureMode = "waiting" | "review" | "edit" | "saving" | "success" | "error";

type FormValues = {
  title: string;
  companyId: string;
  companyMetadata?: CompanyBrandMetadata;
  companyName: string;
  link: string;
  sourceId: string;
  sourceName: string;
  columnId: string;
  location: string;
  roleType: "" | "remote" | "hybrid" | "in_person";
  compensation: string;
  description: string;
  tagsText: string;
};

function emptyToUndefined(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function parseTags(value: string) {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  );
}

function mergeTags(...tagGroups: (string[] | undefined)[]) {
  return Array.from(
    new Set(
      tagGroups
        .flatMap((tags) => tags ?? [])
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  );
}

function decodeDraftPayload(encodedDraft: string) {
  const base64 = encodedDraft.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

function draftRoleType(draft: CaptureDraft): FormValues["roleType"] {
  if (draft.roleType) {
    return draft.roleType;
  }

  if (draft.workplaceType === "onsite") {
    return "in_person";
  }

  if (draft.workplaceType === "remote" || draft.workplaceType === "hybrid") {
    return draft.workplaceType;
  }

  return "";
}

function workplaceTypeTag(workplaceType: CaptureDraft["workplaceType"]) {
  if (!workplaceType || workplaceType === "unknown") {
    return undefined;
  }

  return workplaceType;
}

function compactTags(tags: (string | undefined)[]) {
  return Array.from(
    new Set(
      tags
        .map((tag) => tag?.trim())
        .filter((tag): tag is string => Boolean(tag)),
    ),
  );
}

function defaultSourceIdForName(sourceName?: string) {
  const normalizedName = sourceName?.trim().toLocaleLowerCase();

  if (!normalizedName) {
    return "";
  }

  const sourceIdsByName: Record<string, string> = {
    "current page": DEFAULT_SOURCE_IDS.companyWebsite,
    "company website": DEFAULT_SOURCE_IDS.companyWebsite,
    greenhouse: DEFAULT_SOURCE_IDS.greenhouse,
    indeed: DEFAULT_SOURCE_IDS.indeed,
    lever: DEFAULT_SOURCE_IDS.lever,
    linkedin: DEFAULT_SOURCE_IDS.linkedin,
    referral: DEFAULT_SOURCE_IDS.referral,
    wellfound: DEFAULT_SOURCE_IDS.wellfound,
    workday: DEFAULT_SOURCE_IDS.workday,
  };

  return sourceIdsByName[normalizedName] ?? "";
}

function toFormValues(draft: CaptureDraft, sources: Source[], defaultColumnId: string): FormValues {
  const defaultSourceId = draft.sourceId ?? defaultSourceIdForName(draft.sourceName);
  const matchedSource =
    defaultSourceId ? sources.find((source) => source.id === defaultSourceId) : undefined;
  const matchedSourceByName =
    draft.sourceName ?
      sources.find((source) => source.name.toLocaleLowerCase() === draft.sourceName?.toLocaleLowerCase())
    : undefined;

  const tags = mergeTags(draft.tags, compactTags([workplaceTypeTag(draft.workplaceType)]));

  return {
    title: draft.title,
    companyId: "",
    companyMetadata: undefined,
    companyName: draft.companyName,
    link: draft.link ?? draft.url ?? "",
    sourceId: matchedSource?.id ?? matchedSourceByName?.id ?? "",
    sourceName: draft.sourceName ?? matchedSource?.name ?? matchedSourceByName?.name ?? "",
    columnId: defaultColumnId,
    location: draft.location ?? "",
    roleType: draftRoleType(draft),
    compensation: draft.compensation ?? "",
    description: draft.description ?? "",
    tagsText: tags.join(", "),
  };
}

function formatRoleType(value: FormValues["roleType"]) {
  if (value === "in_person") {
    return "On-site";
  }

  if (value === "remote") {
    return "Remote";
  }

  if (value === "hybrid") {
    return "Hybrid";
  }

  return "Unknown";
}

function getDraftFromHash() {
  const hash = window.location.hash;
  const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  const encodedDraft = params.get("draft");

  if (!encodedDraft) {
    return null;
  }

  return captureDraftSchema.parse(decodeDraftPayload(encodedDraft));
}

function getDraftIdFromQuery() {
  return new URLSearchParams(window.location.search).get("draftId");
}

function postBridgeMessage(type: "APPLYLINE_CAPTURE_RECEIVED" | "APPLYLINE_CAPTURE_SAVED", draftId: string) {
  window.postMessage(
    {
      source: "applyline-app",
      type,
      draftId,
    },
    window.location.origin,
  );
}

function getDraftStringLength(draft: unknown, field: string) {
  if (!draft || typeof draft !== "object" || !(field in draft)) {
    return undefined;
  }

  const value = (draft as Record<string, unknown>)[field];
  return typeof value === "string" ? value.length : undefined;
}

function formatZodIssues(error: z.ZodError, draft?: unknown) {
  return error.issues
    .map((issue) => {
      const field = issue.path.join(".") || "draft";
      const fieldLength = getDraftStringLength(draft, field);
      const suffix =
        field === "description" && issue.code === "too_big"
          ? ` Description length is ${fieldLength ?? "over the limit"}; maximum is ${DESCRIPTION_LIMIT} characters.`
          : field === "url" || field === "link"
            ? " Check that the URL is valid, or leave it blank."
            : "";

      return `${field}: ${issue.message}.${suffix}`;
    })
    .join(" ");
}

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div className="grid gap-1">
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="whitespace-pre-wrap break-words text-sm">{value || "—"}</dd>
    </div>
  );
}

function FormField({
  children,
  id,
  label,
}: {
  children: React.ReactNode;
  id: string;
  label: string;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function DuplicateWarning({
  duplicateJob,
  onCancel,
  onContinue,
}: {
  duplicateJob: BoardJob;
  onCancel: () => void;
  onContinue: () => void;
}) {
  return (
    <div className="grid gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950">
      <div className="flex gap-3">
        <TriangleAlert className="mt-0.5 size-5 shrink-0" />
        <div className="grid gap-1">
          <h2 className="font-semibold">Possible duplicate</h2>
          <p className="text-sm">
            Applyline already has {duplicateJob.title} at {duplicateJob.companyName}.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className={buttonVariants({ size: "sm" })} onClick={onContinue} type="button">
          Save anyway
        </button>
        <button className={buttonVariants({ size: "sm", variant: "outline" })} onClick={onCancel} type="button">
          Review draft
        </button>
      </div>
    </div>
  );
}

export function CapturePageClient() {
  const router = useRouter();
  const { columns, companies, error: boardError, isLoading, jobs, sources } = useBoardData();
  const [mode, setMode] = useState<CaptureMode>("waiting");
  const [message, setMessage] = useState("Waiting for a job draft from the extension.");
  const [formValues, setFormValues] = useState<FormValues | null>(null);
  const [savedJobTitle, setSavedJobTitle] = useState("");
  const [duplicateJob, setDuplicateJob] = useState<BoardJob | null>(null);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const hasReadHashRef = useRef(false);
  const defaultColumnId =
    columns.find((column) => column.id === DEFAULT_COLUMN_IDS.wishlist)?.id ??
    columns[0]?.id ??
    DEFAULT_COLUMN_IDS.wishlist;
  const selectedSource = useMemo(
    () => sources.find((source) => source.id === formValues?.sourceId),
    [formValues?.sourceId, sources],
  );

  useEffect(() => {
    if (isLoading || hasReadHashRef.current) {
      return;
    }

    hasReadHashRef.current = true;

    try {
      const draft = getDraftFromHash();
      const queryDraftId = getDraftIdFromQuery();

      if (queryDraftId) {
        setActiveDraftId(queryDraftId);
        setMessage("Loading draft from the Applyline extension.");
      }

      if (!draft) {
        setMode("waiting");
        return;
      }

      setFormValues(toFormValues(draft, sources, defaultColumnId));
      setMode("review");
      setActiveDraftId(null);
      window.history.replaceState(null, "", "/capture");
    } catch (error) {
      setMode("error");
      setMessage(
        error instanceof z.ZodError ?
          formatZodIssues(error)
        : error instanceof Error ? error.message
        : "The job draft could not be read.",
      );
    }
  }, [defaultColumnId, isLoading, sources]);

  useEffect(() => {
    function onMessage(event: MessageEvent<unknown>) {
      if (event.source !== window) {
        return;
      }

      // Extension content scripts that run on the Applyline origin can post this
      // exact envelope. Unknown message shapes and cross-window messages are ignored.
      const parsedMessage = extensionMessageSchema.safeParse(event.data);

      if (!parsedMessage.success) {
        const missingDraftMessage = missingDraftMessageSchema.safeParse(event.data);

        if (missingDraftMessage.success) {
          setActiveDraftId(missingDraftMessage.data.draftId);
          setMode("error");
          setMessage(
            `The extension draft "${missingDraftMessage.data.draftId}" could not be found. Rebuild/reload the extension, then try capturing the job again.`,
          );
        }

        return;
      }

      const parsedDraft = captureDraftSchema.safeParse(parsedMessage.data.draft);

      if (!parsedDraft.success) {
        setMode("error");
        setMessage(formatZodIssues(parsedDraft.error, parsedMessage.data.draft));
        return;
      }

      setFormValues(toFormValues(parsedDraft.data, sources, defaultColumnId));
      setActiveDraftId(parsedMessage.data.draftId);
      setDuplicateJob(null);
      setMode("review");
      postBridgeMessage("APPLYLINE_CAPTURE_RECEIVED", parsedMessage.data.draftId);
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [defaultColumnId, sources]);

  function updateField(
    key: Exclude<keyof FormValues, "companyMetadata">,
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) {
    setFormValues((values) => (values ? { ...values, [key]: event.target.value } : values));
  }

  const companyAutocompleteForm = useMemo(
    () => ({
      getValues: (name: "companyName") => formValues?.[name] ?? "",
      register: (name: "companyName") => ({
        name,
        onBlur: (_event: FocusEvent<HTMLInputElement>) => undefined,
        onChange: (event: ChangeEvent<HTMLInputElement>) => {
          const nextValue = event.target.value;
          setFormValues((values) =>
            values ?
              {
                ...values,
                companyId: "",
                companyMetadata: undefined,
                [name]: nextValue,
              }
            : values,
          );
        },
        value: formValues?.companyName ?? "",
      }),
      setValue: (
        name: "companyName" | "companyId" | "companyMetadata",
        value: string | CompanyBrandMetadata | undefined,
      ) => {
        setFormValues((values) => {
          if (!values) {
            return values;
          }

          if (name === "companyMetadata") {
            return {
              ...values,
              companyMetadata: value as CompanyBrandMetadata | undefined,
            };
          }

          return { ...values, [name]: value as string };
        });
      },
      watch: (name: "companyName") => formValues?.[name] ?? "",
    }),
    [formValues],
  );

  async function resolveSourceId(values: FormValues) {
    if (values.sourceId) {
      return values.sourceId;
    }

    const sourceName = values.sourceName.trim();

    if (!sourceName) {
      return undefined;
    }

    const existingSource = sources.find(
      (source) => source.name.toLocaleLowerCase() === sourceName.toLocaleLowerCase(),
    );

    if (existingSource) {
      return existingSource.id;
    }

    const createdSource = await findOrCreateSourceByName(sourceName);
    return createdSource.id;
  }

  async function saveJob({ skipDuplicateCheck = false } = {}) {
    if (!formValues) {
      return;
    }

    const possibleDuplicate =
      skipDuplicateCheck ? null : (
        findPossibleDuplicateJob({
          companyName: formValues.companyName,
          jobs,
          link: formValues.link,
          title: formValues.title,
        })
      );

    if (possibleDuplicate) {
      setDuplicateJob(possibleDuplicate);
      return;
    }

    setMode("saving");
    setDuplicateJob(null);

    try {
      const sourceId = await resolveSourceId(formValues);
      const sourceLabel =
        sources.find((source) => source.id === sourceId)?.name || formValues.sourceName.trim();
      const activityMessage = sourceLabel
        ? `Created from Applyline Clipper via ${sourceLabel}.`
        : "Created from Applyline Clipper.";
      const job = await createJob({
        title: formValues.title,
        companyId: emptyToUndefined(formValues.companyId),
        companyName: formValues.companyName,
        companyMetadata: formValues.companyMetadata,
        columnId: formValues.columnId || DEFAULT_COLUMN_IDS.wishlist,
        sourceId,
        link: formValues.link.trim(),
        location: emptyToUndefined(formValues.location),
        roleType: emptyToUndefined(formValues.roleType) as "remote" | "hybrid" | "in_person" | undefined,
        compensation: emptyToUndefined(formValues.compensation),
        description: emptyToUndefined(formValues.description),
        tags: parseTags(formValues.tagsText),
      }, { activityMessage });

      setSavedJobTitle(job.title);
      setMode("success");

      if (activeDraftId) {
        postBridgeMessage("APPLYLINE_CAPTURE_SAVED", activeDraftId);
      }

      sessionStorage.setItem(
        "applyline:toast",
        JSON.stringify({ type: "success", message: "Job added to Applyline" }),
      );
      router.replace("/");
    } catch (error) {
      setMode("error");
      setMessage(error instanceof Error ? error.message : "The job could not be saved.");
    }
  }

  function resetForAnother() {
    setFormValues(null);
    setSavedJobTitle("");
    setDuplicateJob(null);
    setActiveDraftId(null);
    setMode("waiting");
    setMessage("Open a job posting and use the Applyline extension to capture another draft.");
  }

  if (isLoading) {
    return (
      <main className="mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-3xl items-center px-4 py-10">
        <section className="flex w-full items-start gap-4 rounded-lg border bg-card p-6 shadow-sm">
          <Loader2 className="mt-1 size-5 animate-spin text-primary" />
          <div className="grid gap-1">
            <h1 className="text-xl font-semibold">Preparing capture</h1>
            <p className="text-sm text-muted-foreground">Loading your local Applyline data.</p>
          </div>
        </section>
      </main>
    );
  }

  if (boardError) {
    return (
      <main className="mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-3xl items-center px-4 py-10">
        <section className="grid w-full gap-4 rounded-lg border bg-card p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <TriangleAlert className="mt-1 size-5 text-destructive" />
            <div className="grid gap-1">
              <h1 className="text-xl font-semibold">Capture unavailable</h1>
              <p className="text-sm text-muted-foreground">{boardError.message}</p>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-4xl items-center px-4 py-10">
      <section className="w-full rounded-lg border bg-card p-6 shadow-sm">
        {mode === "waiting" ? (
          <div className="grid gap-5">
            <div className="flex items-start gap-4">
              <Loader2 className="mt-1 size-5 text-muted-foreground" />
              <div className="grid gap-1">
                <h1 className="text-xl font-semibold">Capture a job</h1>
                <p className="text-sm text-muted-foreground">{message}</p>
              </div>
            </div>
            <div className="border-t pt-5">
              <Link className={buttonVariants({ variant: "outline" })} href="/">
                Open board
              </Link>
            </div>
          </div>
        ) : null}

        {mode === "error" ? (
          <div className="grid gap-5">
            <div className="flex items-start gap-4">
              <TriangleAlert className="mt-1 size-5 text-destructive" />
              <div className="grid gap-1">
                <h1 className="text-xl font-semibold">Capture failed</h1>
                <p className="text-sm text-muted-foreground">{message}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 border-t pt-5">
              <button className={buttonVariants({ variant: "outline" })} onClick={resetForAnother} type="button">
                Try another
              </button>
              <Link className={buttonVariants()} href="/">
                Open board
              </Link>
            </div>
          </div>
        ) : null}

        {mode === "saving" ? (
          <div className="flex items-start gap-4">
            <Loader2 className="mt-1 size-5 animate-spin text-primary" />
            <div className="grid gap-1">
              <h1 className="text-xl font-semibold">Saving job</h1>
              <p className="text-sm text-muted-foreground">Writing this draft into your local Applyline database.</p>
            </div>
          </div>
        ) : null}

        {mode === "success" ? (
          <div className="grid gap-5">
            <div className="flex items-start gap-4">
              <CheckCircle2 className="mt-1 size-5 text-primary" />
              <div className="grid gap-1">
                <h1 className="text-xl font-semibold">Saved to Applyline</h1>
                <p className="text-sm text-muted-foreground">
                  {savedJobTitle || "The job"} was added to your board.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 border-t pt-5">
              <Link className={buttonVariants()} href="/">
                Open board
              </Link>
              <button className={buttonVariants({ variant: "outline" })} onClick={resetForAnother} type="button">
                <Plus />
                Add another
              </button>
            </div>
          </div>
        ) : null}

        {(mode === "review" || mode === "edit") && formValues ? (
          <div className="grid gap-6">
            <div className="flex flex-col gap-3 border-b pb-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="grid gap-1">
                <h1 className="text-xl font-semibold">Review job before saving</h1>
                <p className="text-sm text-muted-foreground">
                  Check the extension draft before saving it to your local Applyline board.
                </p>
              </div>
              <span className="rounded-md border bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
                {(selectedSource?.name ?? formValues.sourceName) || "No source"}
              </span>
            </div>

            {duplicateJob ? (
              <DuplicateWarning
                duplicateJob={duplicateJob}
                onCancel={() => setDuplicateJob(null)}
                onContinue={() => void saveJob({ skipDuplicateCheck: true })}
              />
            ) : null}

            {mode === "review" ? (
              <dl className="grid gap-5 sm:grid-cols-2">
                <Field label="Title" value={formValues.title} />
                <Field label="Company" value={formValues.companyName} />
                <Field label="URL" value={formValues.link} />
                <Field label="Source" value={selectedSource?.name ?? formValues.sourceName} />
                <Field label="Location" value={formValues.location} />
                <Field label="Workplace type" value={formatRoleType(formValues.roleType)} />
                <Field label="Compensation" value={formValues.compensation} />
                <Field label="Tags" value={formValues.tagsText} />
                <div className="sm:col-span-2">
                  <Field label="Description" value={formValues.description} />
                </div>
              </dl>
            ) : (
              <form className="grid gap-5" onSubmit={(event) => event.preventDefault()}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField id="capture-title" label="Title">
                    <Input
                      id="capture-title"
                      onChange={(event) => updateField("title", event)}
                      required
                      value={formValues.title}
                    />
                  </FormField>
                  <FormField id="capture-company" label="Company">
                    <CompanyAutocomplete
                      companies={companies}
                      form={companyAutocompleteForm}
                      inputId="capture-company"
                    />
                  </FormField>
                </div>
                <FormField id="capture-link" label="URL">
                  <Input
                    id="capture-link"
                    onChange={(event) => updateField("link", event)}
                    type="url"
                    value={formValues.link}
                  />
                </FormField>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField id="capture-source" label="Source">
                    <Select id="capture-source" onChange={(event) => updateField("sourceId", event)} value={formValues.sourceId}>
                      <option value="">Use source name</option>
                      {sources.map((source) => (
                        <option key={source.id} value={source.id}>
                          {source.name}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                  <FormField id="capture-source-name" label="Source name">
                    <Input
                      id="capture-source-name"
                      onChange={(event) => updateField("sourceName", event)}
                      placeholder="Company Website"
                      value={formValues.sourceName}
                    />
                  </FormField>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField id="capture-column" label="Column">
                    <Select id="capture-column" onChange={(event) => updateField("columnId", event)} value={formValues.columnId}>
                      {columns.map((column) => (
                        <option key={column.id} value={column.id}>
                          {column.name}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                  <FormField id="capture-location" label="Location">
                    <Input id="capture-location" onChange={(event) => updateField("location", event)} value={formValues.location} />
                  </FormField>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField id="capture-role-type" label="Workplace type">
                    <Select id="capture-role-type" onChange={(event) => updateField("roleType", event)} value={formValues.roleType}>
                      <option value="">Unknown</option>
                      <option value="remote">Remote</option>
                      <option value="hybrid">Hybrid</option>
                      <option value="in_person">On-site</option>
                    </Select>
                  </FormField>
                  <FormField id="capture-compensation" label="Compensation">
                    <Input
                      id="capture-compensation"
                      onChange={(event) => updateField("compensation", event)}
                      value={formValues.compensation}
                    />
                  </FormField>
                </div>
                <FormField id="capture-tags" label="Tags">
                  <Input id="capture-tags" onChange={(event) => updateField("tagsText", event)} value={formValues.tagsText} />
                </FormField>
                <FormField id="capture-description" label="Description">
                  <Textarea
                    id="capture-description"
                    onChange={(event) => updateField("description", event)}
                    rows={8}
                    value={formValues.description}
                  />
                </FormField>
              </form>
            )}

            <div className="flex flex-wrap gap-3 border-t pt-5">
              <button
                className={buttonVariants()}
                disabled={!formValues.title || !formValues.companyName}
                onClick={() => void saveJob()}
                type="button"
              >
                <Save />
                Save job
              </button>
              <button
                className={buttonVariants({ variant: "outline" })}
                onClick={() => {
                  setDuplicateJob(null);
                  setMode(mode === "review" ? "edit" : "review");
                }}
                type="button"
              >
                <Pencil />
                {mode === "review" ? "Edit before saving" : "Review draft"}
              </button>
              <button
                className={cn(buttonVariants({ variant: "ghost" }), "text-muted-foreground")}
                onClick={resetForAnother}
                type="button"
              >
                <X />
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}

export const CapturePage = CapturePageClient;
