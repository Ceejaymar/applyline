import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useNow } from "./use-now";

describe("useNow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-13T12:00:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("updates on the requested interval and cleans up on unmount", () => {
    const { result, unmount } = renderHook(() => useNow(30_000));

    expect(result.current.toISOString()).toBe(new Date("2026-05-13T12:00:00").toISOString());
    expect(vi.getTimerCount()).toBe(1);

    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    expect(result.current.toISOString()).toBe(new Date("2026-05-13T12:00:30").toISOString());

    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
