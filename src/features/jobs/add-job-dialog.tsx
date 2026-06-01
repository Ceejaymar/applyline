"use client";

import { useEffect, useState } from "react";
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
import { DuplicateJobWarning } from "@/features/jobs/duplicate-job-warning";
import { JobFormFields } from "@/features/jobs/job-form-fields";
import {
  emptyJobFormValues,
  jobFormSchema,
  toJobInput,
  type JobFormValues,
} from "@/features/jobs/job-form-schema";
import { findPossibleDuplicateJob } from "@/features/jobs/job-helpers";
import { createJob } from "@/lib/db";
import { DEFAULT_COLUMN_IDS, type Column, type Company, type Source } from "@/lib/schemas";
import type { BoardJob } from "@/lib/use-jobs";
import { useApplylineUiStore } from "@/store/applyline-ui-store";

type AddJobDialogProps = {
  columns: Column[];
  companies: Company[];
  jobs: BoardJob[];
  sources: Source[];
};

export function AddJobDialog({ columns, companies, jobs, sources }: AddJobDialogProps) {
  const closeJob = useApplylineUiStore((state) => state.closeJob);
  const createColumnId = useApplylineUiStore((state) => state.createColumnId);
  const isCreateOpen = useApplylineUiStore((state) => state.isCreateOpen);
  const openJob = useApplylineUiStore((state) => state.openJob);
  const [duplicateJob, setDuplicateJob] = useState<BoardJob | null>(null);
  const [pendingValues, setPendingValues] = useState<JobFormValues | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const form = useForm<JobFormValues>({
    resolver: zodResolver(jobFormSchema),
    defaultValues: emptyJobFormValues,
  });

  useEffect(() => {
    if (!isCreateOpen) {
      return;
    }

    form.reset({
      ...emptyJobFormValues,
      columnId: createColumnId ?? columns[0]?.id ?? DEFAULT_COLUMN_IDS.wishlist,
    });
    setDuplicateJob(null);
    setPendingValues(null);
    setSaveError(null);
  }, [columns, createColumnId, form, isCreateOpen]);

  async function saveJob(values: JobFormValues) {
    const jobInput = toJobInput(values);

    try {
      setSaveError(null);
      const job = await createJob(jobInput);
      setDuplicateJob(null);
      setPendingValues(null);
      closeJob();
      openJob(job.id);
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("[AddJobDialog] createJob failed", error);
      }
      setSaveError("Could not save job. Please try again.");
    }
  }

  async function onSubmit(values: JobFormValues) {
    const possibleDuplicateJob = findPossibleDuplicateJob({
      companyName: values.companyName,
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

  function onInvalid() {
    setSaveError("Please check the highlighted fields before saving.");
  }

  return (
    <Dialog open={isCreateOpen} onOpenChange={(open) => (!open ? closeJob() : undefined)}>
      <DialogContent className="w-[520px]">
        <DialogHeader>
          <DialogTitle>Add application</DialogTitle>
          <DialogDescription>Track a role in your local board.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-5" onSubmit={form.handleSubmit(onSubmit, onInvalid)}>
          {duplicateJob ? (
            <DuplicateJobWarning
              duplicateJob={duplicateJob}
              onContinue={() => {
                void saveJob(pendingValues ?? form.getValues());
              }}
              onOpenExisting={() => {
                closeJob();
                openJob(duplicateJob.id);
              }}
            />
          ) : null}
          {saveError ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {saveError}
            </p>
          ) : null}
          {form.formState.errors.companyMetadata ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              Company metadata could not be saved. Select the company again or enter it manually.
            </p>
          ) : null}
          <JobFormFields
            collapsible
            columns={columns}
            companies={companies}
            form={form}
            sources={sources}
          />
          <div className="flex justify-end border-t pt-4">
            <Button disabled={form.formState.isSubmitting} type="submit">
              <Save />
              Save job
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
