"use client";

import { AlertTriangle, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { BoardJob } from "@/lib/use-jobs";

type DuplicateJobWarningProps = {
  duplicateJob: BoardJob;
  onContinue: () => void;
  onOpenExisting: () => void;
};

export function DuplicateJobWarning({
  duplicateJob,
  onContinue,
  onOpenExisting,
}: DuplicateJobWarningProps) {
  return (
    <div className="grid gap-3 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
      <div className="flex gap-2">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
        <div className="min-w-0">
          <p className="font-medium">Possible duplicate job</p>
          <p className="mt-1 text-muted-foreground">
            {duplicateJob.companyName} · {duplicateJob.title} · {duplicateJob.columnName}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button onClick={onOpenExisting} size="sm" variant="outline">
          <ExternalLink />
          Open existing
        </Button>
        <Button onClick={onContinue} size="sm" variant="outline">
          Continue anyway
        </Button>
      </div>
    </div>
  );
}
