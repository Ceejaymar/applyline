"use client";

import { Plus, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { Source } from "@/lib/schemas";

type BoardToolbarProps = {
  computedFilter: string;
  jobCount: number;
  onComputedFilterChange: (value: string) => void;
  onCreateColumn: () => void;
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
  computedFilter,
  jobCount,
  onComputedFilterChange,
  onCreateColumn,
  onSearchChange,
  onSourceChange,
  onTagChange,
  search,
  selectedSource,
  selectedTag,
  sources,
  tags,
}: BoardToolbarProps) {
  const hasFilters = Boolean(search || selectedSource || selectedTag || computedFilter);

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
          <Select
            aria-label="Computed filters"
            className="w-full sm:w-44"
            onChange={(event) => onComputedFilterChange(event.target.value)}
            value={computedFilter}
          >
            <option value="">All activity</option>
            <option value="no-update-14-days">No update 14+ days</option>
          </Select>
          {hasFilters ? (
            <Button
              aria-label="Clear filters"
              onClick={() => {
                onSearchChange("");
                onSourceChange("");
                onTagChange("");
                onComputedFilterChange("");
              }}
              size="icon"
              title="Clear filters"
              variant="outline"
            >
              <X />
            </Button>
          ) : null}
          <Button onClick={onCreateColumn}>
            <Plus />
            Column
          </Button>
        </div>
      </div>
    </div>
  );
}
