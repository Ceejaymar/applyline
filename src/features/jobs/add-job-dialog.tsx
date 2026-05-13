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
import { JobFormFields } from "@/features/jobs/job-form-fields";
import {
  emptyJobFormValues,
  jobFormSchema,
  toJobInput,
  type JobFormValues,
} from "@/features/jobs/job-form-schema";
import { createJob } from "@/lib/db";
import { DEFAULT_COLUMN_IDS, type Column, type Company, type Source } from "@/lib/schemas";
import { useApplylineUiStore } from "@/store/applyline-ui-store";

type AddJobDialogProps = {
  columns: Column[];
  companies: Company[];
  sources: Source[];
};

export function AddJobDialog({ columns, companies, sources }: AddJobDialogProps) {
  const closeJob = useApplylineUiStore((state) => state.closeJob);
  const createColumnId = useApplylineUiStore((state) => state.createColumnId);
  const isCreateOpen = useApplylineUiStore((state) => state.isCreateOpen);
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
  }, [columns, createColumnId, form, isCreateOpen]);

  async function onSubmit(values: JobFormValues) {
    const job = await createJob(toJobInput(values));
    closeJob();
    useApplylineUiStore.getState().openJob(job.id);
  }

  return (
    <Dialog open={isCreateOpen} onOpenChange={(open) => (!open ? closeJob() : undefined)}>
      <DialogContent className="w-[520px]">
        <DialogHeader>
          <DialogTitle>Add application</DialogTitle>
          <DialogDescription>Track a role in your local board.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-5" onSubmit={form.handleSubmit(onSubmit)}>
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
