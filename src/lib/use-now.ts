"use client";

import { useEffect, useState } from "react";

const defaultNowIntervalMs = 30_000;

export function useNow(intervalMs = defaultNowIntervalMs) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(new Date());
    }, intervalMs);

    return () => window.clearInterval(intervalId);
  }, [intervalMs]);

  return now;
}
