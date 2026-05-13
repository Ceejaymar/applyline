"use client";

import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Archive, Save, Trash2 } from "lucide-react";
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
import { archiveJob, createJob, deleteJobPermanently, updateJob } from "@/lib/db";
import {
  createJobSchema,
  DEFAULT_COLUMN_IDS,
  type Column,
  type CreateJobInput,
  type Source,
} from "@/lib/schemas";
import type { BoardJob } from "@/lib/use-jobs";
import { useApplylineUiStore } from "@/store/applyline-ui-store";

const emptyJob: CreateJobInput = {
  title: "",
  companyName: "",
  columnId: DEFAULT_COLUMN_IDS.wishlist,
  location: "",
  link: "",
  compensation: "",
  resumeVersion: "",
  sourceId: "",
  notes: "",
  tags: [],
};

type JobDetailDialogProps = {
  columns: Column[];
  job: BoardJob | null;
  sources: Source[];
};

export function JobDetailDialog({ columns, job, sources }: JobDetailDialogProps) {
  const closeJob = useApplylineUiStore((state) => state.closeJob);
  const isCreateOpen = useApplylineUiStore((state) => state.isCreateOpen);
  const isOpen = isCreateOpen || Boolean(job);
  const isEditing = Boolean(job);
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
  } = useForm<CreateJobInput>({
    resolver: zodResolver(createJobSchema),
    defaultValues: emptyJob,
  });

  useEffect(() => {
    reset(
      job ?
        {
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
          rejectedAt: job.rejectedAt,
          archivedReason: job.archivedReason,
          tags: job.tags,
        }
      : emptyJob,
    );
  }, [job, reset, isCreateOpen]);

  async function onSubmit(input: CreateJobInput) {
    if (job) {
      await updateJob(job.id, input);
    } else {
      await createJob(input);
    }
    closeJob();
  }

  async function onDelete() {
    if (!job) {
      return;
    }

    await deleteJobPermanently(job.id);
    closeJob();
  }

  async function onArchive() {
    if (!job) {
      return;
    }

    await archiveJob(job.id, "other");
    closeJob();
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (!open ? closeJob() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Application details" : "Add application"}</DialogTitle>
          <DialogDescription>
            {isEditing ? job?.companyName : "Track a role in your local board."}
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-2">
            <Label htmlFor="title">Role</Label>
            <Input id="title" placeholder="Product Manager" {...register("title")} />
            {errors.title ? (
              <p className="text-xs text-destructive">{errors.title.message}</p>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="company">Company</Label>
            <Input id="company" placeholder="Acme" {...register("companyName")} />
            {errors.companyName ? (
              <p className="text-xs text-destructive">{errors.companyName.message}</p>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="columnId">Column</Label>
              <Select id="columnId" {...register("columnId")}>
                {columns.map((column) => (
                  <option key={column.id} value={column.id}>
                    {column.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="location">Location</Label>
              <Input id="location" placeholder="New York, NY" {...register("location")} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="link">Posting URL</Label>
            <Input id="link" placeholder="https://..." type="url" {...register("link")} />
            {errors.link ? (
              <p className="text-xs text-destructive">{errors.link.message}</p>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="sourceId">Source</Label>
              <Select id="sourceId" {...register("sourceId")}>
                <option value="">None</option>
                {sources.map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="compensation">Compensation</Label>
              <Input id="compensation" placeholder="$120k - $150k" {...register("compensation")} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" placeholder="Next steps, reminders, links..." {...register("notes")} />
          </div>
          <div className="flex items-center justify-between gap-3 pt-2">
            {job ? (
              <Button onClick={onDelete} type="button" variant="destructive">
                <Trash2 />
                Delete
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              {job ? (
                <Button
                  onClick={onArchive}
                  type="button"
                  variant="outline"
                >
                  <Archive />
                  Archive
                </Button>
              ) : null}
              <Button disabled={isSubmitting} type="submit">
                <Save />
                Save
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
