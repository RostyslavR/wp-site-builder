"use client";

import { useEffect, useState } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "site-wp-app:theme";

export function useTheme() {
  // Starts as "light" to match the server-rendered HTML (theme is applied
  // to <html> by a blocking inline script in layout.tsx, before hydration —
  // React never sees that mutation, so it can't mismatch). This effect just
  // syncs React state to whatever the script already applied, for the
  // toggle button's own icon.
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThemeState(document.documentElement.classList.contains("dark") ? "dark" : "light");
  }, []);

  function setTheme(next: Theme) {
    setThemeState(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage unavailable; theme still applies for this page session.
    }
  }

  function toggleTheme() {
    setTheme(theme === "dark" ? "light" : "dark");
  }

  return { theme, setTheme, toggleTheme };
}
