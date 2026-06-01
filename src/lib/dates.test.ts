import { describe, expect, it } from "vitest";

import {
  formatAbsoluteDateTime,
  formatAbsoluteDateTimeWithYear,
  formatRelativeTime,
  formatRelativeTimeLong,
  formatRelativeWithAbsoluteTime,
  getJobDisplayTimestamp,
  getJobDisplayTimestampTitle,
} from "./dates";

const now = new Date("2026-05-13T16:45:00");

describe("formatRelativeTime", () => {
  it("shows now for dates less than 1 minute ago", () => {
    expect(formatRelativeTime("2026-05-13T16:44:30", now)).toBe("now");
  });

  it("shows compact minutes for dates less than 1 hour ago", () => {
    expect(formatRelativeTime("2026-05-13T16:35:00", now)).toBe("10m ago");
  });

  it("shows compact hours for dates less than 1 day ago", () => {
    expect(formatRelativeTime("2026-05-13T15:45:00", now)).toBe("1h ago");
  });

  it("shows compact days for dates less than 7 days ago", () => {
    expect(formatRelativeTime("2026-05-10T16:45:00", now)).toBe("3d ago");
  });

  it("shows a readable date for dates 7+ days ago in the current year", () => {
    expect(formatRelativeTime("2026-05-06T16:45:00", now)).toBe("May 6");
  });

  it("shows a readable date with year for older years", () => {
    expect(formatRelativeTime("2025-05-13T16:45:00", now)).toBe("May 13, 2025");
  });

  it("handles invalid dates without throwing", () => {
    expect(formatRelativeTime("not-a-date", now)).toBe("—");
  });
});

describe("formatRelativeTimeLong", () => {
  it("shows full minute text", () => {
    expect(formatRelativeTimeLong("2026-05-13T16:35:00", now)).toBe("10 minutes ago");
  });

  it("shows singular full hour text", () => {
    expect(formatRelativeTimeLong("2026-05-13T15:45:00", now)).toBe("1 hour ago");
  });

  it("shows date and time for dates 7+ days ago", () => {
    expect(formatRelativeTimeLong("2026-05-01T16:45:00", now)).toBe("May 1 at 4:45 PM");
  });
});

describe("formatAbsoluteDateTime", () => {
  it("formats current-year dates without a year", () => {
    expect(formatAbsoluteDateTime("2026-05-13T16:45:00", now)).toBe(
      "May 13 at 4:45 PM",
    );
  });

  it("formats older-year dates with a year", () => {
    expect(formatAbsoluteDateTime("2025-05-13T16:45:00", now)).toBe(
      "May 13, 2025 at 4:45 PM",
    );
  });
});

describe("formatAbsoluteDateTimeWithYear", () => {
  it("always formats dates with a year", () => {
    expect(formatAbsoluteDateTimeWithYear("2026-05-13T16:45:00")).toBe(
      "May 13, 2026 at 4:45 PM",
    );
  });
});

describe("formatRelativeWithAbsoluteTime", () => {
  it("combines long relative text with absolute time", () => {
    expect(formatRelativeWithAbsoluteTime("2026-05-13T16:35:00", now)).toBe(
      "10 minutes ago · May 13 at 4:35 PM",
    );
  });
});

describe("getJobDisplayTimestamp", () => {
  it("uses lastStatusChangedAt first", () => {
    expect(
      getJobDisplayTimestamp(
        {
          createdAt: "2026-05-13T10:45:00",
          lastStatusChangedAt: "2026-05-13T16:35:00",
          updatedAt: "2026-05-13T12:45:00",
        },
        now,
      ),
    ).toBe("10m ago");
  });

  it("uses updatedAt second", () => {
    expect(
      getJobDisplayTimestamp(
        {
          createdAt: "2026-05-13T10:45:00",
          updatedAt: "2026-05-13T15:45:00",
        },
        now,
      ),
    ).toBe("1h ago");
  });

  it("uses createdAt third", () => {
    expect(getJobDisplayTimestamp({ createdAt: "2026-05-09T16:45:00" }, now)).toBe(
      "4d ago",
    );
  });

  it("keeps older card timestamps relative instead of showing a date", () => {
    expect(getJobDisplayTimestamp({ updatedAt: "2026-05-04T16:45:00" }, now)).toBe(
      "9 days ago",
    );
  });
});

describe("getJobDisplayTimestampTitle", () => {
  it("uses the latest meaningful job timestamp for an absolute tooltip", () => {
    expect(
      getJobDisplayTimestampTitle({
        createdAt: "2026-05-13T10:45:00",
        lastStatusChangedAt: "2026-05-13T16:35:00",
        updatedAt: "2026-05-13T12:45:00",
      }),
    ).toBe("May 13, 2026 at 4:35 PM");
  });
});
