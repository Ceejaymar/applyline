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
import { createJob, deleteJob, updateJob } from "@/lib/db";
import {
  jobFormSchema,
  jobStatusLabels,
  jobStatuses,
  type Job,
  type JobFormInput,
} from "@/lib/job-schema";
import { useApplylineUiStore } from "@/store/applyline-ui-store";

const emptyJob: JobFormInput = {
  title: "",
  company: "",
  status: "wishlist",
  location: "",
  url: "",
  contactName: "",
  notes: "",
};

type JobDetailDialogProps = {
  job: Job | null;
};

export function JobDetailDialog({ job }: JobDetailDialogProps) {
  const closeJob = useApplylineUiStore((state) => state.closeJob);
  const isCreateOpen = useApplylineUiStore((state) => state.isCreateOpen);
  const isOpen = isCreateOpen || Boolean(job);
  const isEditing = Boolean(job);
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
  } = useForm<JobFormInput>({
    resolver: zodResolver(jobFormSchema),
    defaultValues: emptyJob,
  });

  useEffect(() => {
    reset(job ?? emptyJob);
  }, [job, reset, isCreateOpen]);

  async function onSubmit(input: JobFormInput) {
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

    await deleteJob(job.id);
    closeJob();
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (!open ? closeJob() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Application details" : "Add application"}</DialogTitle>
          <DialogDescription>
            {isEditing ? job?.company : "Track a role in your local board."}
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
            <Input id="company" placeholder="Acme" {...register("company")} />
            {errors.company ? (
              <p className="text-xs text-destructive">{errors.company.message}</p>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="status">Status</Label>
              <Select id="status" {...register("status")}>
                {jobStatuses.map((status) => (
                  <option key={status} value={status}>
                    {jobStatusLabels[status]}
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
            <Label htmlFor="url">Posting URL</Label>
            <Input id="url" placeholder="https://..." type="url" {...register("url")} />
            {errors.url ? (
              <p className="text-xs text-destructive">{errors.url.message}</p>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="contactName">Contact</Label>
            <Input id="contactName" placeholder="Recruiter or hiring manager" {...register("contactName")} />
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
                  onClick={() =>
                    reset({
                      ...job,
                      status: "archived",
                    })
                  }
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
