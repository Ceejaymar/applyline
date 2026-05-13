"use client";

import { useEffect, useId, useState } from "react";
import { Save } from "lucide-react";

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
import {
  boardIconOptions,
  columnColorOptions,
  columnTint,
  getBoardIcon,
} from "@/features/jobs/board-icons";
import { createColumn, updateColumn } from "@/lib/db";
import type { Column } from "@/lib/schemas";
import { cn } from "@/lib/utils";

type ColumnFormState = {
  color: string;
  icon: string;
  name: string;
};

type ColumnDialogShellProps = {
  description: string;
  initialValues: ColumnFormState;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: ColumnFormState) => Promise<void>;
  open: boolean;
  submitLabel: string;
  title: string;
};

const defaultColumnValues: ColumnFormState = {
  color: "violet",
  icon: "list-plus",
  name: "",
};

function ColumnDialogShell({
  description,
  initialValues,
  onOpenChange,
  onSubmit,
  open,
  submitLabel,
  title,
}: ColumnDialogShellProps) {
  const id = useId();
  const [values, setValues] = useState<ColumnFormState>(initialValues);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const PreviewIcon = getBoardIcon(values.icon);
  const tintClass = columnTint[values.color] ?? columnTint.violet;

  useEffect(() => {
    if (open) {
      setValues(initialValues);
      setError(null);
    }
  }, [initialValues, open]);

  async function submit() {
    if (!values.name.trim()) {
      setError("Column name is required.");
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmit({
        ...values,
        name: values.name.trim(),
      });
      onOpenChange(false);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Column could not be saved.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[440px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-5">
          <div className="flex items-center gap-3 rounded-md border bg-background/55 p-3">
            <span className={cn("grid size-10 place-items-center rounded-md border", tintClass)}>
              <PreviewIcon className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{values.name || "Column name"}</p>
              <p className="text-xs text-muted-foreground">
                {boardIconOptions.find((option) => option.value === values.icon)?.label} icon
              </p>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`${id}-name`}>Name</Label>
            <Input
              autoFocus
              id={`${id}-name`}
              onChange={(event) =>
                setValues((current) => ({ ...current, name: event.target.value }))
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void submit();
                }
              }}
              placeholder="Follow up"
              value={values.name}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`${id}-icon`}>Icon</Label>
            <Select
              id={`${id}-icon`}
              onChange={(event) =>
                setValues((current) => ({ ...current, icon: event.target.value }))
              }
              value={values.icon}
            >
              {boardIconOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Accent color</Label>
            <div className="grid grid-cols-4 gap-2">
              {columnColorOptions.map((option) => (
                <button
                  aria-label={`${option.label} accent`}
                  aria-pressed={values.color === option.value}
                  className={cn(
                    "flex items-center gap-2 rounded-md border bg-background px-2 py-2 text-xs transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    values.color === option.value && "border-primary bg-primary/5",
                  )}
                  key={option.value}
                  onClick={() =>
                    setValues((current) => ({ ...current, color: option.value }))
                  }
                  type="button"
                >
                  <span className={cn("size-3 rounded-full", option.className)} />
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="flex justify-end border-t pt-4">
            <Button disabled={isSubmitting} onClick={submit}>
              <Save />
              {submitLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ColumnCreateDialog({
  onOpenChange,
  open,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  return (
    <ColumnDialogShell
      description="Add a stage that matches the way you track applications."
      initialValues={defaultColumnValues}
      onOpenChange={onOpenChange}
      onSubmit={async (values) => {
        await createColumn(values);
      }}
      open={open}
      submitLabel="Create column"
      title="Create column"
    />
  );
}

export function ColumnEditDialog({
  column,
  onOpenChange,
  open,
}: {
  column: Column;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  return (
    <ColumnDialogShell
      description="Update the column label, icon, and accent color."
      initialValues={{
        color: column.color ?? "violet",
        icon: column.icon ?? "list-plus",
        name: column.name,
      }}
      onOpenChange={onOpenChange}
      onSubmit={(values) => updateColumn(column.id, values)}
      open={open}
      submitLabel="Save column"
      title="Edit column"
    />
  );
}
