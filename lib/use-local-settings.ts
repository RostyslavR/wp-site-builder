"use client";

import { useEffect, useState } from "react";

export interface SiteSettings {
  siteDir: string;
  siteUrl: string;
  wpSiteDir: string;
  wpSiteUrl: string;
  // The deployed live URL — only used
  // when the "Live" checkbox is on, to review real-world live behavior
  // while still fixing against the local wpSiteDir codebase, never the live
  // server itself.
  liveSiteUrl: string;
  // True when liveSiteUrl is a temporary/staging host rather than the final
  // production domain. Reviews interpret several checks in reverse on such a
  // host — most importantly indexability, where being crawlable is a defect
  // (the throwaway domain gets into search results and later competes with
  // the real one) rather than the pass it would be on production.
  liveSiteIsTemporary: boolean;
  // The design page (path on siteUrl) that a page-scoped pass reads —
  // Rebuild Page reconstructs it, Analyze Page/Create Page match it,
  // Review Page compares it against the WP rebuild. e.g.
  // "/free-assessment-immigration/". Empty means the prompt is missing it
  // and should stop and ask, not silently proceed with nothing.
  rebuildPageUrl: string;
  // Optional path to an SE Page Transfer .zip already downloaded by hand.
  // Empty means none was provided — the prompt's own instructions handle
  // that case (advise getting one) rather than a fallback string here.
  rebuildBundleZipPath: string;
  // The title Create Page gives the new WordPress page it builds — e.g.
  // "Homepage New". Empty means the prompt is missing it and should stop
  // and ask, not silently invent a name.
  newPageName: string;
  // Optional explicit WordPress post_name/slug for that same page — e.g.
  // "homepage-new". Overrides the auto-slug WordPress would otherwise
  // derive from newPageName; Create leaves auto-slugging alone when this
  // is empty. Review Page needs it set explicitly (to know the WP page's
  // own URL to compare against) and stops and asks if it's blank.
  newPageSlug: string;
  // Empty = let the SDK pick its own default model. Passed straight through
  // as query()'s `model` option when set.
  model: string;
  // Empty = use whatever ambient auth already works (claude CLI login, or an
  // ANTHROPIC_API_KEY already in the server's own environment) — this exists
  // only as an override for an environment where ambient auth isn't set up
  // (e.g. a 401 with no working `claude auth login` on that machine), not a
  // replacement for it. Sent to the server per-request, never persisted
  // there — this browser's localStorage is the only place it's stored.
  apiKey: string;
}

const STORAGE_KEY = "site-wp-app:settings";

const DEFAULT_SETTINGS: SiteSettings = {
  siteDir: "",
  siteUrl: "",
  wpSiteDir: "",
  wpSiteUrl: "",
  liveSiteUrl: "",
  liveSiteIsTemporary: false,
  rebuildPageUrl: "",
  rebuildBundleZipPath: "",
  newPageName: "",
  newPageSlug: "",
  model: "",
  apiKey: "",
};

export function useLocalSettings() {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  // Reads localStorage once on mount (unavailable during SSR) and gates
  // rendering via `loaded` until then, to avoid a hydration mismatch — a
  // legitimate exception to the "don't setState in an effect" rule below.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) });
      }
    } catch {
      // Malformed or unavailable storage — fall back to defaults.
    }
    setLoaded(true);
  }, []);

  function save(next: SiteSettings) {
    setSettings(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Storage unavailable; state still updates for this page session.
    }
  }

  return { settings, save, loaded };
}
