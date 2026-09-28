import { afterEach, describe, expect, it, vi } from "vitest";

const originalStorageDescriptor = Object.getOwnPropertyDescriptor(navigator, "storage");

async function loadHelper(storage?: Partial<StorageManager>) {
  Object.defineProperty(navigator, "storage", {
    configurable: true,
    value: storage,
  });
  vi.resetModules();

  return import("./storage-persistence");
}

afterEach(() => {
  if (originalStorageDescriptor) {
    Object.defineProperty(navigator, "storage", originalStorageDescriptor);
  } else {
    Reflect.deleteProperty(navigator, "storage");
  }
});

describe("ensureLocalStorageProtection", () => {
  it("returns enabled without requesting again when storage is already persistent", async () => {
    const persist = vi.fn();
    const { ensureLocalStorageProtection } = await loadHelper({
      persist,
      persisted: vi.fn().mockResolvedValue(true),
    });

    await expect(ensureLocalStorageProtection()).resolves.toBe("enabled");
    expect(persist).not.toHaveBeenCalled();
  });

  it("requests persistence once and shares the result", async () => {
    const persist = vi.fn().mockResolvedValue(true);
    const { ensureLocalStorageProtection } = await loadHelper({
      persist,
      persisted: vi.fn().mockResolvedValue(false),
    });

    const firstRequest = ensureLocalStorageProtection();
    const secondRequest = ensureLocalStorageProtection();

    expect(firstRequest).toBe(secondRequest);
    await expect(firstRequest).resolves.toBe("enabled");
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it("falls back to browser-managed storage when persistence is denied", async () => {
    const { ensureLocalStorageProtection } = await loadHelper({
      persist: vi.fn().mockResolvedValue(false),
      persisted: vi.fn().mockResolvedValue(false),
    });

    await expect(ensureLocalStorageProtection()).resolves.toBe("browser-managed");
  });

  it("falls back without blocking when the API is unavailable or fails", async () => {
    const unsupported = await loadHelper();
    await expect(unsupported.ensureLocalStorageProtection()).resolves.toBe("browser-managed");

    const failing = await loadHelper({
      persisted: vi.fn().mockRejectedValue(new Error("Storage unavailable")),
    });
    await expect(failing.ensureLocalStorageProtection()).resolves.toBe("browser-managed");
  });
});
