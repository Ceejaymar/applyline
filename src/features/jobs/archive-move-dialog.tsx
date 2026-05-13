"use client";

import { useState } from "react";
import { Archive } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { ArchivedReason } from "@/lib/schemas";
import type { BoardJob } from "@/lib/use-jobs";

type ArchiveMoveDialogProps = {
  job: BoardJob | null;
  onCancel: () => void;
  onConfirm: (archivedReason?: ArchivedReason) => Promise<void>;
  open: boolean;
};

const archivedReasonOptions: Array<{ label: string; value: ArchivedReason }> = [
  { label: "Expired", value: "expired" },
  { label: "Deleted posting", value: "deleted" },
  { label: "Role filled", value: "role_filled" },
  { label: "Not interested", value: "not_interested" },
  { label: "Other", value: "other" },
];

export function ArchiveMoveDialog({
  job,
  onCancel,
  onConfirm,
  open,
}: ArchiveMoveDialogProps) {
  const [archivedReason, setArchivedReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function confirm() {
    try {
      setIsSubmitting(true);
      await onConfirm((archivedReason || undefined) as ArchivedReason | undefined);
      setArchivedReason("");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setArchivedReason("");
          onCancel();
        }
      }}
    >
      <DialogContent className="w-[420px]">
        <DialogHeader>
          <DialogTitle>Archive application?</DialogTitle>
          <DialogDescription>
            {job ? `Move ${job.title} to Archived / Expired / Deleted.` : null}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="archived-reason">Reason</Label>
            <Select
              id="archived-reason"
              onChange={(event) => setArchivedReason(event.target.value)}
              value={archivedReason}
            >
              <option value="">No reason</option>
              {archivedReasonOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button onClick={onCancel} variant="outline">
              Cancel
            </Button>
            <Button disabled={isSubmitting} onClick={confirm}>
              <Archive />
              Archive
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
