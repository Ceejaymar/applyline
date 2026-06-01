"use client";

import { useEffect, useId, useMemo, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { ChevronDown, ChevronUp, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CompanyAutocomplete } from "@/features/companies/company-autocomplete";
import { getBoardIcon } from "@/features/jobs/board-icons";
import type { JobFormValues } from "@/features/jobs/job-form-schema";
import { inferSourceIdFromLink, isReferralSource } from "@/features/jobs/job-helpers";
import { createSource } from "@/lib/db";
import type { Column, Company, Source } from "@/lib/schemas";

type JobFormFieldsProps = {
  collapsible?: boolean;
  columns: Column[];
  companies: Company[];
  form: UseFormReturn<JobFormValues>;
  sources: Source[];
};

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-xs text-destructive">{message}</p> : null;
}

function CompanyField({
  companies,
  form,
  inputId,
}: Pick<JobFormFieldsProps, "companies" | "form"> & { inputId: string }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={inputId}>Company</Label>
      <CompanyAutocomplete companies={companies} form={form} inputId={inputId} />
      <FieldError message={form.formState.errors.companyName?.message} />
    </div>
  );
}

function SourceField({
  form,
  inputId,
  sources,
}: Pick<JobFormFieldsProps, "form" | "sources"> & { inputId: string }) {
  const [isAddingSource, setIsAddingSource] = useState(false);
  const [sourceName, setSourceName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const selectedSourceId = form.watch("sourceId");
  const selectedSource = useMemo(
    () => sources.find((source) => source.id === selectedSourceId),
    [selectedSourceId, sources],
  );
  const SourceIcon = getBoardIcon(selectedSource?.icon);

  async function onCreateSource() {
    const name = sourceName.trim();

    if (!name) {
      setError("Source name is required.");
      return;
    }

    try {
      const source = await createSource({ name, icon: "circle-help" });
      form.setValue("sourceId", source.id, { shouldDirty: true, shouldValidate: true });
      setSourceName("");
      setIsAddingSource(false);
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Source could not be created.");
    }
  }

  return (
    <div className="grid gap-2">
      <Label htmlFor={inputId}>Source</Label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          {selectedSource ? (
            <SourceIcon className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          ) : null}
          <Select
            className={selectedSource ? "pl-8" : undefined}
            id={inputId}
            {...form.register("sourceId")}
          >
            <option value="">None</option>
            {sources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.name}
              </option>
            ))}
          </Select>
        </div>
        <Button
          aria-label={isAddingSource ? "Cancel custom source" : "Add custom source"}
          onClick={() => {
            setIsAddingSource((next) => !next);
            setError(null);
          }}
          size="icon"
          title={isAddingSource ? "Cancel custom source" : "Add custom source"}
          variant="outline"
        >
          {isAddingSource ? <X /> : <Plus />}
        </Button>
      </div>
      {isAddingSource ? (
        <div className="flex gap-2">
          <Input
            aria-label="Custom source name"
            onChange={(event) => setSourceName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void onCreateSource();
              }
            }}
            placeholder="Custom source"
            value={sourceName}
          />
          <Button onClick={onCreateSource}>Add</Button>
        </div>
      ) : null}
      <FieldError message={error ?? undefined} />
    </div>
  );
}

export function JobFormFields({ collapsible, columns, companies, form, sources }: JobFormFieldsProps) {
  const id = useId();
  const errors = form.formState.errors;
  const link = form.watch("link");
  const selectedSourceId = form.watch("sourceId");
  const shouldEncourageContact = isReferralSource(selectedSourceId, sources);
  const [showDetails, setShowDetails] = useState(false);
  const showDetailFields = !collapsible || showDetails;

  useEffect(() => {
    if (selectedSourceId) {
      return;
    }

    const inferredSourceId = inferSourceIdFromLink(link, sources);

    if (inferredSourceId) {
      form.setValue("sourceId", inferredSourceId, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }, [form, link, selectedSourceId, sources]);

  return (
    <div className="grid gap-5">
      <section className="grid gap-3">
        <div className="grid gap-2">
          <Label htmlFor={`${id}-title`}>Role</Label>
          <Input id={`${id}-title`} placeholder="Product Manager" {...form.register("title")} />
          <FieldError message={errors.title?.message} />
        </div>
        <CompanyField companies={companies} form={form} inputId={`${id}-company`} />
        <input type="hidden" {...form.register("companyId")} />
      </section>

      <section className="grid gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor={`${id}-columnId`}>Status</Label>
            <Select id={`${id}-columnId`} {...form.register("columnId")}>
              {columns.map((column) => (
                <option key={column.id} value={column.id}>
                  {column.name}
                </option>
              ))}
            </Select>
          </div>
          <SourceField form={form} inputId={`${id}-sourceId`} sources={sources} />
        </div>
        {shouldEncourageContact ? (
          <p className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
            Referral selected. Add or link the referring contact in the job drawer when you save.
          </p>
        ) : null}
        <div className="grid gap-2">
          <Label htmlFor={`${id}-link`}>Posting URL</Label>
          <Input id={`${id}-link`} placeholder="https://..." type="url" {...form.register("link")} />
          <FieldError message={errors.link?.message} />
        </div>
      </section>

      {collapsible ? (
        <button
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setShowDetails((prev) => !prev)}
          type="button"
        >
          {showDetails ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          {showDetails ? "Fewer details" : "Add details"}
        </button>
      ) : null}

      {showDetailFields ? (
        <div className="grid gap-5">
          <section className="grid gap-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor={`${id}-location`}>Location</Label>
                <Input id={`${id}-location`} placeholder="New York, NY" {...form.register("location")} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`${id}-roleType`}>Role type</Label>
                <Select id={`${id}-roleType`} {...form.register("roleType")}>
                  <option value="">Not set</option>
                  <option value="remote">Remote</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="in_person">In-person</option>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor={`${id}-compensation`}>Compensation</Label>
                <Input
                  id={`${id}-compensation`}
                  placeholder="$120k - $150k"
                  {...form.register("compensation")}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`${id}-resumeVersion`}>Resume version</Label>
                <Input
                  id={`${id}-resumeVersion`}
                  placeholder="resume-product-v4.pdf"
                  {...form.register("resumeVersion")}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor={`${id}-appliedAt`}>Applied at</Label>
                <Input id={`${id}-appliedAt`} type="datetime-local" {...form.register("appliedAt")} />
              </div>
            </div>
          </section>

          <section className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor={`${id}-tags`}>Tags</Label>
              <Input
                id={`${id}-tags`}
                placeholder="frontend, remote"
                {...form.register("tagsText")}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`${id}-description`}>Description</Label>
              <Textarea
                className="min-h-44 resize-y whitespace-pre-wrap font-mono text-[13px] leading-6"
                id={`${id}-description`}
                placeholder="Paste the job description here..."
                spellCheck
                {...form.register("description")}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`${id}-notes`}>Notes</Label>
              <Textarea
                className="min-h-32 resize-y whitespace-pre-wrap leading-6"
                id={`${id}-notes`}
                placeholder="Next steps, reminders, links..."
                spellCheck
                {...form.register("notes")}
              />
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
