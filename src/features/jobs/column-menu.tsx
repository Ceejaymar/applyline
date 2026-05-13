"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
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
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [migrationTarget, setMigrationTarget] = useState("");
  const [error, setError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const columnIndex = columns.findIndex((nextColumn) => nextColumn.id === column.id);
  const migrationColumns = columns.filter((nextColumn) => nextColumn.id !== column.id);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);

    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  async function onDelete() {
    try {
      await deleteColumn(column.id, jobCount > 0 ? migrationTarget : undefined);
      setIsOpen(false);
      setIsDeleting(false);
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Column could not be deleted.");
    }
  }

  return (
    <div className="relative shrink-0" ref={menuRef}>
      <Button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={`Open menu for ${column.name}`}
        className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
        onClick={() => setIsOpen((nextIsOpen) => !nextIsOpen)}
        size="icon"
        title="Column menu"
        variant="ghost"
      >
        <span className="text-lg leading-none">...</span>
      </Button>
      {isOpen ? (
        <div
          className="absolute right-0 top-9 z-20 grid w-64 gap-2 rounded-md border bg-popover p-2 text-popover-foreground shadow-soft"
          role="menu"
        >
          <Button
            className="justify-start"
            onClick={() => {
              setIsEditing(true);
              setIsOpen(false);
            }}
            size="sm"
            variant="ghost"
          >
            <Pencil />
            Edit column
          </Button>
          <div className="grid grid-cols-2 gap-1">
            <Button
              disabled={columnIndex <= 0}
              onClick={() => reorderColumn(column.id, "left")}
              size="sm"
              variant="ghost"
            >
              <ArrowLeft />
              Left
            </Button>
            <Button
              disabled={columnIndex === -1 || columnIndex >= columns.length - 1}
              onClick={() => reorderColumn(column.id, "right")}
              size="sm"
              variant="ghost"
            >
              Right
              <ArrowRight />
            </Button>
          </div>
          {isDeleting ? (
            <div className="grid gap-2 rounded-md border bg-secondary/45 p-2">
              {jobCount > 0 ? (
                <Select
                  aria-label="Move jobs to column"
                  className="h-8"
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
              <div className="flex justify-end gap-1">
                <Button onClick={() => setIsDeleting(false)} size="sm" variant="ghost">
                  Cancel
                </Button>
                <Button
                  disabled={jobCount > 0 && !migrationTarget}
                  onClick={onDelete}
                  size="sm"
                  variant="destructive"
                >
                  Delete
                </Button>
              </div>
            </div>
          ) : (
            <Button
              className="justify-start text-destructive hover:text-destructive"
              onClick={() => setIsDeleting(true)}
              size="sm"
              variant="ghost"
            >
              <Trash2 />
              Delete
            </Button>
          )}
          {error ? <p className="px-1 text-xs text-destructive">{error}</p> : null}
        </div>
      ) : null}
      <ColumnEditDialog column={column} open={isEditing} onOpenChange={setIsEditing} />
    </div>
  );
}
