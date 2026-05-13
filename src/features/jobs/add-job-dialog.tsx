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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createJob } from "@/lib/db";
import {
  createJobSchema,
  DEFAULT_COLUMN_IDS,
  type Column,
  type CreateJobInput,
  type Source,
} from "@/lib/schemas";
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

type AddJobDialogProps = {
  columns: Column[];
  sources: Source[];
};

function parseTags(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function AddJobDialog({ columns, sources }: AddJobDialogProps) {
  const closeJob = useApplylineUiStore((state) => state.closeJob);
  const createColumnId = useApplylineUiStore((state) => state.createColumnId);
  const isCreateOpen = useApplylineUiStore((state) => state.isCreateOpen);
  const [tagsText, setTagsText] = useState("");
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
    if (!isCreateOpen) {
      return;
    }

    reset({
      ...emptyJob,
      columnId: createColumnId ?? columns[0]?.id ?? DEFAULT_COLUMN_IDS.wishlist,
    });
    setTagsText("");
  }, [columns, createColumnId, isCreateOpen, reset]);

  async function onSubmit(input: CreateJobInput) {
    await createJob({
      ...input,
      tags: parseTags(tagsText),
    });
    closeJob();
  }

  return (
    <Dialog open={isCreateOpen} onOpenChange={(open) => (!open ? closeJob() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add application</DialogTitle>
          <DialogDescription>Track a role in your local board.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-2">
            <Label htmlFor="new-title">Role</Label>
            <Input id="new-title" placeholder="Product Manager" {...register("title")} />
            {errors.title ? (
              <p className="text-xs text-destructive">{errors.title.message}</p>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="new-company">Company</Label>
            <Input id="new-company" placeholder="Acme" {...register("companyName")} />
            {errors.companyName ? (
              <p className="text-xs text-destructive">{errors.companyName.message}</p>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="new-columnId">Column</Label>
              <Select id="new-columnId" {...register("columnId")}>
                {columns.map((column) => (
                  <option key={column.id} value={column.id}>
                    {column.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-sourceId">Source</Label>
              <Select id="new-sourceId" {...register("sourceId")}>
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
            <Label htmlFor="new-link">Posting URL</Label>
            <Input id="new-link" placeholder="https://..." type="url" {...register("link")} />
            {errors.link ? <p className="text-xs text-destructive">{errors.link.message}</p> : null}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="new-location">Location</Label>
              <Input id="new-location" placeholder="New York, NY" {...register("location")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-tags">Tags</Label>
              <Input
                id="new-tags"
                onChange={(event) => setTagsText(event.target.value)}
                placeholder="frontend, remote"
                value={tagsText}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="new-notes">Notes</Label>
            <Textarea
              id="new-notes"
              placeholder="Next steps, reminders, links..."
              {...register("notes")}
            />
          </div>
          <div className="flex justify-end">
            <Button disabled={isSubmitting} type="submit">
              <Save />
              Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
