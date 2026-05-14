import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_COLUMN_IDS } from "@/lib/schemas";
import type { BoardJob } from "@/lib/use-jobs";

import { JobCardSurface } from "./job-card";

function makeJob(overrides: Partial<BoardJob> = {}): BoardJob {
  const now = "2026-05-13T12:00:00.000Z";

  return {
    id: "job_1",
    title: "Senior Principal Staff Software Engineer With An Extremely Long Platform Title",
    companyId: "company_1",
    companyName: "A Very Long Company Name That Should Never Push The Card Wider",
    columnId: DEFAULT_COLUMN_IDS.applied,
    columnName: "Applied",
    createdAt: now,
    lastStatusChangedAt: now,
    link: "https://example.com/jobs/1",
    sourceIcon: "briefcase",
    sourceName: "A Very Long Source Platform Name That Should Truncate",
    tags: ["supercalifragilisticexpialidocious-tag", "another-very-long-tag"],
    updatedAt: now,
    ...overrides,
  };
}

describe("JobCardSurface", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps compact text lanes constrained and discoverable", () => {
    const job = makeJob();
    render(<JobCardSurface job={job} onOpen={vi.fn()} />);

    const card = screen.getByRole("button", {
      name: `${job.title} at ${job.companyName}`,
    });
    expect(card).toHaveClass("w-full", "max-w-full", "overflow-hidden");

    expect(screen.getByRole("heading", { name: job.title })).toHaveClass("truncate");
    expect(screen.getByTitle(job.companyName)).toHaveClass("overflow-hidden");
    expect(screen.getByTitle(job.sourceName!)).toHaveClass("overflow-hidden");
    expect(screen.getByTitle(job.tags[0])).toHaveClass("truncate", "max-w-[5.75rem]");
    expect(screen.getByLabelText(/Last activity:/)).toHaveClass("truncate", "max-w-16");
  });

  it("opens the posting without opening the job drawer", async () => {
    const user = userEvent.setup();
    const openJob = vi.fn();
    const openWindow = vi.spyOn(window, "open").mockImplementation(() => null);
    const job = makeJob();

    render(<JobCardSurface job={job} onOpen={openJob} />);

    await user.click(screen.getByRole("button", { name: `Open posting for ${job.title}` }));

    expect(openWindow).toHaveBeenCalledWith(job.link, "_blank", "noopener,noreferrer");
    expect(openJob).not.toHaveBeenCalled();
  });

  it("opens the job drawer from the card body", async () => {
    const user = userEvent.setup();
    const openJob = vi.fn();
    const job = makeJob();

    render(<JobCardSurface job={job} onOpen={openJob} />);

    await user.click(screen.getByRole("heading", { name: job.title }));

    expect(openJob).toHaveBeenCalledTimes(1);
  });
});
