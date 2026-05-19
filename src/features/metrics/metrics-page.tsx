"use client";

import { useMemo, useState } from "react";
import type { ComponentType, CSSProperties, ReactNode } from "react";
import {
  Activity,
  AlertCircle,
  CalendarDays,
  ChartNoAxesColumn,
  ChevronRight,
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
import {
  calculatePipelineMetrics,
  type PipelineMetrics,
} from "@/lib/pipeline-metrics";
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
    <section className="grid gap-4 rounded-lg border bg-card p-4 shadow-sm">
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
    <section className="grid gap-4 rounded-lg border bg-card p-4 shadow-sm">
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
    <section className="grid gap-4 rounded-lg border bg-card p-4 shadow-sm">
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
  barClass = "bg-primary/55",
  count,
  dimmed,
  label,
  max,
  rate,
}: {
  barClass?: string;
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
        <div className={cn("h-full rounded-full", barClass)} style={{ width }} />
      </div>
    </div>
  );
}

function PipelinePanel({
  metrics,
  onViewPipeline,
}: {
  metrics: MetricsSummary;
  onViewPipeline?: () => void;
}) {
  const noApplied = metrics.appliedJobCount === 0;

  return (
    <section className="grid gap-4 rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="grid size-8 shrink-0 place-items-center rounded-md bg-secondary text-muted-foreground">
          <TrendingUp className="size-4" />
        </span>
        <h2 className="text-sm font-semibold">Pipeline</h2>
        <span className="ml-auto text-xs text-muted-foreground">{metrics.totalJobs} tracked</span>
      </div>
      <div className="grid gap-3">
        <FunnelStep
          barClass="bg-teal-500/50"
          count={metrics.appliedJobCount}
          label="Applied"
          max={metrics.appliedJobCount}
        />
        <FunnelStep
          barClass="bg-blue-500/50"
          count={metrics.interviewJobCount}
          dimmed={noApplied}
          label="Interview"
          max={metrics.appliedJobCount}
          rate={noApplied ? undefined : metrics.interviewRate}
        />
        <FunnelStep
          barClass="bg-emerald-500/50"
          count={metrics.offerJobCount}
          dimmed={noApplied}
          label="Offer"
          max={metrics.appliedJobCount}
          rate={noApplied ? undefined : metrics.offerRate}
        />
        <hr className="border-border" />
        <FunnelStep
          barClass="bg-rose-500/45"
          count={metrics.rejectionCount}
          dimmed={noApplied}
          label="Rejected"
          max={metrics.appliedJobCount}
        />
        <FunnelStep
          barClass="bg-amber-500/45"
          count={metrics.noResponseCount}
          dimmed={noApplied}
          label="No Response"
          max={metrics.appliedJobCount}
        />
      </div>
      {onViewPipeline ? (
        <div className="border-t pt-3">
          <button
            className="flex items-center gap-0.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            onClick={onViewPipeline}
            type="button"
          >
            View full pipeline
            <ChevronRight className="size-3" />
          </button>
        </div>
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Pipeline view — graph / tree visualization
// ---------------------------------------------------------------------------

const PIPELINE_DOT: Record<string, string> = {
  amber: "bg-amber-500",
  blue: "bg-blue-500",
  green: "bg-emerald-500",
  red: "bg-rose-500",
  slate: "bg-slate-400",
  teal: "bg-teal-500",
  violet: "bg-violet-500",
  zinc: "bg-zinc-400",
};

const NODE_BORDER: Record<string, string> = {
  amber: "border-amber-500/45",
  blue: "border-blue-500/45",
  green: "border-emerald-500/45",
  red: "border-rose-500/45",
  slate: "border-slate-400/35",
  teal: "border-teal-500/45",
  violet: "border-violet-500/45",
  zinc: "border-zinc-400/35",
};

const EDGE_STROKE: Record<string, string> = {
  amber: "text-amber-500",
  blue: "text-blue-500",
  green: "text-emerald-500",
  red: "text-rose-500",
  slate: "text-slate-400",
  teal: "text-teal-500",
  violet: "text-violet-500",
  zinc: "text-zinc-400",
};

function pipelineDot(color?: string) {
  return PIPELINE_DOT[color ?? ""] ?? "bg-muted-foreground/50";
}

function nodeBorderClass(color?: string) {
  return NODE_BORDER[color ?? ""] ?? "border-border";
}

function edgeStrokeClass(color?: string) {
  return EDGE_STROKE[color ?? ""] ?? "text-foreground/50";
}

const VIEW_W = 880;
const VIEW_H = 500;
const NODE_W = { applied: 170, regular: 150, offer: 140 };

const NODE_POS = {
  applied: { cx: 110, cy: 250 },
  pending: { cx: 440, cy: 60 },
  interview: { cx: 440, cy: 160 },
  noResponse: { cx: 440, cy: 250 },
  rejected: { cx: 440, cy: 340 },
  archived: { cx: 440, cy: 440 },
  offer: { cx: 730, cy: 160 },
};

function curvePath(fx: number, fy: number, tx: number, ty: number): string {
  const midX = (fx + tx) / 2;
  return `M ${fx} ${fy} C ${midX} ${fy}, ${midX} ${ty}, ${tx} ${ty}`;
}

const PIPELINE_GRAPH_CSS = `
@keyframes pl-node-in {
  from { opacity: 0; transform: translate(-50%, -50%) scale(0.94); }
  to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
}
@keyframes pl-edge-in {
  from { stroke-dashoffset: 1; }
  to { stroke-dashoffset: 0; }
}
@keyframes pl-pulse {
  0%, 100% { box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05), 0 0 0 0 hsl(var(--primary) / 0); }
  50% { box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05), 0 0 26px 0 hsl(var(--primary) / 0.18); }
}
@media (prefers-reduced-motion: no-preference) {
  .pl-node {
    opacity: 0;
    animation: pl-node-in 620ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
  }
  .pl-node.pl-pulse {
    animation: pl-node-in 620ms cubic-bezier(0.22, 1, 0.36, 1) forwards, pl-pulse 5s ease-in-out infinite;
  }
  .pl-edge {
    stroke-dasharray: 1;
    stroke-dashoffset: 1;
    animation: pl-edge-in 900ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
  }
}
`;

type GraphNodeData = {
  id: string;
  label: string;
  count: number;
  percent: number | null;
  color?: string;
  cx: number;
  cy: number;
  emphasized?: boolean;
};

type GraphEdgeData = {
  fx: number;
  fy: number;
  tx: number;
  ty: number;
  count: number;
  color?: string;
  delay: number;
};

function PipelineGraphNode({ delay, node }: { delay: number; node: GraphNodeData }) {
  const ariaLabel = `${node.label}, ${node.count} ${node.count === 1 ? "job" : "jobs"}${
    node.percent !== null ? `, ${node.percent} percent of applied` : ""
  }`;
  const delayStyle = node.emphasized
    ? `${delay}ms, ${delay + 1800}ms`
    : `${delay}ms`;
  return (
    <div
      aria-label={ariaLabel}
      className={cn(
        "pl-node absolute -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-card text-center shadow-sm",
        nodeBorderClass(node.color),
        node.emphasized ? "pl-pulse px-5 py-3.5" : "px-4 py-2.5",
      )}
      role="group"
      style={{
        left: `${(node.cx / VIEW_W) * 100}%`,
        top: `${(node.cy / VIEW_H) * 100}%`,
        animationDelay: delayStyle,
      }}
    >
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{node.label}</p>
      <p
        className={cn(
          "mt-1 font-semibold tabular-nums leading-none",
          node.emphasized ? "text-2xl xl:text-[1.75rem]" : "text-lg",
        )}
      >
        {node.count}
      </p>
      {node.percent !== null ? (
        <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">{node.percent}%</p>
      ) : null}
    </div>
  );
}

function PipelineGraphConnector({
  applied,
  edge,
}: {
  applied: number;
  edge: GraphEdgeData;
}) {
  const ratio = applied === 0 ? 0 : Math.min(1, edge.count / applied);
  const strokeWidth = 1.5 + ratio * 4;
  const opacity = 0.22 + ratio * 0.55;
  return (
    <g className={edgeStrokeClass(edge.color)}>
      <path
        className="pl-edge"
        d={curvePath(edge.fx, edge.fy, edge.tx, edge.ty)}
        fill="none"
        opacity={opacity}
        pathLength={1}
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth={strokeWidth}
        style={{ animationDelay: `${edge.delay}ms` }}
      />
    </g>
  );
}

function PipelineGraph({ pipeline }: { pipeline: PipelineMetrics }) {
  const [appliedStage, interviewStage, offerStage] = pipeline.funnelStages;
  const [rejectedOut, noResponseOut, archivedOut] = pipeline.outcomes;
  const applied = pipeline.appliedCount;
  const pct = (n: number) => (applied === 0 ? null : Math.round((n / applied) * 100));

  const nodes: GraphNodeData[] = [
    {
      id: "applied",
      label: "Applied",
      count: applied,
      percent: applied === 0 ? null : 100,
      color: appliedStage.color,
      cx: NODE_POS.applied.cx,
      cy: NODE_POS.applied.cy,
      emphasized: true,
    },
    {
      id: "pending",
      label: "Pending",
      count: pipeline.pendingAppliedCount,
      percent: pct(pipeline.pendingAppliedCount),
      color: appliedStage.color,
      cx: NODE_POS.pending.cx,
      cy: NODE_POS.pending.cy,
    },
    {
      id: "interview",
      label: "Interview",
      count: pipeline.interviewReachedCount,
      percent: pipeline.interviewRate,
      color: interviewStage.color,
      cx: NODE_POS.interview.cx,
      cy: NODE_POS.interview.cy,
    },
    {
      id: "noResponse",
      label: "No Response",
      count: pipeline.noResponseCount,
      percent: pipeline.noResponseRate,
      color: noResponseOut.color,
      cx: NODE_POS.noResponse.cx,
      cy: NODE_POS.noResponse.cy,
    },
    {
      id: "rejected",
      label: "Rejected",
      count: pipeline.rejectedCount,
      percent: pipeline.rejectionRate,
      color: rejectedOut.color,
      cx: NODE_POS.rejected.cx,
      cy: NODE_POS.rejected.cy,
    },
    {
      id: "archived",
      label: "Archived",
      count: pipeline.archivedCount,
      percent: pipeline.archivedRate,
      color: archivedOut.color,
      cx: NODE_POS.archived.cx,
      cy: NODE_POS.archived.cy,
    },
    {
      id: "offer",
      label: "Offer",
      count: pipeline.offerCount,
      percent: pipeline.offerRate,
      color: offerStage.color,
      cx: NODE_POS.offer.cx,
      cy: NODE_POS.offer.cy,
      emphasized: true,
    },
  ];

  const appliedRX = NODE_POS.applied.cx + NODE_W.applied / 2 - 4;
  const middleLX = NODE_POS.pending.cx - NODE_W.regular / 2 + 4;
  const interviewRX = NODE_POS.interview.cx + NODE_W.regular / 2 - 4;
  const offerLX = NODE_POS.offer.cx - NODE_W.offer / 2 + 4;

  const edges: GraphEdgeData[] = [
    {
      fx: appliedRX,
      fy: NODE_POS.applied.cy,
      tx: middleLX,
      ty: NODE_POS.pending.cy,
      count: pipeline.pendingAppliedCount,
      color: appliedStage.color,
      delay: 140,
    },
    {
      fx: appliedRX,
      fy: NODE_POS.applied.cy,
      tx: middleLX,
      ty: NODE_POS.interview.cy,
      count: pipeline.interviewReachedCount,
      color: interviewStage.color,
      delay: 200,
    },
    {
      fx: appliedRX,
      fy: NODE_POS.applied.cy,
      tx: middleLX,
      ty: NODE_POS.noResponse.cy,
      count: pipeline.noResponseCount,
      color: noResponseOut.color,
      delay: 260,
    },
    {
      fx: appliedRX,
      fy: NODE_POS.applied.cy,
      tx: middleLX,
      ty: NODE_POS.rejected.cy,
      count: pipeline.rejectedCount,
      color: rejectedOut.color,
      delay: 320,
    },
    {
      fx: appliedRX,
      fy: NODE_POS.applied.cy,
      tx: middleLX,
      ty: NODE_POS.archived.cy,
      count: pipeline.archivedCount,
      color: archivedOut.color,
      delay: 380,
    },
    {
      fx: interviewRX,
      fy: NODE_POS.interview.cy,
      tx: offerLX,
      ty: NODE_POS.offer.cy,
      count: pipeline.offerCount,
      color: offerStage.color,
      delay: 560,
    },
  ];

  const summary = `Pipeline tree: ${applied} applied ${applied === 1 ? "job" : "jobs"} branching into ${nodes.length - 1} outcome stages.`;

  return (
    <div
      aria-label={summary}
      className="relative mx-auto w-full"
      role="img"
      style={{ aspectRatio: `${VIEW_W}/${VIEW_H}`, maxWidth: VIEW_W }}
    >
      <svg
        aria-hidden="true"
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="xMidYMid meet"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      >
        {edges.map((edge, i) => (
          <PipelineGraphConnector applied={applied} edge={edge} key={i} />
        ))}
      </svg>
      {nodes.map((node, i) => (
        <PipelineGraphNode delay={i * 80 + 120} key={node.id} node={node} />
      ))}
    </div>
  );
}

function StackNode({
  color,
  count,
  emphasized,
  label,
  percent,
}: {
  color?: string;
  count: number;
  emphasized?: boolean;
  label: string;
  percent: number | null;
}) {
  const ariaLabel = `${label}, ${count} ${count === 1 ? "job" : "jobs"}${
    percent !== null ? `, ${percent} percent of applied` : ""
  }`;
  return (
    <div
      aria-label={ariaLabel}
      className={cn(
        "flex items-center gap-3 rounded-xl border bg-card px-4 py-2.5 shadow-sm",
        nodeBorderClass(color),
      )}
      role="group"
    >
      <span className={cn("size-2 shrink-0 rounded-full", pipelineDot(color))} />
      <span className="min-w-0 flex-1 text-sm font-medium">{label}</span>
      <span
        className={cn(
          "font-semibold tabular-nums leading-none",
          emphasized ? "text-xl" : "text-base",
        )}
      >
        {count}
      </span>
      {percent !== null ? (
        <span className="w-10 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
          {percent}%
        </span>
      ) : null}
    </div>
  );
}

function PipelineStack({ pipeline }: { pipeline: PipelineMetrics }) {
  const [appliedStage, interviewStage, offerStage] = pipeline.funnelStages;
  const [rejectedOut, noResponseOut, archivedOut] = pipeline.outcomes;
  const applied = pipeline.appliedCount;
  const pct = (n: number) => (applied === 0 ? null : Math.round((n / applied) * 100));

  return (
    <div className="grid gap-2.5">
      <StackNode
        color={appliedStage.color}
        count={applied}
        emphasized
        label="Applied"
        percent={applied === 0 ? null : 100}
      />
      <div className="ml-6 grid gap-2 border-l border-dashed border-border/60 pl-4">
        <StackNode
          color={appliedStage.color}
          count={pipeline.pendingAppliedCount}
          label="Pending"
          percent={pct(pipeline.pendingAppliedCount)}
        />
        <StackNode
          color={interviewStage.color}
          count={pipeline.interviewReachedCount}
          label="Interview"
          percent={pipeline.interviewRate}
        />
        <div className="ml-3 grid gap-2 border-l border-dashed border-border/60 pl-4">
          <StackNode
            color={offerStage.color}
            count={pipeline.offerCount}
            emphasized
            label="Offer"
            percent={pipeline.offerRate}
          />
        </div>
        <StackNode
          color={noResponseOut.color}
          count={pipeline.noResponseCount}
          label="No Response"
          percent={pipeline.noResponseRate}
        />
        <StackNode
          color={rejectedOut.color}
          count={pipeline.rejectedCount}
          label="Rejected"
          percent={pipeline.rejectionRate}
        />
        <StackNode
          color={archivedOut.color}
          count={pipeline.archivedCount}
          label="Archived"
          percent={pipeline.archivedRate}
        />
      </div>
    </div>
  );
}

function PipelineStatPills({ pipeline }: { pipeline: PipelineMetrics }) {
  const pills = [
    { label: "Applied", value: String(pipeline.appliedCount) },
    { label: "Interview rate", value: `${pipeline.interviewRate}%` },
    { label: "Offer rate", value: `${pipeline.offerRate}%` },
    { label: "Pending", value: String(pipeline.pendingAppliedCount) },
    { label: "Rejected", value: String(pipeline.rejectedCount) },
  ];
  return (
    <div className="flex flex-wrap items-center gap-2">
      {pills.map((pill) => (
        <div
          className="flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs"
          key={pill.label}
        >
          <span className="text-muted-foreground">{pill.label}</span>
          <span className="font-semibold tabular-nums">{pill.value}</span>
        </div>
      ))}
    </div>
  );
}

function PipelineGraphView({ pipeline }: { pipeline: PipelineMetrics }) {
  if (pipeline.appliedCount === 0) {
    return (
      <div className="grid min-h-60 place-items-center rounded-lg border border-dashed bg-card/70 p-8 text-center">
        <p className="max-w-xs text-sm text-muted-foreground">
          Pipeline insights appear once jobs move into Applied or later.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      <style dangerouslySetInnerHTML={{ __html: PIPELINE_GRAPH_CSS }} />
      <PipelineStatPills pipeline={pipeline} />
      <section className="rounded-lg border bg-card p-5 shadow-sm sm:p-6 lg:p-8">
        <header className="mb-5 lg:mb-6">
          <h2 className="text-sm font-semibold">Pipeline map</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            How applications branch from Applied through each outcome.
          </p>
        </header>
        <div className="hidden md:block">
          <PipelineGraph pipeline={pipeline} />
        </div>
        <div className="md:hidden">
          <PipelineStack pipeline={pipeline} />
        </div>
        <p className="mt-5 text-[10px] text-muted-foreground/70 lg:mt-6">
          Interview and Offer counts include jobs that ever reached that stage.
        </p>
      </section>
    </div>
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
    <section className="rounded-lg border bg-card shadow-sm">
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

type MetricsView = "overview" | "pipeline";

const VIEWS: { id: MetricsView; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "pipeline", label: "Pipeline" },
];

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
  const [view, setView] = useState<MetricsView>("overview");
  const metrics = useMemo(
    () => calculateMetrics({ columns, jobs, now, sources }),
    [columns, jobs, now, sources],
  );
  const pipelineMetrics = useMemo(
    () => calculatePipelineMetrics({ activities, columns, jobs }),
    [activities, columns, jobs],
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
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <div>
          <h1 className="text-lg font-semibold tracking-normal">Metrics</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            How your job search is moving.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {isLoading ? "Loading..." : `${metrics.totalJobs} tracked jobs`}
          </span>
          <div className="flex items-center rounded-md bg-secondary p-0.5">
            {VIEWS.map(({ id, label }) => (
              <button
                className={cn(
                  "rounded px-3 py-1 text-sm font-medium transition-colors",
                  view === id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
                key={id}
                onClick={() => setView(id)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
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
      ) : view === "pipeline" ? (
        <PipelineGraphView pipeline={pipelineMetrics} />
      ) : (
        <>
          {/* Band 1: pace */}
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <WeeklyChart data={metrics.weeklyActivity} />
            <ResponseStats metrics={metrics} />
          </div>

          {/* Band 2: conversion */}
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            <PipelinePanel metrics={metrics} onViewPipeline={() => setView("pipeline")} />
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
