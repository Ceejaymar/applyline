"use client";

import { useMemo } from "react";
import type { ComponentType, ReactNode } from "react";
import {
  Activity,
  AlertCircle,
  CalendarDays,
  ChartNoAxesColumn,
  Target,
  Timer,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { JobDrawer } from "@/features/jobs/job-drawer";
import {
  calculateMetrics,
  type MetricsSummary,
  type SourceConversionDatum,
  type WeeklyDatum,
} from "@/features/metrics/metrics-utils";
import { formatRelativeTime } from "@/lib/dates";
import { useNow } from "@/lib/use-now";
import { useBoardData } from "@/lib/use-jobs";
import { cn } from "@/lib/utils";
import { useApplylineUiStore } from "@/store/applyline-ui-store";

// ---------------------------------------------------------------------------
// Shared panel shell
// ---------------------------------------------------------------------------

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
    <section className="grid gap-4 rounded-lg border bg-card p-4 shadow-[0_10px_28px_-24px_hsl(var(--foreground)/0.6)]">
      <div className="flex items-center gap-2">
        <span className="grid size-8 shrink-0 place-items-center rounded-md bg-secondary text-muted-foreground">
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

// ---------------------------------------------------------------------------
// Band 1 — Weekly activity chart
// ---------------------------------------------------------------------------

function WeeklyChart({ data }: { data: WeeklyDatum[] }) {
  const maxCount = Math.max(1, ...data.map((d) => d.count));

  return (
    <section className="grid gap-4 rounded-lg border bg-card p-4 shadow-[0_10px_28px_-24px_hsl(var(--foreground)/0.6)]">
      <div className="flex items-center gap-2">
        <span className="grid size-8 shrink-0 place-items-center rounded-md bg-secondary text-muted-foreground">
          <CalendarDays className="size-4" />
        </span>
        <h2 className="text-sm font-semibold">Weekly applications</h2>
        <span className="ml-auto text-xs text-muted-foreground">last 12 weeks</span>
      </div>
      <div className="flex items-end gap-1" style={{ height: "6rem" }}>
        {data.map((week) => {
          const isEmpty = week.count === 0;
          const heightPct = isEmpty ? 4 : Math.max(8, (week.count / maxCount) * 100);
          return (
            <div
              className="group relative flex flex-1 flex-col justify-end"
              key={week.weekStart}
              style={{ height: "100%" }}
              title={`${week.weekLabel}: ${week.count} application${week.count === 1 ? "" : "s"}`}
            >
              <div
                className={cn(
                  "w-full rounded-sm transition-colors duration-100",
                  isEmpty
                    ? "bg-secondary"
                    : "bg-primary/55 group-hover:bg-primary/80",
                )}
                style={{ height: `${heightPct}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{data[0]?.weekLabel}</span>
        <span>{data[Math.floor(data.length / 2)]?.weekLabel}</span>
        <span>{data[data.length - 1]?.weekLabel}</span>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Band 1 — Response breakdown (replaces the broken ActivityPanel)
// ---------------------------------------------------------------------------

function ResponseStats({ metrics }: { metrics: MetricsSummary }) {
  const respondedCount = metrics.interviewJobCount + metrics.offerJobCount + metrics.rejectionCount;

  const stats = [
    {
      label: "Applied",
      value: metrics.appliedJobCount,
      sub: null,
    },
    {
      label: "Responded",
      value: respondedCount,
      sub: metrics.appliedJobCount > 0 ? `${metrics.responseRate}%` : null,
    },
    {
      label: "Pending",
      value: metrics.pendingCount,
      sub: null,
    },
    {
      label: "Silent",
      value: metrics.noResponseCount,
      sub: null,
    },
  ];

  return (
    <section className="grid gap-4 rounded-lg border bg-card p-4 shadow-[0_10px_28px_-24px_hsl(var(--foreground)/0.6)]">
      <div className="flex items-center gap-2">
        <span className="grid size-8 shrink-0 place-items-center rounded-md bg-secondary text-muted-foreground">
          <Activity className="size-4" />
        </span>
        <h2 className="text-sm font-semibold">Breakdown</h2>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-5">
        {stats.map((stat) => (
          <div className="grid gap-0.5" key={stat.label}>
            <p className="text-xs text-muted-foreground">{stat.label}</p>
            <p className="text-xl font-semibold tabular-nums">{stat.value}</p>
            {stat.sub ? (
              <p className="text-[11px] text-muted-foreground">{stat.sub} response rate</p>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Band 2 — Pipeline funnel
// ---------------------------------------------------------------------------

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
      <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full bg-primary/65" style={{ width }} />
      </div>
    </div>
  );
}

function PipelinePanel({ metrics }: { metrics: MetricsSummary }) {
  const noApplied = metrics.appliedJobCount === 0;

  return (
    <section className="grid gap-4 rounded-lg border bg-card p-4 shadow-[0_10px_28px_-24px_hsl(var(--foreground)/0.6)]">
      <div className="flex items-center gap-2">
        <span className="grid size-8 shrink-0 place-items-center rounded-md bg-secondary text-muted-foreground">
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

// ---------------------------------------------------------------------------
// Band 2 — Source conversion quality
// ---------------------------------------------------------------------------

function SourceConversionPanel({ items }: { items: SourceConversionDatum[] }) {
  return (
    <Panel icon={Target} title="Source quality">
      {items.length > 0 ? (
        <div className="grid gap-0">
          <div className="flex items-center gap-3 pb-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
            <span className="min-w-0 flex-1">Source</span>
            <span className="w-8 shrink-0 text-right tabular-nums">Apps</span>
            <span className="w-14 shrink-0 text-right">Int. rate</span>
          </div>
          {items.map((source) => (
            <div
              className="flex items-center gap-3 border-t py-2 text-sm first:border-t-0"
              key={source.id}
            >
              <span className="min-w-0 flex-1 truncate">{source.label}</span>
              <span className="w-8 shrink-0 text-right tabular-nums text-muted-foreground">
                {source.applied}
              </span>
              <span
                className={cn(
                  "w-14 shrink-0 text-right tabular-nums font-medium",
                  source.interviewRate === null
                    ? "text-muted-foreground"
                    : source.interviewRate > 0
                      ? "text-foreground"
                      : "text-muted-foreground",
                )}
              >
                {source.interviewRate !== null ? `${source.interviewRate}%` : "—"}
              </span>
            </div>
          ))}
          <p className="mt-2 text-[10px] text-muted-foreground/70">
            Rate shown for sources with 3+ applications.
          </p>
        </div>
      ) : (
        <p className="rounded-md border border-dashed bg-background/55 p-3 text-sm text-muted-foreground">
          No source data yet.
        </p>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Band 3 — Velocity strip
// ---------------------------------------------------------------------------

function VelocityStrip({ metrics }: { metrics: MetricsSummary }) {
  const stats = [
    {
      label: "Avg days to any response",
      value: metrics.avgDaysToFirstResponse,
      suffix: "d",
    },
    {
      label: "Avg days in current stage",
      value: metrics.averageDaysInCurrentStatus,
      suffix: "d",
    },
    {
      label: "Avg days to interview",
      value: metrics.avgDaysToInterview,
      suffix: "d",
    },
  ];

  return (
    <section className="rounded-lg border bg-card shadow-[0_10px_28px_-24px_hsl(var(--foreground)/0.6)]">
      <div className="flex items-stretch divide-x">
        {stats.map((stat) => (
          <div className="grid flex-1 gap-1 px-4 py-3.5" key={stat.label}>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Timer className="size-3 shrink-0" />
              {stat.label}
            </div>
            <p className="text-lg font-semibold tabular-nums">
              {stat.value !== null && stat.value !== undefined
                ? `${stat.value}${stat.suffix}`
                : "—"}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Band 4 — Needs attention
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

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
    () => calculateMetrics({ columns, jobs, now, sources }),
    [columns, jobs, now, sources],
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
          <h1 className="text-lg font-semibold tracking-normal">Metrics</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            How your job search is moving.
          </p>
        </div>
        <span className="text-sm text-muted-foreground">
          {isLoading ? "Loading..." : `${metrics.totalJobs} tracked jobs`}
        </span>
      </div>

      {isLoading ? (
        <div className="grid gap-3">
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="h-44 animate-pulse rounded-lg border bg-muted/45" />
            <div className="h-44 animate-pulse rounded-lg border bg-muted/45" />
          </div>
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            <div className="h-40 animate-pulse rounded-lg border bg-muted/45" />
            <div className="h-40 animate-pulse rounded-lg border bg-muted/45" />
          </div>
          <div className="h-16 animate-pulse rounded-lg border bg-muted/45" />
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
          {/* Band 1: pace */}
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <WeeklyChart data={metrics.weeklyActivity} />
            <ResponseStats metrics={metrics} />
          </div>

          {/* Band 2: conversion */}
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            <PipelinePanel metrics={metrics} />
            <SourceConversionPanel items={metrics.sourceConversion} />
          </div>

          {/* Band 3: velocity */}
          <VelocityStrip metrics={metrics} />

          {/* Band 4: needs attention */}
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
