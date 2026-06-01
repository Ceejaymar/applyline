type DateInput = Date | string | null | undefined;

type JobTimestampLike = {
  createdAt?: string;
  lastStatusChangedAt?: string;
  updatedAt?: string;
};

const minuteMs = 60_000;
const hourMs = 60 * minuteMs;
const dayMs = 24 * hourMs;
const maxJobCardRelativeDays = 30;
const safeDateFallback = "—";

function toDate(value: DateInput) {
  if (!value) {
    return undefined;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function sameYear(date: Date, now: Date) {
  return date.getFullYear() === now.getFullYear();
}

function formatReadableDate(date: Date, now: Date) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    ...(sameYear(date, now) ? {} : { year: "numeric" }),
  }).format(date);
}

function formatReadableDateTime(date: Date, now: Date) {
  const dateText = new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    ...(sameYear(date, now) ? {} : { year: "numeric" }),
  }).format(date);
  const timeText = new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);

  return `${dateText} at ${timeText}`;
}

function formatReadableDateTimeWithYear(date: Date) {
  const dateText = new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
  const timeText = new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);

  return `${dateText} at ${timeText}`;
}

function pluralize(value: number, unit: string) {
  return `${value} ${unit}${value === 1 ? "" : "s"} ago`;
}

export function getJobLatestTimestamp(job: JobTimestampLike) {
  return job.lastStatusChangedAt || job.updatedAt || job.createdAt;
}

export function formatRelativeTime(value: DateInput, now: Date = new Date()): string {
  const date = toDate(value);

  if (!date) {
    return safeDateFallback;
  }

  const elapsedMs = Math.max(0, now.getTime() - date.getTime());

  if (elapsedMs < minuteMs) {
    return "now";
  }

  if (elapsedMs < hourMs) {
    return `${Math.floor(elapsedMs / minuteMs)}m ago`;
  }

  if (elapsedMs < dayMs) {
    return `${Math.floor(elapsedMs / hourMs)}h ago`;
  }

  if (elapsedMs < 7 * dayMs) {
    return `${Math.floor(elapsedMs / dayMs)}d ago`;
  }

  return formatReadableDate(date, now);
}

export function formatRelativeTimeLong(value: DateInput, now: Date = new Date()): string {
  const date = toDate(value);

  if (!date) {
    return safeDateFallback;
  }

  const elapsedMs = Math.max(0, now.getTime() - date.getTime());

  if (elapsedMs < minuteMs) {
    return "now";
  }

  if (elapsedMs < hourMs) {
    return pluralize(Math.floor(elapsedMs / minuteMs), "minute");
  }

  if (elapsedMs < dayMs) {
    return pluralize(Math.floor(elapsedMs / hourMs), "hour");
  }

  if (elapsedMs < 7 * dayMs) {
    return pluralize(Math.floor(elapsedMs / dayMs), "day");
  }

  return formatReadableDateTime(date, now);
}

export function formatAbsoluteDateTime(value: DateInput, now: Date = new Date()): string {
  const date = toDate(value);
  return date ? formatReadableDateTime(date, now) : safeDateFallback;
}

export function formatAbsoluteDateTimeWithYear(value: DateInput): string {
  const date = toDate(value);
  return date ? formatReadableDateTimeWithYear(date) : safeDateFallback;
}

export function formatRelativeWithAbsoluteTime(value: DateInput, now: Date = new Date()): string {
  const date = toDate(value);

  if (!date) {
    return safeDateFallback;
  }

  return `${formatRelativeTimeLong(date, now)} · ${formatAbsoluteDateTime(date, now)}`;
}

function formatJobCardRelativeTime(value: DateInput, now: Date = new Date()): string {
  const date = toDate(value);

  if (!date) {
    return safeDateFallback;
  }

  const elapsedMs = Math.max(0, now.getTime() - date.getTime());

  if (elapsedMs < 7 * dayMs) {
    return formatRelativeTime(date, now);
  }

  if (elapsedMs >= maxJobCardRelativeDays * dayMs) {
    return formatReadableDate(date, now);
  }

  return pluralize(Math.floor(elapsedMs / dayMs), "day");
}

export function getJobDisplayTimestamp(job: JobTimestampLike, now: Date = new Date()) {
  return formatJobCardRelativeTime(getJobLatestTimestamp(job), now);
}

export function getJobDisplayTimestampTitle(job: JobTimestampLike) {
  return formatAbsoluteDateTimeWithYear(getJobLatestTimestamp(job));
}

export const formatRelativeTimeCompact = formatRelativeTime;
export const formatRelativeTimeFull = formatRelativeTimeLong;
