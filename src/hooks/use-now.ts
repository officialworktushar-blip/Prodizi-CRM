"use client";

import { useEffect, useState } from "react";

export function useNow(intervalMs?: number) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();

    if (!intervalMs) return;

    const interval = window.setInterval(tick, intervalMs);
    return () => window.clearInterval(interval);
  }, [intervalMs]);

  return now;
}
