"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Archive, ExternalLink, Save, Trash2 } from "lucide-react";
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
import { archiveJob, deleteJobPermanently, updateJob } from "@/lib/db";
import { createJobSchema, type Column, type CreateJobInput, type Source } from "@/lib/schemas";
import type { BoardJob } from "@/lib/use-jobs";
import { useApplylineUiStore } from "@/store/applyline-ui-store";

type JobDrawerProps = {
  columns: Column[];
  job: BoardJob | null;
  sources: Source[];
};

function parseTags(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function formatFullDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function JobDrawer({ columns, job, sources }: JobDrawerProps) {
  const closeJob = useApplylineUiStore((state) => state.closeJob);
  const [tagsText, setTagsText] = useState("");
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
  } = useForm<CreateJobInput>({
    resolver: zodResolver(createJobSchema),
  });

  useEffect(() => {
    if (!job) {
      return;
    }

    reset({
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
    });
    setTagsText(job.tags.join(", "));
  }, [job, reset]);

  async function onSubmit(input: CreateJobInput) {
    if (!job) {
      return;
    }

    await updateJob(job.id, {
      ...input,
      tags: parseTags(tagsText),
    });
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
    <Dialog open={Boolean(job)} onOpenChange={(open) => (!open ? closeJob() : undefined)}>
      <DialogContent className="w-[460px]">
        <DialogHeader>
          <DialogTitle>{job?.title ?? "Application details"}</DialogTitle>
          <DialogDescription>
            {job ? `${job.companyName} · updated ${formatFullDate(job.updatedAt)}` : null}
          </DialogDescription>
        </DialogHeader>
        {job ? (
          <form className="grid gap-4" onSubmit={handleSubmit(onSubmit)}>
            <div className="grid gap-2">
              <Label htmlFor="edit-title">Role</Label>
              <Input id="edit-title" {...register("title")} />
              {errors.title ? (
                <p className="text-xs text-destructive">{errors.title.message}</p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-company">Company</Label>
              <Input id="edit-company" {...register("companyName")} />
              {errors.companyName ? (
                <p className="text-xs text-destructive">{errors.companyName.message}</p>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="edit-columnId">Column</Label>
                <Select id="edit-columnId" {...register("columnId")}>
                  {columns.map((column) => (
                    <option key={column.id} value={column.id}>
                      {column.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-sourceId">Source</Label>
                <Select id="edit-sourceId" {...register("sourceId")}>
                  <option value="">None</option>
                  {sources.map((source) => (
                    <option key={source.id} value={source.id}>
                      {source.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-link">Posting URL</Label>
              <div className="flex gap-2">
                <Input id="edit-link" type="url" {...register("link")} />
                {job.link ? (
                  <Button
                    aria-label="Open posting"
                    onClick={() => window.open(job.link, "_blank", "noopener,noreferrer")}
                    size="icon"
                    variant="outline"
                  >
                    <ExternalLink />
                  </Button>
                ) : null}
              </div>
              {errors.link ? (
                <p className="text-xs text-destructive">{errors.link.message}</p>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="edit-location">Location</Label>
                <Input id="edit-location" {...register("location")} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-tags">Tags</Label>
                <Input
                  id="edit-tags"
                  onChange={(event) => setTagsText(event.target.value)}
                  value={tagsText}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-notes">Notes</Label>
              <Textarea id="edit-notes" {...register("notes")} />
            </div>
            <div className="flex items-center justify-between gap-3 pt-2">
              <Button onClick={onDelete} type="button" variant="destructive">
                <Trash2 />
                Delete
              </Button>
              <div className="flex gap-2">
                <Button onClick={onArchive} type="button" variant="outline">
                  <Archive />
                  Archive
                </Button>
                <Button disabled={isSubmitting} type="submit">
                  <Save />
                  Save
                </Button>
              </div>
            </div>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
