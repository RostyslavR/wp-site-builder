"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "site-wp-app:full-width";

export function useFullWidth() {
  const [fullWidth, setFullWidthState] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Reads localStorage once on mount (unavailable during SSR) and gates
  // rendering via `loaded` until then, to avoid a hydration mismatch — same
  // pattern as useLocalSettings.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw !== null) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setFullWidthState(raw === "true");
      }
    } catch {
      // Malformed or unavailable storage — fall back to default.
    }
    setLoaded(true);
  }, []);

  function setFullWidth(next: boolean) {
    setFullWidthState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      // Storage unavailable; state still updates for this page session.
    }
  }

  function toggleFullWidth() {
    setFullWidth(!fullWidth);
  }

  return { fullWidth, toggleFullWidth, loaded };
}
