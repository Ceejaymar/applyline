"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, MoreHorizontal, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select } from "@/components/ui/select";
import { ColumnEditDialog } from "@/features/jobs/column-dialog";
import { deleteColumn, reorderColumn } from "@/lib/db";
import type { Column } from "@/lib/schemas";

type ColumnMenuProps = {
  column: Column;
  columns: Column[];
  jobCount: number;
};

export function ColumnMenu({ column, columns, jobCount }: ColumnMenuProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [migrationTarget, setMigrationTarget] = useState("");
  const [error, setError] = useState<string | null>(null);
  const columnIndex = columns.findIndex((nextColumn) => nextColumn.id === column.id);
  const migrationColumns = columns.filter((nextColumn) => nextColumn.id !== column.id);

  async function onDelete() {
    try {
      await deleteColumn(column.id, jobCount > 0 ? migrationTarget : undefined);
      setIsConfirmingDelete(false);
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Column could not be deleted.");
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label={`Open menu for ${column.name}`}
            className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
            size="icon"
            title="Column menu"
            variant="ghost"
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => setIsEditing(true)}>
            <Pencil />
            Edit column
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={columnIndex <= 0}
            onClick={() => reorderColumn(column.id, "left")}
          >
            <ArrowLeft />
            Move left
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={columnIndex === -1 || columnIndex >= columns.length - 1}
            onClick={() => reorderColumn(column.id, "right")}
          >
            <ArrowRight />
            Move right
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => {
              setMigrationTarget("");
              setError(null);
              setIsConfirmingDelete(true);
            }}
          >
            <Trash2 />
            Delete column
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog onOpenChange={setIsConfirmingDelete} open={isConfirmingDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete &ldquo;{column.name}&rdquo;?</DialogTitle>
            <DialogDescription>
              {jobCount > 0
                ? `This column has ${jobCount} job${jobCount === 1 ? "" : "s"}. Choose where to move them before deleting.`
                : "This cannot be undone."}
            </DialogDescription>
          </DialogHeader>
          {jobCount > 0 ? (
            <Select
              aria-label="Move jobs to column"
              onChange={(event) => setMigrationTarget(event.target.value)}
              value={migrationTarget}
            >
              <option value="">Move jobs to...</option>
              {migrationColumns.map((nextColumn) => (
                <option key={nextColumn.id} value={nextColumn.id}>
                  {nextColumn.name}
                </option>
              ))}
            </Select>
          ) : null}
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button onClick={() => setIsConfirmingDelete(false)} variant="ghost">
              Cancel
            </Button>
            <Button
              disabled={jobCount > 0 && !migrationTarget}
              onClick={onDelete}
              variant="destructive"
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ColumnEditDialog column={column} open={isEditing} onOpenChange={setIsEditing} />
    </>
  );
}
