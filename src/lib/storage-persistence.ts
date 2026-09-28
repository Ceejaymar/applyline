export type LocalStorageProtectionStatus = "enabled" | "browser-managed";

let persistenceRequest: Promise<LocalStorageProtectionStatus> | undefined;

async function requestLocalStorageProtection(): Promise<LocalStorageProtectionStatus> {
  if (typeof navigator === "undefined" || !navigator.storage?.persisted) {
    return "browser-managed";
  }

  try {
    if (await navigator.storage.persisted()) {
      return "enabled";
    }

    if (!navigator.storage.persist) {
      return "browser-managed";
    }

    return (await navigator.storage.persist()) ? "enabled" : "browser-managed";
  } catch {
    return "browser-managed";
  }
}

export function ensureLocalStorageProtection() {
  persistenceRequest ??= requestLocalStorageProtection();
  return persistenceRequest;
}
