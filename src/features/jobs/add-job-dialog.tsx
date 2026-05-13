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
  }, [columns, createColumnId, form, isCreateOpen]);

  async function saveJob(values: JobFormValues) {
    const job = await createJob(toJobInput(values));
    setDuplicateJob(null);
    setPendingValues(null);
    closeJob();
    openJob(job.id);
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

  return (
    <Dialog open={isCreateOpen} onOpenChange={(open) => (!open ? closeJob() : undefined)}>
      <DialogContent className="w-[520px]">
        <DialogHeader>
          <DialogTitle>Add application</DialogTitle>
          <DialogDescription>Track a role in your local board.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-5" onSubmit={form.handleSubmit(onSubmit)}>
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
          <JobFormFields
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
