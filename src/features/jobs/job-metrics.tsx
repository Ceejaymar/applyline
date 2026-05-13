"use client";

import { ChartNoAxesColumn, CircleCheckBig, Handshake, Send } from "lucide-react";

import { DEFAULT_COLUMN_IDS } from "@/lib/schemas";
import { useJobs } from "@/lib/use-jobs";

const metricCards = [
  { label: "Tracked", key: "total", icon: ChartNoAxesColumn },
  { label: "Applied", key: "applied", icon: Send },
  { label: "Interviews", key: "interviewing", icon: Handshake },
  { label: "Offers", key: "offer", icon: CircleCheckBig },
] as const;

export function JobMetrics() {
  const { jobs } = useJobs();
  const values = {
    total: jobs.length,
    applied: jobs.filter((job) => job.columnId === DEFAULT_COLUMN_IDS.applied).length,
    interviewing: jobs.filter((job) => job.columnId === DEFAULT_COLUMN_IDS.interview).length,
    offer: jobs.filter((job) => job.columnId === DEFAULT_COLUMN_IDS.offer).length,
  };

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-normal">Metrics</h1>
        <p className="text-sm text-muted-foreground">A quick read on your pipeline.</p>
      </div>
      <div className="grid grid-cols-4 gap-3">
        {metricCards.map((card) => (
          <section className="rounded-lg border bg-card p-4" key={card.key}>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">{card.label}</span>
              <card.icon className="size-4 text-primary" />
            </div>
            <p className="mt-3 text-2xl font-semibold">{values[card.key]}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
