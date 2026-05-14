"use client";

import { useMemo } from "react";
import type { ComponentType, ReactNode } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  ChartNoAxesColumn,
  Tag,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";
import { JobDrawer } from "@/features/jobs/job-drawer";
import {
  calculateMetrics,
  type CountDatum,
  type MetricsSummary,
} from "@/features/metrics/metrics-utils";
import { formatRelativeTime } from "@/lib/dates";
import { useNow } from "@/lib/use-now";
import { useBoardData } from "@/lib/use-jobs";
import { cn } from "@/lib/utils";
import { useApplylineUiStore } from "@/store/applyline-ui-store";

type BarListProps = {
  emptyLabel: string;
  items: CountDatum[];
  neutral?: boolean;
};

const colorBarClass: Record<string, string> = {
  amber: "bg-amber-400",
  blue: "bg-blue-500",
  green: "bg-emerald-500",
  red: "bg-rose-500",
  slate: "bg-slate-400",
  teal: "bg-teal-500",
  violet: "bg-violet-500",
  zinc: "bg-zinc-400",
};

function BarList({ emptyLabel, items, neutral }: BarListProps) {
  const maxValue = Math.max(1, ...items.map((item) => item.value));

  return (
    <div className="grid gap-3">
      {items.length > 0 ? (
        items.map((item) => {
          const width = `${Math.max(4, (item.value / maxValue) * 100)}%`;
          const colorClass =
            !neutral && item.color
              ? (colorBarClass[item.color] ?? "bg-foreground/25")
              : "bg-foreground/25";

          return (
            <div className="grid gap-1.5" key={item.id}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate">{item.label}</span>
                <span className="font-medium tabular-nums">{item.value}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-secondary">
                <div className={cn("h-full rounded-full", colorClass)} style={{ width }} />
              </div>
            </div>
          );
        })
      ) : (
        <p className="rounded-md border border-dashed bg-background/55 p-3 text-sm text-muted-foreground">
          {emptyLabel}
        </p>
      )}
    </div>
  );
}

