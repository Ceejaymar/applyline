export function nowIso() {
  return new Date().toISOString();
}

export function createId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function sortJobsForPersistence(
  a: { position?: number; updatedAt: string },
  b: { position?: number; updatedAt: string },
) {
  const aPosition = a.position ?? Number.POSITIVE_INFINITY;
  const bPosition = b.position ?? Number.POSITIVE_INFINITY;

  if (aPosition !== bPosition) {
    return aPosition - bPosition;
  }

  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
}
