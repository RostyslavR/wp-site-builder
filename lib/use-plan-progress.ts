"use client";

import { useEffect, useState } from "react";

/** Tracks elapsed working time across turns, for display next to Session cost. */
export function usePlanProgress() {
  const [totalMs, setTotalMs] = useState(0);
  const [turnStartedAt, setTurnStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (turnStartedAt === null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [turnStartedAt]);

  function onTurnStart() {
    const start = Date.now();
    setTurnStartedAt(start);
    setNow(start);
  }

  function onTurnComplete(durationMs: number | undefined) {
    setTurnStartedAt(null);
    if (typeof durationMs === "number") {
      setTotalMs((prev) => prev + durationMs);
    }
  }

  function reset() {
    setTotalMs(0);
    setTurnStartedAt(null);
  }

  const elapsedMs = totalMs + (turnStartedAt !== null && now !== null ? now - turnStartedAt : 0);

  return {
    elapsedMs,
    onTurnStart,
    onTurnComplete,
    reset,
  };
}
