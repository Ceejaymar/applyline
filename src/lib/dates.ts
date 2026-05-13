/**
 * Compact relative time — for tight spaces like job cards.
 * Examples: "now", "5d", "3w", "2mo", "1y"
 */
export function formatRelativeTimeCompact(value: string): string {
  const elapsedMs = Date.now() - new Date(value).getTime();
  const elapsedDays = Math.max(0, Math.floor(elapsedMs / 86_400_000));

  if (elapsedDays < 1) return "now";
  if (elapsedDays < 7) return `${elapsedDays}d`;
  if (elapsedDays < 35) return `${Math.floor(elapsedDays / 7)}w`;
  if (elapsedDays < 365) return `${Math.floor(elapsedDays / 30)}mo`;
  return `${Math.floor(elapsedDays / 365)}y`;
}

/**
 * Standard relative time — day-level granularity with "ago".
 * Examples: "today", "5d ago", "3w ago", "2mo ago"
 */
export function formatRelativeTime(value: string): string {
  const elapsedMs = Date.now() - new Date(value).getTime();
  const elapsedDays = Math.max(0, Math.floor(elapsedMs / 86_400_000));

  if (elapsedDays < 1) return "today";
  if (elapsedDays < 7) return `${elapsedDays}d ago`;
  if (elapsedDays < 35) return `${Math.floor(elapsedDays / 7)}w ago`;
  return `${Math.floor(elapsedDays / 30)}mo ago`;
}

/**
 * Detailed relative time — minute/hour/day/week granularity for activity feeds.
 * Examples: "just now", "5m ago", "3h ago", "2d ago", "3w ago"
 */
export function formatRelativeTimeFull(value: string): string {
  const elapsedMs = Date.now() - new Date(value).getTime();
  const elapsedMinutes = Math.max(0, Math.floor(elapsedMs / 60_000));

  if (elapsedMinutes < 1) return "just now";
  if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours}h ago`;

  const elapsedDays = Math.floor(elapsedHours / 24);
  if (elapsedDays < 7) return `${elapsedDays}d ago`;
  if (elapsedDays < 35) return `${Math.floor(elapsedDays / 7)}w ago`;
  return `${Math.floor(elapsedDays / 30)}mo ago`;
}
