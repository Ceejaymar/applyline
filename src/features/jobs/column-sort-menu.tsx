"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDownWideNarrow, ArrowUpWideNarrow, Check, ListOrdered } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { JobSortMode } from "@/features/jobs/job-helpers";
import { cn } from "@/lib/utils";

type ColumnSortMenuProps = {
  columnName: string;
  onSortChange: (sort: JobSortMode) => void;
  sort: JobSortMode;
};

const sortOptions: Array<{
  icon: typeof ArrowDownWideNarrow;
  label: string;
  value: JobSortMode;
}> = [
  { icon: ArrowDownWideNarrow, label: "Latest first", value: "latest" },
  { icon: ArrowUpWideNarrow, label: "Oldest first", value: "oldest" },
  { icon: ListOrdered, label: "Manual order", value: "manual" },
];

export function ColumnSortMenu({ columnName, onSortChange, sort }: ColumnSortMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const activeOption = sortOptions.find((option) => option.value === sort) ?? sortOptions[0];
  const ActiveIcon = activeOption.icon;

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);

    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  return (
    <div className="relative shrink-0" ref={menuRef}>
      <Button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={`Sort ${columnName}: ${activeOption.label}`}
        className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
        onClick={() => setIsOpen((nextIsOpen) => !nextIsOpen)}
        size="icon"
        title={`Sort: ${activeOption.label}`}
        variant="ghost"
      >
        <ActiveIcon className="size-3.5" />
      </Button>
      {isOpen ? (
        <div
          className="absolute right-0 top-9 z-20 grid w-44 gap-1 rounded-md border bg-popover p-1.5 text-popover-foreground shadow-soft"
          role="menu"
        >
          {sortOptions.map((option) => {
            const Icon = option.icon;
            const isSelected = option.value === sort;

            return (
              <Button
                aria-checked={isSelected}
                className={cn(
                  "h-8 justify-start px-2 text-xs",
                  isSelected && "bg-secondary text-secondary-foreground",
                )}
                key={option.value}
                onClick={() => {
                  onSortChange(option.value);
                  setIsOpen(false);
                }}
                role="menuitemradio"
                size="sm"
                variant="ghost"
              >
                <Icon className="size-3.5" />
                <span className="min-w-0 flex-1 truncate text-left">{option.label}</span>
                {isSelected ? <Check className="size-3.5" /> : null}
              </Button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