function Panel({
  children,
  count,
  icon: Icon,
  title,
}: {
  children: ReactNode;
  count?: number;
  icon: ComponentType<{ className?: string }>;
  title: string;
}) {
  return (
    <section className="grid gap-4 rounded-lg border bg-card p-4 shadow-[0_16px_36px_-34px_hsl(var(--foreground)/0.55)]">
      <div className="flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-md bg-secondary text-muted-foreground">
          <Icon className="size-4" />
        </span>
        <h2 className="text-sm font-semibold">{title}</h2>
        {count !== undefined && count > 0 ? (
          <span className="ml-auto rounded-sm border bg-background px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
            {count}
          </span>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function FunnelStep({
  count,
  dimmed,
  label,
  max,
  rate,
}: {
  count: number;
  dimmed?: boolean;
  label: string;
  max: number;
  rate?: number;
}) {
  const width = max > 0 ? `${Math.max(2, (count / max) * 100)}%` : "2%";

  return (
    <div className={cn("grid gap-1.5", dimmed && "opacity-40")}>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">
          {count}
          {rate !== undefined ? (
            <span className="ml-1.5 text-xs text-muted-foreground">({rate}%)</span>
          ) : null}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full bg-primary/65" style={{ width }} />
      </div>
    </div>
  );
}

function PipelinePanel({ metrics }: { metrics: MetricsSummary }) {
  const noApplied = metrics.appliedJobCount === 0;

  return (
    <section className="grid gap-4 rounded-lg border bg-card p-4 shadow-[0_16px_36px_-34px_hsl(var(--foreground)/0.55)]">
      <div className="flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-md bg-secondary text-muted-foreground">
          <TrendingUp className="size-4" />
        </span>
        <h2 className="text-sm font-semibold">Pipeline</h2>
        <span className="ml-auto text-xs text-muted-foreground">{metrics.totalJobs} tracked</span>
      </div>
      <div className="grid gap-3">
        <FunnelStep
          count={metrics.appliedJobCount}
          label="Applied"
          max={metrics.appliedJobCount}
        />
        <FunnelStep
          count={metrics.interviewJobCount}
          dimmed={noApplied}
          label="Interview"
          max={metrics.appliedJobCount}
          rate={noApplied ? undefined : metrics.interviewRate}
        />
        <FunnelStep
          count={metrics.offerJobCount}
          dimmed={noApplied}
          label="Offer"
          max={metrics.appliedJobCount}
          rate={noApplied ? undefined : metrics.offerRate}
        />
      </div>
    </section>
  );
}

function ActivityPanel({ metrics }: { metrics: MetricsSummary }) {
  const stats = [
    { label: "This week", value: metrics.applicationsThisWeek },
    { label: "This month", value: metrics.applicationsThisMonth },
    { label: "Rejections", value: metrics.rejectionCount },
    { label: "No response", value: metrics.noResponseCount },
  ];

  return (
    <section className="rounded-lg border bg-card p-4 shadow-[0_16px_36px_-34px_hsl(var(--foreground)/0.55)]">
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        {stats.map((stat, i) => (
          <div
            className={cn(
              "grid gap-1",
              i > 0 && "sm:border-l sm:pl-4",
            )}
            key={stat.label}
          >
            <p className="text-xs text-muted-foreground">{stat.label}</p>
            <p className="text-xl font-semibold tabular-nums">{stat.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function NeedsAttention({
  metrics,
  now,
  onOpenJob,
}: {
  metrics: MetricsSummary;
  now: Date;
  onOpenJob: (jobId: string) => void;
}) {
  return (
    <Panel
      count={metrics.needsAttention.length}
      icon={AlertCircle}
      title="Needs attention"
    >
      {metrics.needsAttention.length > 0 ? (
        <div className="overflow-hidden rounded-md border">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="border-b bg-secondary/45 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Job</th>
                <th className="px-3 py-2 font-medium">Company</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Last update</th>
                <th className="w-20 px-3 py-2 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {metrics.needsAttention.map((job) => (
                <tr className="border-b last:border-b-0 hover:bg-secondary/35" key={job.id}>
                  <td className="px-3 py-2 font-medium">{job.title}</td>
                  <td className="px-3 py-2 text-muted-foreground">{job.companyName}</td>
                  <td className="px-3 py-2 text-muted-foreground">{job.status}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {formatRelativeTime(job.lastUpdateAt, now)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button onClick={() => onOpenJob(job.id)} size="sm" variant="outline">
                      Open
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-md border border-dashed bg-background/55 p-4 text-sm text-muted-foreground">
          No Applied or Interview jobs have been quiet for 14+ days.
        </div>
      )}
    </Panel>
  );
}

export function MetricsPage() {
  const {
    activities,
    columns,
    companies,
    contacts,
    jobContacts,
    jobs,
    sources,
    isLoading,
    error,
  } = useBoardData();
  const activeJobId = useApplylineUiStore((state) => state.activeJobId);
  const openJob = useApplylineUiStore((state) => state.openJob);
  const now = useNow();
  const metrics = useMemo(
    () => calculateMetrics({ columns, jobs, sources }),
    [columns, jobs, sources],
  );
  const activeJob = jobs.find((job) => job.id === activeJobId) ?? null;

  if (error) {
    return (
      <div className="rounded-lg border bg-card p-5 text-sm text-destructive shadow-sm">
        {error.message}
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Metrics</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            How your job search is moving.
          </p>
        </div>
        <span className="text-sm text-muted-foreground">
          {isLoading ? "Loading..." : `${metrics.totalJobs} tracked jobs`}
        </span>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div className="h-32 animate-pulse rounded-lg border bg-muted/45" key={index} />
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <div className="grid min-h-80 place-items-center rounded-lg border border-dashed bg-card/70 p-8 text-center">
          <div className="grid place-items-center gap-3">
            <div className="grid size-11 place-items-center rounded-md bg-secondary">
              <ChartNoAxesColumn className="size-5 text-muted-foreground" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">No data yet</h2>
              <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                Metrics will appear here once you add job applications to your board.
              </p>
            </div>
            <Link className={buttonVariants({ variant: "outline" })} href="/">
              Go to Board
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <PipelinePanel metrics={metrics} />
            <ActivityPanel metrics={metrics} />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
            <Panel icon={ChartNoAxesColumn} title="Jobs by status">
              <BarList emptyLabel="No jobs yet." items={metrics.jobsByColumn} />
            </Panel>
            <div className="grid gap-4">
              <Panel icon={ArrowUpRight} title="Top sources">
                <BarList emptyLabel="No source data yet." items={metrics.topSources} neutral />
              </Panel>
              <Panel icon={Tag} title="Top tags">
                <BarList emptyLabel="No tags yet." items={metrics.topTags} neutral />
              </Panel>
            </div>
          </div>

          <NeedsAttention metrics={metrics} now={now} onOpenJob={openJob} />
        </>
      )}

      <JobDrawer
        activities={activities}
        columns={columns}
        companies={companies}
        contacts={contacts}
        job={activeJob}
        jobContacts={jobContacts}
        jobs={jobs}
        sources={sources}
      />
    </div>
  );
}
