"use client";

import { useState } from "react";
import { Filter, Plus, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { createColumn } from "@/lib/db";
import type { Source } from "@/lib/schemas";
import { cn } from "@/lib/utils";

type BoardToolbarProps = {
  jobCount: number;
  onSearchChange: (value: string) => void;
  onSourceChange: (value: string) => void;
  onTagChange: (value: string) => void;
  search: string;
  selectedSource: string;
  selectedTag: string;
  sources: Source[];
  tags: string[];
};

export function BoardToolbar({
  jobCount,
  onSearchChange,
  onSourceChange,
  onTagChange,
  search,
  selectedSource,
  selectedTag,
  sources,
  tags,
}: BoardToolbarProps) {
  const [isCreatingColumn, setIsCreatingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onCreateColumn() {
    const name = newColumnName.trim();

    if (!name) {
      setIsCreatingColumn(true);
      return;
    }

    try {
      await createColumn(name);
      setNewColumnName("");
      setIsCreatingColumn(false);
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Column could not be created.");
    }
  }

  const hasFilters = Boolean(search || selectedSource || selectedTag);

  return (
    <div className="grid gap-4">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Board</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {jobCount === 1 ? "1 application in motion" : `${jobCount} applications in motion`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Search applications"
              className="pl-9"
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search jobs or companies"
              value={search}
            />
          </div>
          <Select
            aria-label="Filter by tag"
            className="w-full sm:w-40"
            onChange={(event) => onTagChange(event.target.value)}
            value={selectedTag}
          >
            <option value="">All tags</option>
            {tags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Filter by source"
            className="w-full sm:w-44"
            onChange={(event) => onSourceChange(event.target.value)}
            value={selectedSource}
          >
            <option value="">All sources</option>
            {sources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.name}
              </option>
            ))}
          </Select>
          {hasFilters ? (
            <Button
              aria-label="Clear filters"
              onClick={() => {
                onSearchChange("");
                onSourceChange("");
                onTagChange("");
              }}
              size="icon"
              title="Clear filters"
              variant="outline"
            >
              <X />
            </Button>
          ) : (
            <Button aria-label="Filters" disabled size="icon" title="Filters" variant="outline">
              <Filter />
            </Button>
          )}
          <div
            className={cn(
              "flex items-center gap-2",
              isCreatingColumn && "rounded-md border bg-card p-1 shadow-sm",
            )}
          >
            {isCreatingColumn ? (
              <Input
                aria-label="New column name"
                autoFocus
                className="h-8 w-44"
                onChange={(event) => setNewColumnName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void onCreateColumn();
                  }

                  if (event.key === "Escape") {
                    setIsCreatingColumn(false);
                    setNewColumnName("");
                  }
                }}
                placeholder="Column name"
                value={newColumnName}
              />
            ) : null}
            <Button onClick={onCreateColumn} size={isCreatingColumn ? "sm" : "default"}>
              <Plus />
              Column
            </Button>
          </div>
        </div>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
