"use client";

import { useEffect, useRef, useState, type ClipboardEvent } from "react";
import { createPortal } from "react-dom";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { SiteSettings } from "@/lib/use-local-settings";
import { fetchPromptTemplate, substituteTemplate } from "@/lib/use-prompt-template";
import { fetchOnDiskReport, reportFileName, formatAge } from "@/lib/review-report";
import { formatContinueContextBlock, type ContextReportSection } from "@/lib/continue-context";
import { formatDuration } from "@/lib/utils";

interface ChatPanelProps {
  settings: SiteSettings;
  elapsedMs: number;
  optionsSlot: HTMLDivElement | null;
  onTurnStart: () => void;
  onTurnComplete: (durationMs: number | undefined) => void;
  onPlanReset: () => void;
}

type DisplayItem =
  | { id: string; kind: "user"; text: string; images?: string[] }
  | { id: string; kind: "assistant"; text: string }
  | {
      id: string;
      kind: "tool_use";
      toolUseId: string;
      name: string;
      input: unknown;
      elapsedSeconds?: number;
    }
  | { id: string; kind: "tool_result"; preview: string }
  | { id: string; kind: "turn_complete"; costUsd?: number; durationMs?: number }
  | { id: string; kind: "auto_resume"; text: string }
  | { id: string; kind: "error"; text: string }
  | { id: string; kind: "model_refusal_fallback"; originalModel: string; fallbackModel: string };

let itemCounter = 0;
function nextId() {
  itemCounter += 1;
  // Date.now() + random guard against collisions with ids already in state
  // from before a dev Fast Refresh — that reloads this module (resetting
  // itemCounter to 0) without resetting the component's `items` state, so a
  // plain incrementing counter alone can hand out an id already in use.
  return `item-${Date.now().toString(36)}-${itemCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

function summarizeToolResultContent(content: unknown): string {
  if (typeof content === "string") return content.slice(0, 400);
  if (Array.isArray(content)) {
    return content
      .map((block) =>
        typeof (block as { text?: unknown })?.text === "string"
          ? (block as { text: string }).text
          : JSON.stringify(block)
      )
      .join("\n")
      .slice(0, 400);
  }
  return JSON.stringify(content).slice(0, 400);
}

type Builder = "gutenberg" | "elementor";
type SeoPlugin = "yoast" | "rankmath";
// How Rebuild Page should handle the source page's form: keep it as the CF7
// form SE Page Transfer already recreated (no further rebuild), rebuild that
// form to match the target's own CF7 conventions, or — only meaningful when
// Elementor Pro is the selected builder — rebuild it as a native Elementor
// Pro Form widget instead of a CF7 embed.
type FormHandling = "keep" | "rebuild-cf7" | "rebuild-elementor-pro";

interface PluginSelection {
  woocommerce: boolean;
  polylang: boolean;
}

const PLUGIN_OPTIONS: Array<{ key: keyof PluginSelection; label: string }> = [
  { key: "woocommerce", label: "WooCommerce" },
  { key: "polylang", label: "Polylang" },
];

const SEO_PLUGIN_OPTIONS: Array<{ value: SeoPlugin; label: string }> = [
  { value: "yoast", label: "Yoast SEO" },
  { value: "rankmath", label: "RankMath" },
];

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

const SESSION_STORAGE_KEY = "site-wp-app:sessionId";
const ACTION_STORAGE_KEY = "site-wp-app:currentAction";
const LAST_REVIEW_STORAGE_KEY = "site-wp-app:lastReviewSlug";
const LAST_ANALYZE_STORAGE_KEY = "site-wp-app:lastAnalyzeSlug";
const BUILD_OPTIONS_STORAGE_KEY = "site-wp-app:buildOptions";
const FORM_HANDLING_STORAGE_KEY = "site-wp-app:formHandling";
const USE_LIVE_STORAGE_KEY = "site-wp-app:useLive";
const SELF_STYLES_STORAGE_KEY = "site-wp-app:selfStylesOnly";
const CANVAS_TEMPLATE_STORAGE_KEY = "site-wp-app:canvasTemplate";
const WEBP_IMAGES_STORAGE_KEY = "site-wp-app:webpImages";

interface BuildOptions {
  builder: Builder;
  elementorPro: boolean;
  seoPlugin: SeoPlugin;
  plugins: PluginSelection;
}

const DEFAULT_BUILD_OPTIONS: BuildOptions = {
  builder: "elementor",
  elementorPro: true,
  seoPlugin: "yoast",
  plugins: { woocommerce: false, polylang: false },
};

interface PendingImage {
  id: string;
  mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  data: string;
  dataUrl: string;
}

function fileToPendingImage(file: File): Promise<PendingImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
      resolve({
        id: nextId(),
        mediaType: file.type as PendingImage["mediaType"],
        data: base64,
        dataUrl,
      });
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function ChatPanel({
  settings,
  elapsedMs,
  optionsSlot,
  onTurnStart,
  onTurnComplete,
  onPlanReset,
}: ChatPanelProps) {
  const [builder, setBuilder] = useState<Builder>(DEFAULT_BUILD_OPTIONS.builder);
  const [elementorPro, setElementorPro] = useState(DEFAULT_BUILD_OPTIONS.elementorPro);
  const [seoPlugin, setSeoPlugin] = useState<SeoPlugin>(DEFAULT_BUILD_OPTIONS.seoPlugin);
  const [plugins, setPlugins] = useState<PluginSelection>(DEFAULT_BUILD_OPTIONS.plugins);
  // Review-only toggle: when on, the review buttons (never Analyze/Build/
  // Change/Continue/Prompt) point their {{wpSiteUrl}} at the deployed live
  // site instead of the local dev build, so a review can see real-world live
  // behavior. Fixes always still target the local wpSiteDir — see
  // liveAwareReplacements below.
  const [useLive, setUseLive] = useState(false);
  // Create-time preference: when on, Page/Header/Footer Creates use only
  // local, literal widget-level styles and never link to the Kit's Global
  // Colors/Fonts even when a matching one already exists — for a build
  // that's meant to stand entirely on its own, unaffected by any later
  // Global Styles change. Off by default: normally, linking to an existing
  // Kit global is preferred over duplicating its value locally.
  const [selfStylesOnly, setSelfStylesOnly] = useState(false);
  // Create-time preference, Page scope only: when on, the page gets
  // Elementor's Canvas template (no header/footer/sidebar — the page stands
  // entirely alone, isolated from whatever chrome does or doesn't exist yet).
  // Off by default: the page uses the theme's Default Template instead, so
  // it renders in full context with whatever header/footer is currently
  // active — even if that's still the old, not-yet-replaced chrome.
  const [canvasTemplate, setCanvasTemplate] = useState(false);
  // Create-time preference, on by default (unlike selfStylesOnly/canvasTemplate
  // above): any new image the build uploads gets converted to WebP first,
  // rather than kept in whatever format the source file came in (usually a
  // much larger PNG/JPEG — confirmed on this project's own homepage hero, a
  // 1.82MB PNG became an 82KB WebP at unchanged visual quality). Default on
  // because there's essentially never a reason to keep the bigger format for
  // a freshly-uploaded raster photo; off only for the rare case a build needs
  // to preserve an exact source file.
  const [webpImages, setWebpImages] = useState(true);
  const [formHandling, setFormHandling] = useState<FormHandling>("keep");
  const [sessionId, setSessionId] = useState<string | null>(null);
  // Which button was last pressed (Analyze/Build/Review UI/Change/etc.) —
  // shown in the header so it's visible what the session is actually doing,
  // since a long-running turn's chat transcript alone doesn't say which
  // workflow kicked it off. Continue deliberately does not update this: it
  // nudges whatever's already running rather than starting something new.
  const [currentAction, setCurrentAction] = useState<string | null>(null);
  // Which review prompt last ran (the slug, e.g. "review-header-footer") —
  // this is what tells Change which report on disk to fix. Deliberately
  // separate from currentAction: that gets overwritten with "Change" the
  // moment Change is clicked, and resetSession() clears it, whereas this has
  // to outlive both to be useful at all.
  const [lastReviewSlug, setLastReviewSlug] = useState<string | null>(null);
  // What Change would currently pick up, shown next to the button so a stale
  // or missing report is visible before it's used rather than after.
  const [changeSource, setChangeSource] = useState<string | null>(null);
  // Same idea as lastReviewSlug/changeSource, one level up: which scoped
  // Analyze (Page/Header/Footer/Menu) last ran — this is what tells the one
  // common Create button which report on disk to build from, the same
  // relationship Change has to the review family.
  const [lastAnalyzeSlug, setLastAnalyzeSlug] = useState<string | null>(null);
  // What Create would currently pick up, shown next to the button so a stale
  // or missing analysis is visible before it's used rather than after.
  const [createSource, setCreateSource] = useState<string | null>(null);
  const [items, setItems] = useState<DisplayItem[]>([]);
  const [inputText, setInputText] = useState("");
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [starting, setStarting] = useState(false);
  const [totalCostUsd, setTotalCostUsd] = useState(0);
  // The actual resolved model from the most recent assistant message — not
  // just an echo of the Settings dropdown's config (which could be "default"
  // or an alias), since a session can fall back to a different model than
  // requested (e.g. under rate limiting).
  const [currentModel, setCurrentModel] = useState<string | null>(null);
  const [rateLimitInfo, setRateLimitInfo] = useState<{
    status: string;
    rateLimitType: string;
    resetsAt: number;
  } | null>(null);
  const [working, setWorking] = useState(false);
  const [liveStatus, setLiveStatus] = useState<string | null>(null);
  const [fixingPermalinks, setFixingPermalinks] = useState(false);
  const [permalinkFixStatus, setPermalinkFixStatus] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [frontendPort, setFrontendPort] = useState("5173");
  const [serverPort, setServerPort] = useState("5000");
  // Install Site targets {{siteDir}}, an unrelated project — not the
  // WordPress site at cwd — so the WP/builder preamble below would just
  // confuse the agent. Tracks whether the currently-staged text came from
  // that flow so handleSend can skip it for this one send.
  const [skipStackContext, setSkipStackContext] = useState(false);
  // False until the restore-from-localStorage effects below have run; gates
  // the persist effects so they can't write defaults over stored values on
  // first render. See the effect that sets it for the full reasoning.
  const [hydrated, setHydrated] = useState(false);

  const cwd = settings.wpSiteDir;

  // Restore a still-running session across a page refresh — without this,
  // refreshing (or reopening the tab) always lands on "No messages yet" even
  // though the underlying Claude Code process is still alive server-side,
  // making it impossible to check on or nudge a long-running session (e.g.
  // one waiting on a rate-limit reset) without abandoning it. Only past chat
  // history is lost this way — the SSE stream only delivers messages from
  // the point of reconnection, not a replay — but the live session itself,
  // and the ability to keep sending it messages, survives the refresh.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(SESSION_STORAGE_KEY);
      if (stored) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSessionId(stored);
      }
    } catch {
      // Storage unavailable — falls back to starting a fresh session.
    }
  }, []);

  useEffect(() => {
    try {
      if (sessionId) {
        window.localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
      } else {
        window.localStorage.removeItem(SESSION_STORAGE_KEY);
      }
    } catch {
      // Storage unavailable; session still works for this page load.
    }
  }, [sessionId]);

  // Same restore/persist pattern as sessionId above — survives a refresh so
  // the "what's this session doing" label doesn't just vanish because the
  // in-memory items history did.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(ACTION_STORAGE_KEY);
      if (stored) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCurrentAction(stored);
      }
    } catch {
      // Storage unavailable — falls back to no label until a button is pressed.
    }
  }, []);

  useEffect(() => {
    try {
      if (currentAction) {
        window.localStorage.setItem(ACTION_STORAGE_KEY, currentAction);
      } else {
        window.localStorage.removeItem(ACTION_STORAGE_KEY);
      }
    } catch {
      // Storage unavailable; label still works for this page load.
    }
  }, [currentAction]);

  // Same restore/persist pattern again. This one matters more than the
  // others: it's the whole reason Change survives a closed tab, since the
  // chat transcript it used to read from does not.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(LAST_REVIEW_STORAGE_KEY);
      if (stored) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLastReviewSlug(stored);
      }
    } catch {
      // Storage unavailable — Change falls back to the chat transcript.
    }
  }, []);

  useEffect(() => {
    try {
      if (lastReviewSlug) {
        window.localStorage.setItem(LAST_REVIEW_STORAGE_KEY, lastReviewSlug);
      } else {
        window.localStorage.removeItem(LAST_REVIEW_STORAGE_KEY);
      }
    } catch {
      // Storage unavailable; still works for this page load.
    }
  }, [lastReviewSlug]);

  // The "Change will use …" hint is looked up lazily (on hover/focus of the
  // Change button, see refreshChangeSource) rather than eagerly on mount —
  // fetching it for every cwd on page load 404s for any site that hasn't had
  // a review run against it yet. Whatever was last fetched goes stale the
  // moment the site or the last review changes, so drop it rather than show
  // a hint for the wrong report.
  useEffect(() => {
    setChangeSource(null);
  }, [cwd, lastReviewSlug]);

  // Re-checks disk on demand — called from the Change button's hover/focus so
  // the hint is fresh right when it's about to be read, without polling disk
  // on every render.
  function refreshChangeSource() {
    if (!cwd || !lastReviewSlug) return;
    fetchOnDiskReport(cwd, lastReviewSlug).then((found) => {
      setChangeSource(
        found
          ? `${reportFileName(lastReviewSlug)} · ${formatAge(found.modifiedAt)}`
          : `no ${reportFileName(lastReviewSlug)} on disk — will use the chat transcript`
      );
    });
  }

  // Same restore/persist pattern as lastReviewSlug — this is what lets Create
  // survive a closed tab, matching whichever scoped Analyze last ran.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(LAST_ANALYZE_STORAGE_KEY);
      if (stored) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLastAnalyzeSlug(stored);
      }
    } catch {
      // Storage unavailable — Create falls back to the chat transcript.
    }
  }, []);

  useEffect(() => {
    try {
      if (lastAnalyzeSlug) {
        window.localStorage.setItem(LAST_ANALYZE_STORAGE_KEY, lastAnalyzeSlug);
      } else {
        window.localStorage.removeItem(LAST_ANALYZE_STORAGE_KEY);
      }
    } catch {
      // Storage unavailable; still works for this page load.
    }
  }, [lastAnalyzeSlug]);

  // Same lazy-hint pattern as changeSource — dropped on any cwd/slug change so
  // it never shows a hint for the wrong report.
  useEffect(() => {
    setCreateSource(null);
  }, [cwd, lastAnalyzeSlug]);

  // Re-checks disk on demand — called from the Create button's hover/focus.
  function refreshCreateSource() {
    if (!cwd || !lastAnalyzeSlug) return;
    fetchOnDiskReport(cwd, lastAnalyzeSlug).then((found) => {
      setCreateSource(
        found
          ? `${reportFileName(lastAnalyzeSlug)} · ${formatAge(found.modifiedAt)}`
          : `no ${reportFileName(lastAnalyzeSlug)} on disk — will use the chat transcript`
      );
    });
  }

  // Same restore/persist pattern again — Build Options (page builder,
  // Elementor Pro, SEO plugin, WooCommerce) otherwise reset to their defaults
  // on every refresh, forcing them to be re-picked before every single Build
  // even though they rarely change project to project.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(BUILD_OPTIONS_STORAGE_KEY);
      if (stored) {
        const parsed = { ...DEFAULT_BUILD_OPTIONS, ...JSON.parse(stored) } as BuildOptions;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setBuilder(parsed.builder);
        setElementorPro(parsed.elementorPro);
        setSeoPlugin(parsed.seoPlugin);
        setPlugins(parsed.plugins);
      }
    } catch {
      // Storage unavailable or malformed — falls back to the defaults already in state.
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      const toStore: BuildOptions = { builder, elementorPro, seoPlugin, plugins };
      window.localStorage.setItem(BUILD_OPTIONS_STORAGE_KEY, JSON.stringify(toStore));
    } catch {
      // Storage unavailable; options still work for this page load.
    }
  }, [hydrated, builder, elementorPro, seoPlugin, plugins]);

  // Same restore/persist pattern once more — the Live checkbox is a review
  // preference like Build Options (not session-transient state; resetSession
  // already leaves it alone), so it should survive a refresh the same way.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(USE_LIVE_STORAGE_KEY);
      if (stored !== null) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setUseLive(stored === "true");
      }
    } catch {
      // Storage unavailable — falls back to unchecked.
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(USE_LIVE_STORAGE_KEY, String(useLive));
    } catch {
      // Storage unavailable; checkbox still works for this page load.
    }
  }, [hydrated, useLive]);

  // Same restore/persist pattern as useLive — a Create preference, not
  // session-transient state.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(SELF_STYLES_STORAGE_KEY);
      if (stored !== null) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSelfStylesOnly(stored === "true");
      }
    } catch {
      // Storage unavailable — falls back to unchecked.
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(SELF_STYLES_STORAGE_KEY, String(selfStylesOnly));
    } catch {
      // Storage unavailable; checkbox still works for this page load.
    }
  }, [hydrated, selfStylesOnly]);

  // Same restore/persist pattern again — Canvas is a Page-scope Create
  // preference, not session-transient state.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(CANVAS_TEMPLATE_STORAGE_KEY);
      if (stored !== null) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCanvasTemplate(stored === "true");
      }
    } catch {
      // Storage unavailable — falls back to unchecked (Default Template).
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(CANVAS_TEMPLATE_STORAGE_KEY, String(canvasTemplate));
    } catch {
      // Storage unavailable; checkbox still works for this page load.
    }
  }, [hydrated, canvasTemplate]);

  // Same restore/persist pattern again — but the useState(true) default above
  // already covers "no stored value yet", so restoring only needs to handle
  // the case where a stored value actually overrides it (including an
  // explicit past "false").
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(WEBP_IMAGES_STORAGE_KEY);
      if (stored !== null) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setWebpImages(stored === "true");
      }
    } catch {
      // Storage unavailable — falls back to the default-on state.
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(WEBP_IMAGES_STORAGE_KEY, String(webpImages));
    } catch {
      // Storage unavailable; checkbox still works for this page load.
    }
  }, [hydrated, webpImages]);

  // Self-heals a checked-but-disabled checkbox: useLive is restored from
  // storage regardless of whether a Live URL is still configured, so clearing
  // the Live field after previously checking it would otherwise leave the
  // checkbox stuck checked with no way to uncheck it (it's disabled whenever
  // there's no URL for it to point at).
  useEffect(() => {
    if (!settings.liveSiteUrl && useLive) {
      setUseLive(false);
    }
  }, [settings.liveSiteUrl, useLive]);

  // Same restore/persist pattern again — a Rebuild Page preference, not
  // session-transient state.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(FORM_HANDLING_STORAGE_KEY);
      if (stored === "keep" || stored === "rebuild-cf7" || stored === "rebuild-elementor-pro") {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setFormHandling(stored);
      }
    } catch {
      // Storage unavailable — falls back to "keep".
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(FORM_HANDLING_STORAGE_KEY, formHandling);
    } catch {
      // Storage unavailable; option still works for this page load.
    }
  }, [hydrated, formHandling]);

  // Declared last on purpose — effects run in declaration order, so this flips
  // only after every restore effect above has read localStorage.
  //
  // Without it, each persist effect fires on the very first render (with the
  // defaults still in state, since a restore's setState hasn't landed yet) and
  // overwrites storage with those defaults. Under StrictMode's double-invoke
  // the restore effects then run a second time, re-read the defaults they were
  // just clobbered with, and the real values are gone for good. Verified under
  // `next dev`, which is how this app is always run; a production build may
  // self-correct on the following render, but that hasn't been checked and
  // shouldn't be relied on.
  //
  // Only the unconditional writers actually needed this: the ones that call
  // removeItem() when their value is empty (sessionId, currentAction,
  // lastReviewSlug) happen to survive, because the second restore pass reads
  // *nothing* and its `if (stored)` guard correctly declines to overwrite.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHydrated(true);
  }, []);

  function builderLabel(): string {
    return builder === "elementor" ? (elementorPro ? "Elementor Pro" : "Elementor") : "Gutenberg";
  }

  function seoPluginLabel(): string {
    return seoPlugin === "yoast" ? "Yoast SEO" : "RankMath";
  }

  function buildStackContext(): string {
    const activePlugins = PLUGIN_OPTIONS.filter((option) => plugins[option.key]).map(
      (option) => option.label
    );
    const pluginsLine =
      activePlugins.length > 0 ? ` Active plugins: ${activePlugins.join(", ")}.` : "";
    const formsLine =
      builder === "elementor" && elementorPro
        ? " Forms: Elementor Pro's Form widget with a Honeypot field."
        : " Forms: Contact Form 7 + CFDB7 (Elementor Pro not selected).";
    return `This WordPress site uses ${builderLabel()} as the page builder.${pluginsLine} SEO plugin: ${seoPluginLabel()}.${formsLine}`;
  }

  function baseReplacements(): Record<string, string> {
    return {
      siteDir: settings.siteDir || "(not set)",
      siteUrl: settings.siteUrl || "(not set)",
      wpSiteDir: settings.wpSiteDir || "(not set)",
      wpSiteUrl: settings.wpSiteUrl || "(not set)",
      builder: builderLabel(),
      seoPlugin: seoPluginLabel(),
    };
  }

  // Used only by the review buttons (Review UI/Accessibility/Performance/
  // Best Practices/SEO/Cache/!Important) — never Analyze/Build/Change/
  // Continue/Prompt/Images, which always mean the local dev build. When
  // "Live" is checked and a live URL
  // is set, points {{wpSiteUrl}} at the deployed site so the review sees
  // real-world behavior, while {{wpSiteDir}} stays the local codebase
  // (fixes always land there, never on the live server itself — there's no
  // credential-based access to it from here). liveReviewNote carries that
  // caveat into the prompt text itself; it's "" (and vanishes) otherwise.
  function liveAwareReplacements(): Record<string, string> {
    const base = baseReplacements();
    if (!useLive || !settings.liveSiteUrl) {
      return { ...base, liveReviewNote: "" };
    }
    return {
      ...base,
      wpSiteUrl: settings.liveSiteUrl,
      liveReviewNote:
        `**Live review note:** the site being inspected above (${settings.liveSiteUrl}) is the ` +
        `LIVE deployed copy, not the local dev build — used here only to see its current ` +
        `real-world behavior. Any fixes for what's found still belong in the local codebase at ` +
        `${settings.wpSiteDir || "(not set)"}; never attempt to edit files or run wp-cli/database ` +
        `commands against the live server directly, since there's no credential-based access to it ` +
        `from here. A fix made locally will not automatically appear on the live site — that ` +
        `requires a separate migration/redeploy step handled outside this review, so note in the ` +
        `final report that each finding won't actually be resolved live until that happens.` +
        (settings.liveSiteIsTemporary
          ? `\n\n**Temporary deployment:** ${settings.liveSiteUrl} is a staging/temporary host, ` +
            `NOT the final production domain. Judge anything domain- or launch-dependent against ` +
            `that. Indexability inverts here: an indexed throwaway domain competes with the real ` +
            `one and needs redirect cleanup later, so being crawlable is worth raising, and a ` +
            `sitewide noindex on this host is correct and must never be reported as a defect. ` +
            `But report indexability as the user's decision, not a fix to apply: the right ` +
            `setting depends on timing they own — crawlable while the site is actively being ` +
            `audited (a noindex floors the SEO score and makes those runs meaningless), noindex ` +
            `once it goes quiet — and \`blog_public\`/sitemap settings live in the database, so ` +
            `they travel to production on the next migration and have to be reversed at launch. ` +
            `Treat HTTPS/SSL, canonical domain and email-domain questions as belonging to the ` +
            `final domain, not to this one.`
          : ""),
    };
  }

  async function handleAnalyze() {
    // Just fills the textarea for review/editing — handleSend (below) already
    // prepends the stack context on a new session, whether the text came
    // from typing or from this prefill.
    setSkipStackContext(false);
    setCurrentAction("Analyze");
    const template = await fetchPromptTemplate("analyze");
    setInputText(substituteTemplate(template, baseReplacements()));
  }

  /**
   * Which report(s) on disk the currently-active task is working from, based
   * on whichever button last set currentAction/lastReviewSlug/lastAnalyzeSlug
   * — sent to the server alongside a real Build/Change/Create message so a
   * later auto-resume knows what to re-read, and used directly by Continue
   * (below) to show the same thing before sending. Undefined for anything
   * else (Analyze, Prompt, Rebuild Page, a review in progress) — there's no
   * single settled report file to point at mid-task for those.
   */
  function activeReportContext(): { label: string; reportSlugs: string[] } | undefined {
    if (currentAction === "Build") return { label: "Build", reportSlugs: ["analyze"] };
    if (currentAction === "Change" && lastReviewSlug) {
      return { label: "Change", reportSlugs: [lastReviewSlug] };
    }
    if (currentAction === "Create" && lastAnalyzeSlug) {
      return { label: "Create", reportSlugs: [lastAnalyzeSlug] };
    }
    return undefined;
  }

  async function handleContinue() {
    // A nudge for a session that's paused (e.g. mid rate-limit wait) rather
    // than a new task — same fill-the-textarea pattern as the other
    // buttons. Safe to reuse even if sessionId was somehow lost:
    // getOrCreateSessionForCwd (server-side) reconnects to whatever's
    // already live for this cwd instead of starting a duplicate.
    setSkipStackContext(false);
    const template = await fetchPromptTemplate("continue");
    const context = activeReportContext();
    const sections: ContextReportSection[] = [];
    if (context && cwd) {
      for (const slug of context.reportSlugs) {
        const found = await fetchOnDiskReport(cwd, slug);
        if (found?.report) sections.push({ slug, content: found.report });
      }
    }
    const contextReport = context ? formatContinueContextBlock(context.label, sections) : "";
    setInputText(substituteTemplate(template, { ...baseReplacements(), contextReport }));
  }

  async function handleCustomPrompt() {
    // Ad-hoc escape hatch for one-off instructions — edit prompts/custom-prompt.md
    // directly, then use this to load it in. Same fill-the-textarea pattern as
    // handleAnalyze, and no session reset: unlike Review UI, there's no reason a
    // custom prompt should force a fresh session.
    setSkipStackContext(false);
    setCurrentAction("Prompt");
    const template = await fetchPromptTemplate("custom-prompt");
    setInputText(substituteTemplate(template, baseReplacements()));
  }

  /**
   * Every review button does the same four things — fresh session, set the
   * label, remember the slug for Change, fill the textarea. Only the slug,
   * label, and whether the Live checkbox applies actually differ.
   */
  async function stageReview(slug: string, label: string, replacements: Record<string, string>) {
    resetSession();
    setCurrentAction(label);
    setLastReviewSlug(slug);
    const template = await fetchPromptTemplate(slug);
    setInputText(substituteTemplate(template, replacements));
  }

  async function handleReviewUi() {
    // Starts a fresh session — Review UI is meant to grade the build with
    // fresh eyes, not from inside the same context that just did (and is
    // inclined to rubber-stamp) the build itself.
    await stageReview("review-ui", "Review: UI", liveAwareReplacements());
  }

  async function handleReviewPage() {
    // Scoped to one page — needs both the design-side path (Site → Page) and
    // the WP-side slug (WP site → Slug) to know which two pages to diff;
    // review-page.md itself stops and asks rather than guessing if either is
    // blank, same guard pattern as Rebuild Page / Analyze Page / Create.
    await stageReview("review-page", "Review: Page", {
      ...liveAwareReplacements(),
      designPagePath: settings.rebuildPageUrl,
      newPageSlug: settings.newPageSlug,
    });
  }

  async function handleReviewHeaderFooter() {
    // Same reasoning as Review UI, but scoped to just the header/footer — a
    // faster, narrower numeric audit (container width + computed text styles
    // + a font/color source-of-truth check) rather than a full per-page
    // screenshot pass, since those two components are shared across every
    // page and only need checking once.
    await stageReview("review-header-footer", "Review: Header/Footer", liveAwareReplacements());
  }

  async function handleReviewAccessibility() {
    // Same reasoning as Review UI: a fresh session grades the rebuild
    // against WCAG independently, rather than continuing inside whatever
    // context just built or last touched it.
    await stageReview("review-accessibility", "Review: Accessibility", liveAwareReplacements());
  }

  async function handleReviewPerformance() {
    // Same reasoning as Review UI/Accessibility: a fresh session grades the
    // rebuild's real-world performance independently, rather than continuing
    // inside whatever context just built or last touched it.
    await stageReview("review-performance", "Review: Performance", liveAwareReplacements());
  }

  async function handleReviewBestPractices() {
    // Same reasoning as the other review buttons: a fresh session grades
    // general web/WordPress hygiene independently, rather than continuing
    // inside whatever context just built or last touched it.
    await stageReview("review-best-practices", "Review: Best Practices", liveAwareReplacements());
  }

  async function handleReviewSeo() {
    // Same reasoning as the other review buttons: a fresh session grades
    // SEO/semantic HTML independently, rather than continuing inside
    // whatever context just built or last touched it.
    await stageReview("review-seo", "Review: SEO", liveAwareReplacements());
  }

  async function handleReviewCache() {
    // Same reasoning as the other review buttons: a fresh session grades
    // caching configuration independently, rather than continuing inside
    // whatever context just built or last touched it. Report-only, like the
    // rest of this family — Change (not this button) does the actual fixing.
    await stageReview("review-cache", "Review: Cache", liveAwareReplacements());
  }

  async function handleReviewImportant() {
    // Same reasoning as the other review buttons: a fresh session grades
    // CSS !important overuse independently, rather than continuing inside
    // whatever context just built or last touched it. Report-only, like the
    // rest of this family — Change (not this button) does the actual fixing.
    await stageReview("review-important", "Review: !Important", liveAwareReplacements());
  }

  async function handleReviewTheme() {
    // Same reasoning as the other review buttons: a fresh session grades the
    // theme's own PHP/CSS code quality independently. Always the local
    // codebase — PHP source can't be inspected from a live URL with no
    // server access, so baseReplacements (not liveAwareReplacements) is
    // correct; the Live checkbox has no effect on this one.
    await stageReview("review-theme", "Review: Theme", baseReplacements());
  }

  async function handleReviewPreMigration() {
    // Same reasoning as the other review buttons: a fresh session grades
    // pre-migration readiness independently. Always the local codebase —
    // there's nothing live to check here, so baseReplacements (not
    // liveAwareReplacements) is correct; the Live checkbox has no effect on
    // this one.
    await stageReview("review-pre-migration", "Review: Pre-Migration", baseReplacements());
  }

  /** Concatenates assistant text since the last user message — "the plan". */
  function getLastAssistantResponse(): string {
    const texts: string[] = [];
    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i];
      if (item.kind === "user") break;
      if (item.kind === "assistant") texts.unshift(item.text);
    }
    return texts.join("\n\n");
  }

  async function handleInstall() {
    // Same fill-the-textarea pattern as handleAnalyze — reviewable/editable
    // before it's actually sent.
    setSkipStackContext(true);
    setCurrentAction("Install Site");
    const template = await fetchPromptTemplate("install");
    setInputText(
      substituteTemplate(template, {
        ...baseReplacements(),
        frontendPort,
        serverPort,
      })
    );
  }

  /**
   * A full instruction sentence, not a bare code — the prompt just drops this
   * in verbatim rather than branching on an enum value itself. Guards against
   * a stale persisted "rebuild-elementor-pro" choice: if the user has since
   * switched Build Options away from Elementor Pro, this falls back to the
   * CF7 rebuild instruction instead of asking for a widget that isn't even
   * the selected builder.
   */
  function formHandlingInstruction(): string {
    if (formHandling === "rebuild-elementor-pro" && builder === "elementor" && elementorPro) {
      return "Rebuild the form as a native Elementor Pro Form widget instead of embedding the CF7 shortcode — recreate its fields, labels, and validation to match the original form, styled to match this site's existing forms.";
    }
    if (formHandling === "rebuild-cf7") {
      return `Rebuild the imported CF7 form to match ${settings.wpSiteUrl || "the target site"}'s own existing CF7 form conventions (field markup/classes/styling) rather than assuming the imported form's structure already fits in as-is.`;
    }
    return "Leave the form as the CF7 form SE Page Transfer already recreated — just wire its shortcode into the rebuilt layout, no further rebuild needed.";
  }

  async function handleRebuildPage() {
    // Fresh session — this is a standalone, self-contained task (site +
    // page URL fully specify what to do), not a continuation of anything
    // already in the conversation, so there's no reason to carry over
    // whatever context was active before. skipStackContext stays false
    // (unlike Install Site): this genuinely needs the builder/plugins stack
    // context, since the whole point is building in {{builder}} on the WP site.
    resetSession();
    setCurrentAction("Rebuild Page");
    const template = await fetchPromptTemplate("rebuild-page");
    setInputText(
      substituteTemplate(template, {
        ...baseReplacements(),
        // Raw values, empty string if unset — no fallback message baked in
        // here. rebuild-page.md's own instructions are what tell the agent
        // what to do about a blank one, not this substitution step.
        pageUrl: settings.rebuildPageUrl,
        bundleZipPath: settings.rebuildBundleZipPath,
        formHandling: formHandlingInstruction(),
      })
    );
  }

  const GLOBAL_PLAN_FALLBACK = "(no plan found — send an Analyze prompt first and wait for a response)";

  /** Shared by the scoped Analyze buttons and Create — the whole-site Analyze
   * report, when one exists, so a scoped pass can reuse its design-system
   * values instead of re-deriving its own. */
  async function fetchGlobalPlan(): Promise<string> {
    const fromDisk = cwd ? await fetchOnDiskReport(cwd, "analyze") : null;
    return fromDisk?.report || GLOBAL_PLAN_FALLBACK;
  }

  const ANALYZE_SCOPE_LABELS: Record<string, string> = {
    "analyze-page": "Page",
    "analyze-header": "Header",
    "analyze-footer": "Footer",
    "analyze-menu": "Menu",
    "analyze-shop": "Shop",
    "analyze-product": "Product",
    "analyze-global-styles": "Global Styles",
  };

  /**
   * Every scoped Analyze button (Page/Header/Footer/Menu/Shop/Product) does
   * the same things as stageReview above — fresh session, set the label,
   * remember the slug (here for Create, not Change), fill the textarea —
   * plus threads through the whole-site plan, if one exists, for shared
   * design-system context.
   */
  async function stageAnalyzeScope(
    slug: string,
    label: string,
    extraReplacements: Record<string, string> = {}
  ) {
    resetSession();
    setCurrentAction(label);
    setLastAnalyzeSlug(slug);
    const plan = await fetchGlobalPlan();
    const template = await fetchPromptTemplate(slug);
    setInputText(substituteTemplate(template, { ...baseReplacements(), plan, ...extraReplacements }));
  }

  async function handleAnalyzePage() {
    await stageAnalyzeScope("analyze-page", "Analyze: Page", {
      designPagePath: settings.rebuildPageUrl,
    });
  }

  async function handleAnalyzeHeader() {
    await stageAnalyzeScope("analyze-header", "Analyze: Header");
  }

  async function handleAnalyzeFooter() {
    await stageAnalyzeScope("analyze-footer", "Analyze: Footer");
  }

  async function handleAnalyzeMenu() {
    await stageAnalyzeScope("analyze-menu", "Analyze: Menu");
  }

  async function handleAnalyzeShop() {
    await stageAnalyzeScope("analyze-shop", "Analyze: Shop", {
      designPagePath: settings.rebuildPageUrl,
    });
  }

  async function handleAnalyzeProduct() {
    await stageAnalyzeScope("analyze-product", "Analyze: Product", {
      designPagePath: settings.rebuildPageUrl,
    });
  }

  async function handleAnalyzeGlobalStyles() {
    await stageAnalyzeScope("analyze-global-styles", "Analyze: Global Styles");
  }

  /**
   * A full instruction sentence, not a bare flag — create.md just drops this
   * in verbatim rather than branching on a boolean itself, the same pattern
   * as formHandlingInstruction() above. Only meaningfully read by the
   * Page/Header/Footer branches; Menu and Global Styles ignore it (there's
   * no per-widget color/font choice to make in either).
   */
  function selfStylesInstruction(): string {
    if (selfStylesOnly) {
      return (
        "Self Styles is on: use only local, literal values on each widget's own Style tab — do not link any " +
        "control to the Kit's Global Colors/Fonts, and do not apply any of the Kit's Custom CSS button/text-link " +
        "classes either, even if a matching one already exists. This build must stand entirely on its own, " +
        "unaffected by any later change to the Kit."
      );
    }
    return (
      "Check the Kit's Global Colors/Fonts (Site Settings) first: if a value the analysis calls for already " +
      "exists there (most likely if a \"Global Styles\" Create has already run), link the widget's control to " +
      "that global rather than typing the same literal value in locally — that's what makes it a real, reusable " +
      "design system instead of the same value duplicated on every widget that happens to use it. Only fall back " +
      "to a plain literal value on the widget's own Style tab if no matching Kit global exists yet. Same idea for " +
      "a button/text-link variant that isn't the Theme Style default: if a matching Custom CSS class already " +
      "exists on the Kit (from a prior \"Global Styles\" Create), apply it via the widget's own Advanced → CSS " +
      "Classes field instead of re-styling that variant's padding/radius/border from scratch."
    );
  }

  /** Page scope only — same full-instruction-sentence pattern as
   * selfStylesInstruction() above. */
  function pageTemplateInstruction(): string {
    if (canvasTemplate) {
      return (
        "no header/footer, just the page — it stands alone. If {{builder}} is Elementor, set the page's template " +
        "(Page Attributes, or `_wp_page_template` postmeta) to **Elementor Canvas**, a blank template with no " +
        "header, footer, or sidebar. If {{builder}} is Gutenberg, use whatever blank/no-header-footer template " +
        "the active theme provides; if none exists, stop and report that rather than approximating it with CSS."
      );
    }
    return (
      "the theme's own **Default Template** (Page Attributes, or an empty/`default` `_wp_page_template` " +
      "postmeta) — the page renders wrapped in whatever header/footer is currently active on the site, even if " +
      "that's not yet the new design's own Header/Footer. Don't switch it to Canvas or any other blank template."
    );
  }

  /** Full-instruction-sentence pattern again — read by Page/Header/Footer,
   * wherever a Create pass uploads a new image to the Media Library. */
  function webpInstruction(): string {
    if (!webpImages) {
      return (
        "WebP conversion is off for this build — upload each new image in whatever format the source file is " +
        "already in (don't convert it)."
      );
    }
    return (
      "Convert every new raster image (photo, decorative asset — not an SVG, which stays as-is) to WebP before " +
      "adding it to the Media Library, rather than uploading it in whatever format the source file came in. " +
      "First confirm the site actually supports WebP output: `wp eval 'var_export(wp_image_editor_supports([" +
      "\"mime_type\" => \"image/webp\"]));' --path={{wpSiteDir}}/public-html`. If that's false, the site's PHP " +
      "image library needs a WebP-capable extension — check `wp eval 'var_export(extension_loaded(\"imagick\") " +
      "|| (extension_loaded(\"gd\") && function_exists(\"imagewebp\")));'` to see what's actually missing, then " +
      "install it inside whichever container actually serves PHP for {{wpSiteDir}} (check its OS first — " +
      "`cat /etc/os-release` — since the package name/manager differs: `apt-get install -y php-imagick` on " +
      "Debian/Ubuntu, `apk add php83-imagick` — adjust the PHP version segment to match — on Alpine), then " +
      "restart that container's PHP process (`apache2ctl graceful`, or restarting the php-fpm/apache service, " +
      "whichever applies) so the newly-installed extension actually loads, and re-run the `wp_image_editor_supports` " +
      "check above to confirm before proceeding. Note which container needed it and what got installed in the " +
      "final report — this is a one-time environment fix, not something to redo on every future Create. Convert " +
      "using WordPress's own image editor abstraction (`wp_get_image_editor()` → `set_quality(82)` → " +
      "`save($new_path, 'image/webp')`), not a shelled-out tool — that's what correctly handles EXIF orientation " +
      "and memory limits the same way core's own thumbnail generation does. After swapping the attachment's file " +
      "(`update_attached_file()`, `post_mime_type` → `image/webp`, `wp_generate_attachment_metadata()` + " +
      "`wp_update_attachment_metadata()` to regenerate every registered size from the new original, then delete " +
      "the old format's original + derivative files), double-check the uploading widget's own settings for a " +
      "**literal baked-in URL** (not just an attachment id) still pointing at the old filename/extension — " +
      "Elementor's Image widget stores both `id` and `url` on save, and renders from the stored `url` directly " +
      "without re-resolving it from the id, so the old (now-deleted) file's URL has to be updated explicitly or " +
      "the image silently breaks."
    );
  }

  async function handleCreate() {
    // Same relationship as Change → the review family: one common button
    // that builds from whichever scoped Analyze last ran, read off disk
    // (falling back to the chat transcript) rather than requiring the same
    // session that produced it. No resetSession — this is meant to run right
    // after its Analyze, picking up that context rather than starting over.
    const fromDisk = cwd && lastAnalyzeSlug ? await fetchOnDiskReport(cwd, lastAnalyzeSlug) : null;
    const analysisReport = fromDisk?.report || getLastAssistantResponse();
    const scope = lastAnalyzeSlug ? (ANALYZE_SCOPE_LABELS[lastAnalyzeSlug] ?? lastAnalyzeSlug) : "(unspecified)";
    setSkipStackContext(false);
    setCurrentAction("Create");
    const template = await fetchPromptTemplate("create");
    setInputText(
      substituteTemplate(template, {
        ...baseReplacements(),
        scope,
        // No separate global plan here — the scoped Analyze that produced
        // analysisReport already folded in whatever whole-site tokens
        // existed when it ran (see analyze-page.md etc.), so re-injecting
        // the (much larger) whole-site report on top would just be dead
        // weight on every Create turn.
        analysisReport:
          analysisReport ||
          "(no analysis found — run Analyze: Page/Header/Footer/Menu/Shop/Product/Global Styles first and wait for a response)",
        // Raw values, empty string if unset — create.md's own Page-scope
        // branch is what tells the agent what to do about a blank one.
        // newPageSlug is genuinely optional (blank = let WordPress auto-slug
        // the title), unlike the other two.
        newPageName: settings.newPageName,
        designPagePath: settings.rebuildPageUrl,
        newPageSlug: settings.newPageSlug,
        selfStylesInstruction: selfStylesInstruction(),
        pageTemplateInstruction: pageTemplateInstruction(),
        webpInstruction: webpInstruction(),
      })
    );
  }

  async function handleFixPermalinks() {
    // Mechanical, not agentic: the WordPress rewrite block is a fixed,
    // known shape (see wp-admin's save_mod_rewrite_rules()), so this hits a
    // plain API route that reads/writes .htaccess directly rather than
    // spending an agent turn on something with no judgment call in it.
    if (!settings.wpSiteDir) return;
    setFixingPermalinks(true);
    setPermalinkFixStatus(null);
    try {
      const res = await fetch("/api/fs/fix-permalinks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wpSiteDir: settings.wpSiteDir }),
      });
      const data = await res.json();
      setPermalinkFixStatus(data.message || data.error || "Unexpected response.");
    } catch (err) {
      setPermalinkFixStatus(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setFixingPermalinks(false);
    }
  }

  async function handleCreatePrompt() {
    // Prefer the plan Analyze wrote to disk over the chat transcript — same
    // reasoning as Change: resetSession() (a closed tab, a New Chat) clears
    // `items`, but analyze.md's own closing instruction is to keep
    // analyze-report.md in sync with whatever the final, discussed plan
    // actually is, including any follow-up clarifications after the initial
    // draft. Reading the transcript instead would risk picking up the first
    // draft rather than the version actually agreed on.
    //
    // Still falls back to the transcript rather than replacing it: an Analyze
    // that errored before writing its file, or one run before this existed,
    // should keep working the way it always did.
    const fromDisk = cwd ? await fetchOnDiskReport(cwd, "analyze") : null;
    const plan = fromDisk?.report || getLastAssistantResponse();
    const replacements = {
      ...baseReplacements(),
      plan: plan || "(no plan found — send an Analyze prompt first and wait for a response)",
    };
    setSkipStackContext(false);
    setCurrentAction("Build");
    const template = await fetchPromptTemplate("build");
    setInputText(substituteTemplate(template, replacements));
  }

  async function handleCreateChangePrompt() {
    // Prefer the report the last review wrote to disk over the chat
    // transcript. The transcript is the fragile source: resetSession() clears
    // it (so does closing the tab), and it's whatever the agent happened to
    // say since the last user message — trailing chatter included, and a
    // report split across messages glued back together. The saved file is the
    // one every review prompt promises is "complete, standalone".
    //
    // Still falls back to the transcript rather than replacing it: a review
    // that errored before writing its file, or one run before this existed,
    // should keep working the way it always did.
    const fromDisk = cwd && lastReviewSlug ? await fetchOnDiskReport(cwd, lastReviewSlug) : null;
    const reviewReport = fromDisk?.report || getLastAssistantResponse();
    const replacements = {
      ...baseReplacements(),
      reviewReport:
        reviewReport ||
        "(no report found — send a Review UI or Accessibility prompt first and wait for a response)",
    };
    setSkipStackContext(false);
    setCurrentAction("Change");
    const template = await fetchPromptTemplate("change");
    setInputText(substituteTemplate(template, replacements));
  }

  async function handleWebpScan() {
    // A plain member of the Review family now: report-only, and the conversion
    // it lists is the following Change run like any other review's fixes.
    // baseReplacements (not liveAwareReplacements) on purpose — Images always
    // means the local build, since converting files on the live host isn't
    // something this project ever does.
    await stageReview("review-images", "Review: Images", baseReplacements());
  }

  function handleOutboundEvent(message: Record<string, unknown>) {
    // Replayed history (e.g. resent to catch up a reconnected EventSource —
    // React's dev-mode double-effect mount is one way this happens) carries
    // the same `type` as a live message, distinguished only by `isReplay`.
    // These are messages we've already rendered/accounted for; treating them
    // as new activity would re-append duplicate chat items and, worse, could
    // falsely revive the "working" indicator and timer for a turn that's
    // actually long since finished.
    if (message.isReplay === true) return;

    // The SDK can keep producing messages after a "result" we already treated
    // as the turn ending (e.g. a rate-limit pause that auto-resumes, or a
    // background task continuing) — if that happens, resume the working
    // indicator and timer instead of leaving them stuck in the "done" state
    // while activity is clearly still happening.
    function resumeWorkingIfStopped() {
      if (!working) {
        setWorking(true);
        onTurnStart();
      }
      // Real activity is proof the session recovered — a "rejected" banner
      // left over from before would otherwise sit there forever (nothing
      // else ever clears it), both misleading the user into thinking it's
      // still waiting on a reset that already happened, and permanently
      // blocking the pagehide cleanup below from ever closing this session
      // again even long after it's genuinely done.
      setRateLimitInfo((prev) => (prev?.status === "rejected" ? null : prev));
    }

    if (message.type === "assistant") {
      resumeWorkingIfStopped();
      setLiveStatus(null);
      const inner = message.message as
        | { content?: Array<Record<string, unknown>>; model?: string }
        | undefined;
      if (typeof inner?.model === "string") {
        setCurrentModel(inner.model);
      }
      const blocks = inner?.content ?? [];
      for (const block of blocks) {
        if (block.type === "text" && typeof block.text === "string") {
          setItems((prev) => [...prev, { id: nextId(), kind: "assistant", text: block.text as string }]);
        } else if (block.type === "tool_use") {
          setItems((prev) => [
            ...prev,
            {
              id: nextId(),
              kind: "tool_use",
              toolUseId: block.id as string,
              name: block.name as string,
              input: block.input,
            },
          ]);
        }
      }
      return;
    }

    if (message.type === "user") {
      resumeWorkingIfStopped();
      setLiveStatus(null);
      const inner = message.message as { content?: unknown } | undefined;
      const blocks = inner?.content;
      if (Array.isArray(blocks)) {
        for (const block of blocks) {
          if (block?.type === "tool_result") {
            setItems((prev) => [
              ...prev,
              { id: nextId(), kind: "tool_result", preview: summarizeToolResultContent(block.content) },
            ]);
          }
        }
      }
      return;
    }

    if (message.type === "result") {
      setWorking(false);
      setLiveStatus(null);
      const costUsd = message.total_cost_usd as number | undefined;
      if (typeof costUsd === "number") {
        setTotalCostUsd((prev) => prev + costUsd);
      }
      const durationMs = message.duration_ms as number | undefined;
      onTurnComplete(durationMs);
      // A failed turn (the subprocess dying, out of usage credits, ...) used to
      // render as an ordinary turn_complete — indistinguishable from the AI
      // just silently not answering. Show the actual reason.
      const errorText =
        message.is_error === true && typeof message.result === "string" && message.result
          ? message.result
          : null;
      setItems((prev) => [
        ...prev,
        ...(errorText ? [{ id: nextId(), kind: "error" as const, text: errorText }] : []),
        {
          id: nextId(),
          kind: "turn_complete",
          costUsd,
          durationMs,
        },
      ]);
      return;
    }

    if (message.type === "rate_limit_event") {
      const info = message.rate_limit_info as
        | { status?: string; rateLimitType?: string; resetsAt?: number }
        | undefined;
      if (info?.status && info.rateLimitType && typeof info.resetsAt === "number") {
        setRateLimitInfo({
          status: info.status,
          rateLimitType: info.rateLimitType,
          resetsAt: info.resetsAt,
        });
      }
      return;
    }

    if (message.type === "tool_progress") {
      const toolUseId = message.tool_use_id as string;
      const elapsedSeconds = message.elapsed_time_seconds as number;
      setItems((prev) =>
        prev.map((item) =>
          item.kind === "tool_use" && item.toolUseId === toolUseId
            ? { ...item, elapsedSeconds }
            : item
        )
      );
      return;
    }

    if (message.type === "system" && message.subtype === "status") {
      resumeWorkingIfStopped();
      const status = message.status as "compacting" | "requesting" | null;
      setLiveStatus(
        status === "compacting"
          ? "Compacting conversation…"
          : status === "requesting"
            ? "Waiting for Claude…"
            : null
      );
      return;
    }

    if (message.type === "system" && message.subtype === "thinking_tokens") {
      resumeWorkingIfStopped();
      const estimatedTokens = message.estimated_tokens as number;
      setLiveStatus(`Thinking… (~${estimatedTokens} tokens)`);
      return;
    }

    if (message.type === "system" && message.subtype === "model_refusal_fallback") {
      // The primary model refused the turn (stop_reason "refusal") and the CLI silently retried
      // it on a fallback model — permanently, for the rest of this session. Without surfacing
      // this, the model just appears to have unexplainably switched (e.g. "Change" consistently
      // ending up on Opus even when Sonnet was picked and correctly used for the prior Review)
      // with no way to tell a refusal-triggered swap apart from a plain misconfiguration.
      resumeWorkingIfStopped();
      setCurrentModel(message.fallback_model as string);
      setItems((prev) => [
        ...prev,
        {
          id: nextId(),
          kind: "model_refusal_fallback",
          originalModel: message.original_model as string,
          fallbackModel: message.fallback_model as string,
        },
      ]);
      return;
    }

    if (message.type === "system" && message.subtype === "auto_resume") {
      // Server-triggered — no browser ever typed or POSTed this, so unlike a
      // real user message it has no local echo anywhere. Without rendering
      // this explicitly, a working auto-resume and a silently-stuck one look
      // identical from the chat transcript alone.
      resumeWorkingIfStopped();
      setLiveStatus(null);
      setItems((prev) => [
        ...prev,
        { id: nextId(), kind: "auto_resume", text: message.text as string },
      ]);
      return;
    }
    // Other system subtypes (init, task_*, hook_*, etc.) are ignored for now.
  }

  const handleOutboundEventRef = useRef(handleOutboundEvent);
  useEffect(() => {
    handleOutboundEventRef.current = handleOutboundEvent;
  });

  useEffect(() => {
    if (!sessionId) return;
    const es = new EventSource(`/api/chat/session/${sessionId}/events`);

    es.onmessage = (event) => {
      handleOutboundEventRef.current(JSON.parse(event.data));
    };

    // A 404 (session no longer exists — e.g. a stale id restored from
    // localStorage after the server was restarted) fails the connection
    // outright per spec, with no browser auto-retry: readyState lands on
    // CLOSED rather than CONNECTING. Fall back to a fresh session instead of
    // sitting on a dead sessionId with nothing ever arriving.
    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) {
        setSessionId(null);
      }
    };

    return () => {
      es.close();
    };
  }, [sessionId]);

  // Closes the session's Claude Code process when the tab is actually going
  // away (close, refresh, navigation) — not on a mere tab-switch/minimize,
  // which only changes visibility. sendBeacon (not fetch) is what's reliable
  // here: browsers can and do cancel an in-flight fetch once the page starts
  // unloading, but sendBeacon is specifically designed to still go through.
  // Skipped while a turn is actively running (`working`) — a refresh mid-Build
  // shouldn't silently kill it; this only cleans up genuinely idle/abandoned
  // sessions. Also skipped when a rate-limit rejection is pending: `working`
  // goes false the moment the SDK reports "rejected" (the turn technically
  // ends), but the server has a wakeTimer scheduled to auto-resume once the
  // limit resets — closing here would destroy that timer via closeSession(),
  // silently canceling the auto-resume for what looks idle but isn't.
  // `working`/`rateLimitInfo` are in the deps so the closure always sees the
  // latest values, not whatever they were when the listener was first
  // attached.
  useEffect(() => {
    function handlePageHide() {
      if (sessionId && !working && rateLimitInfo?.status !== "rejected") {
        navigator.sendBeacon(`/api/chat/session/${sessionId}/close`);
      }
    }
    window.addEventListener("pagehide", handlePageHide);
    return () => window.removeEventListener("pagehide", handlePageHide);
  }, [sessionId, working, rateLimitInfo]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [items]);

  // No client-side auto-resume. The server (lib/chat-sessions.ts) owns it
  // entirely: at the badge's own reset time it sends the same prompts/continue.md
  // the Continue button stages, which is exactly "click Continue, then Send".
  // Doing it from here as well meant two independent timers racing over one
  // rejection, each needing to know what the other had already done — all of
  // which disappears with a single scheduler. This tab now only renders what
  // the server reports.

  async function ensureSession(): Promise<string | null> {
    if (!cwd) return null;
    // Always asks the server which session is actually live for this cwd —
    // never just trusts a cached sessionId, since a cached id can itself be
    // wrong (e.g. a stray session created while this one was briefly out of
    // sync). getOrCreateSessionForCwd (server-side) resolves to whichever
    // session is genuinely live, creating one only if none is. Only treat it
    // as switching sessions (clearing the displayed history) if the
    // resolved id actually differs from what we already had — otherwise
    // this would wipe the chat on every single message.
    setStarting(true);
    // Failing to start used to just return null, so Send silently did nothing.
    // The typed message stays in the input box (sendText bails before clearing
    // it), so the user can fix the problem and press Send again.
    const showError = (text: string) =>
      setItems((prev) => [...prev, { id: nextId(), kind: "error", text }]);
    try {
      const res = await fetch("/api/chat/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cwd, model: settings.model, apiKey: settings.apiKey }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.sessionId) {
        if (data.sessionId !== sessionId) {
          setItems([]);
          setSessionId(data.sessionId);
        }
        return data.sessionId as string;
      }
      showError(
        typeof data.error === "string"
          ? data.error
          : `Couldn't start a chat session (HTTP ${res.status}).`
      );
      return null;
    } catch (error) {
      showError(
        `Couldn't reach the server to start a chat session: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return null;
    } finally {
      setStarting(false);
    }
  }

  async function handlePaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    const files = Array.from(e.clipboardData.items)
      .filter((item) => ALLOWED_IMAGE_TYPES.has(item.type))
      .map((item) => item.getAsFile())
      .filter((file): file is File => file !== null);
    if (files.length === 0) return;
    e.preventDefault();
    const images = await Promise.all(files.map(fileToPendingImage));
    setPendingImages((prev) => [...prev, ...images]);
  }

  function removePendingImage(id: string) {
    setPendingImages((prev) => prev.filter((image) => image.id !== id));
  }

  async function sendText(text: string, images: PendingImage[] = []) {
    if (!text && images.length === 0) return;
    const isNewSession = !sessionId;
    const id = await ensureSession();
    if (!id) return;
    setItems((prev) => [
      ...prev,
      { id: nextId(), kind: "user", text, images: images.map((image) => image.dataUrl) },
    ]);
    setInputText("");
    setPendingImages([]);
    setWorking(true);
    setLiveStatus(null);
    onTurnStart();
    const payloadText =
      isNewSession && !skipStackContext ? `${buildStackContext()}\n\n${text}` : text;
    setSkipStackContext(false);
    await fetch(`/api/chat/session/${id}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: payloadText,
        images: images.map((image) => ({ mediaType: image.mediaType, data: image.data })),
        // Tells the server which report(s) this task is working from, so a
        // later auto-resume (which never goes through build.md/change.md/
        // create.md again — only continue.md) knows what to re-read fresh
        // off disk instead of trusting a generic reminder to "re-read the
        // plan" with no idea where that plan actually is.
        context: activeReportContext(),
      }),
    });
  }

  async function handleSend() {
    await sendText(inputText.trim(), pendingImages);
  }

  async function handleStop() {
    if (!sessionId) return;
    setWorking(false);
    setLiveStatus(null);
    await fetch(`/api/chat/session/${sessionId}/interrupt`, { method: "POST" });
  }

  function resetSession() {
    if (sessionId) {
      // Fire-and-forget: terminates the old session's Claude Code process
      // server-side instead of leaving it running forever with no way to
      // reach it again. Doesn't block the UI reset below.
      fetch(`/api/chat/session/${sessionId}/close`, { method: "POST" }).catch(() => {});
    }
    setSessionId(null);
    setItems([]);
    setTotalCostUsd(0);
    setRateLimitInfo(null);
    setCurrentModel(null);
    setWorking(false);
    setLiveStatus(null);
    setSkipStackContext(false);
    setCurrentAction(null);
    onPlanReset();
  }

  function handleNewChat() {
    resetSession();
  }

  return (
    <Card className="flex flex-col h-[80vh]">
      <CardHeader className="max-h-[50vh] overflow-y-auto shrink-0">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle>Agent Chat</CardTitle>
              {currentAction && (
                <Badge variant={working ? "default" : "secondary"}>
                  {working ? "Running: " : "Last: "}
                  {currentAction}
                </Badge>
              )}
            </div>
            <CardDescription>
              Runs Agent directly against your WordPress site directory (
              {settings.wpSiteDir || "not set — fill in Settings first"}).
            </CardDescription>
            <p className="text-xs text-muted-foreground mt-1">
              Working time: {formatDuration(elapsedMs)} · Session cost: ${totalCostUsd.toFixed(4)}
              {currentModel && <> · Model: {currentModel}</>}
              {rateLimitInfo && (
                <>
                  {" "}
                  · Rate limit ({rateLimitInfo.rateLimitType}): {rateLimitInfo.status}, resets{" "}
                  {/* Local time first — it's the one that answers "when does this
                      come back". UTC alongside it because the notice this is
                      derived from states UTC, and the two disagreeing with no way
                      to reconcile them is its own small confusion. */}
                  {new Date(rateLimitInfo.resetsAt * 1000).toLocaleString()}{" "}
                  <span className="opacity-70">
                    ({new Date(rateLimitInfo.resetsAt * 1000).toISOString().slice(11, 16)} UTC)
                  </span>
                  {rateLimitInfo.status === "rejected" &&
                    " — will auto-resume then"}
                </>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="secondary"
              onClick={handleContinue}
              disabled={!cwd || starting}
            >
              Continue
            </Button>
            {sessionId && (
              <Button variant="outline" onClick={handleNewChat}>
                New Chat
              </Button>
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={handleInstall}
            disabled={!cwd || starting}
          >
            Install Site
          </Button>
          <div className="flex items-center gap-1">
            <Label htmlFor="frontend-port" className="text-xs text-muted-foreground">
              Frontend port
            </Label>
            <Input
              id="frontend-port"
              type="number"
              value={frontendPort}
              onChange={(e) => setFrontendPort(e.target.value)}
              className="w-20"
            />
          </div>
          <div className="flex items-center gap-1">
            <Label htmlFor="server-port" className="text-xs text-muted-foreground">
              Server port
            </Label>
            <Input
              id="server-port"
              type="number"
              value={serverPort}
              onChange={(e) => setServerPort(e.target.value)}
              className="w-20"
            />
          </div>
          <Button
            variant="secondary"
            onClick={handleAnalyze}
            disabled={!cwd || starting}
          >
            Analyze
          </Button>
          <Button
            variant="secondary"
            onClick={handleCreatePrompt}
            disabled={!cwd || starting}
          >
            Build
          </Button>
          <Button
            variant="secondary"
            onClick={handleRebuildPage}
            disabled={!cwd || starting}
            title="Rebuilds one page from {{siteDir}}/{{siteUrl}} (a different-builder WordPress site) as a real {{builder}} page on {{wpSiteDir}}/{{wpSiteUrl}}. Uses the Page/Bundle fields in Settings — provide an already-downloaded SE Page Transfer .zip there to skip straight to upload+rebuild, or leave it blank to have the agent tell you how to get one first."
          >
            Rebuild Page
          </Button>
          <Button
            variant="outline"
            onClick={handleFixPermalinks}
            disabled={!settings.wpSiteDir || fixingPermalinks}
            title="Directly regenerates the .htaccess mod_rewrite block if it's missing/broken — a plain file fix, no agent session"
            className="ml-auto"
          >
            {fixingPermalinks ? "Fixing…" : "Fix Permalinks"}
          </Button>
        </div>

        {permalinkFixStatus && (
          <p className="mt-1 text-xs text-muted-foreground">{permalinkFixStatus}</p>
        )}

        <div className="mt-2 flex flex-wrap gap-2">
          <span className="self-center text-xs text-muted-foreground ml-1">Analyze:</span>
          <Button
            variant="secondary"
            onClick={handleAnalyzeGlobalStyles}
            disabled={!cwd || starting}
            title="Narrow, read-only investigation of the design's overall color/typography/spacing system, mapped to Elementor Kit slots — feeds Create, which then sets the site's actual Global Colors/Fonts/Theme Style (the one Create scope that isn't a separate, unassigned artifact — see its own tooltip). Makes no changes to either site."
          >
            Styles
          </Button>
          <Button
            variant="secondary"
            onClick={handleAnalyzePage}
            disabled={!cwd || starting}
            title="Narrow, read-only investigation of one design page (Settings → Site → Page) — feeds Create. Makes no changes to either site."
          >
            Page
          </Button>
          <Button
            variant="secondary"
            onClick={handleAnalyzeHeader}
            disabled={!cwd || starting}
            title="Narrow, read-only investigation of the design's header/nav chrome, plus a read-only inventory of the current WordPress header — feeds Create. Makes no changes to either site."
          >
            Header
          </Button>
          <Button
            variant="secondary"
            onClick={handleAnalyzeFooter}
            disabled={!cwd || starting}
            title="Narrow, read-only investigation of the design's footer, plus a read-only inventory of the current WordPress footer — feeds Create. Makes no changes to either site."
          >
            Footer
          </Button>
          <Button
            variant="secondary"
            onClick={handleAnalyzeMenu}
            disabled={!cwd || starting}
            title="Narrow, read-only investigation of the design's nav structure, plus a read-only inventory of the current WordPress menus — feeds Create. Makes no changes to either site."
          >
            Menu
          </Button>
          <Button
            variant="secondary"
            onClick={handleAnalyzeShop}
            disabled={!cwd || starting}
            title="Narrow, read-only investigation of the design's product-listing page (Settings → Site → Page), plus a read-only inventory of the current WordPress Shop page — feeds Create, which builds an Elementor Pro Products Archive Theme Builder template. Makes no changes to either site."
          >
            Shop
          </Button>
          <Button
            variant="secondary"
            onClick={handleAnalyzeProduct}
            disabled={!cwd || starting}
            title="Narrow, read-only investigation of the design's single-product page (Settings → Site → Page), plus a read-only inventory of the current WordPress product pages — feeds Create, which builds an Elementor Pro Single Product Theme Builder template. Makes no changes to either site."
          >
            Product
          </Button>
          <Button
            variant="secondary"
            onClick={handleCreate}
            onMouseEnter={refreshCreateSource}
            onFocus={refreshCreateSource}
            disabled={!cwd || starting}
            title={
              createSource
                ? `Builds from ${createSource} — as a new, unassigned artifact only (a draft page, an unpublished header/footer template, an unattached menu), except Global Styles, which sets the site's actual Kit values directly and reports anything already linked to them.`
                : "Builds from whichever Analyze: Page/Header/Footer/Menu/Shop/Product/Global Styles ran last — run one first."
            }
            className="ml-auto"
          >
            Create
          </Button>
        </div>

        {cwd && lastAnalyzeSlug && createSource && (
          <p className="mt-1 text-right text-xs text-muted-foreground">
            Create will build from: {createSource}
          </p>
        )}

        <div className="mt-2 flex flex-wrap gap-2">
          <span className="self-center text-xs text-muted-foreground ml-1">Review:</span>
          <div className="flex items-center gap-1.5">
            <Checkbox
              id="review-live"
              checked={useLive}
              onCheckedChange={(checked) => setUseLive(checked === true)}
              disabled={!settings.liveSiteUrl}
              title={
                settings.liveSiteUrl
                  ? `Review against ${settings.liveSiteUrl} instead of the local build`
                  : "Set a Live WP site URL in Settings first"
              }
            />
            <Label htmlFor="review-live" className="text-xs text-muted-foreground">
              Live
            </Label>
          </div>
          <Button
            variant="secondary"
            onClick={handleReviewUi}
            disabled={!cwd || starting}
          >
            UI
          </Button>
          <Button
            variant="secondary"
            onClick={handleReviewPage}
            disabled={!cwd || starting}
            title="Narrow parity audit of one page — Settings → Site → Page (design) vs. Settings → WP site → Slug (rebuild). Makes no changes to either site."
          >
            Page
          </Button>
          <Button
            variant="secondary"
            onClick={handleReviewHeaderFooter}
            disabled={!cwd || starting}
          >
            Header/Footer
          </Button>
          <Button
            variant="secondary"
            onClick={handleReviewAccessibility}
            disabled={!cwd || starting}
          >
            Accessibility
          </Button>
          <Button
            variant="secondary"
            onClick={handleReviewPerformance}
            disabled={!cwd || starting}
          >
            Performance
          </Button>
          {/* Sits next to Performance because the two feed each other: Images
              lists the media weight Performance keeps measuring, and its
              conversions are what move those numbers. */}
          <Button
            variant="secondary"
            onClick={handleWebpScan}
            disabled={!cwd || starting}
            title="Lists JPEG/PNG images worth converting to WebP, with sizes and where each is used — makes no changes yet. Follow up with Change to convert whichever ones you pick."
          >
            Images
          </Button>
          <Button
            variant="secondary"
            onClick={handleReviewBestPractices}
            disabled={!cwd || starting}
          >
            Best Practices
          </Button>
          <Button
            variant="secondary"
            onClick={handleReviewSeo}
            disabled={!cwd || starting}
          >
            SEO
          </Button>
          <Button
            variant="secondary"
            onClick={handleReviewCache}
            disabled={!cwd || starting}
          >
            Cache
          </Button>
          <Button
            variant="secondary"
            onClick={handleReviewImportant}
            disabled={!cwd || starting}
          >
            !Important
          </Button>
          <Button
            variant="secondary"
            onClick={handleReviewTheme}
            disabled={!cwd || starting}
          >
            Theme
          </Button>
          <Button
            variant="secondary"
            onClick={handleReviewPreMigration}
            disabled={!cwd || starting}
          >
            Pre-Migration
          </Button>
          <Button
            variant="secondary"
            onClick={handleCreateChangePrompt}
            onMouseEnter={refreshChangeSource}
            onFocus={refreshChangeSource}
            disabled={!cwd || starting}
            title={
              changeSource
                ? `Fixes the findings in ${changeSource}`
                : "Fixes the findings from the last review — run one first"
            }
            className="ml-auto"
          >
            Change
          </Button>
          <Button
            variant="secondary"
            onClick={handleCustomPrompt}
            disabled={!cwd || starting}
          >
            Prompt
          </Button>
        </div>

        {cwd && lastReviewSlug && changeSource && (
          <p className="mt-1 text-right text-xs text-muted-foreground">
            Change will fix: {changeSource}
          </p>
        )}

        {optionsSlot &&
          createPortal(
            <Card className="flex-1">
              <CardHeader>
                <CardTitle className="text-base">Build Options</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Page builder</p>
                  <RadioGroup
                    value={builder}
                    onValueChange={(v) => setBuilder(v as Builder)}
                    disabled={!!sessionId}
                    className="flex flex-col gap-2"
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="gutenberg" id="builder-gutenberg" />
                      <Label htmlFor="builder-gutenberg">Gutenberg</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="elementor" id="builder-elementor" />
                      <Label htmlFor="builder-elementor">Elementor</Label>
                    </div>
                    {builder === "elementor" && (
                      <div className="flex items-center gap-2 ml-6">
                        <Checkbox
                          id="elementor-pro"
                          checked={elementorPro}
                          disabled={!!sessionId}
                          onCheckedChange={(checked) => setElementorPro(checked === true)}
                        />
                        <Label htmlFor="elementor-pro">Pro</Label>
                      </div>
                    )}
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">SEO plugin</p>
                  <RadioGroup
                    value={seoPlugin}
                    onValueChange={(v) => setSeoPlugin(v as SeoPlugin)}
                    disabled={!!sessionId}
                    className="flex flex-col gap-2"
                  >
                    {SEO_PLUGIN_OPTIONS.map((option) => (
                      <div className="flex items-center gap-2" key={option.value}>
                        <RadioGroupItem value={option.value} id={`seo-${option.value}`} />
                        <Label htmlFor={`seo-${option.value}`}>{option.label}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Plugins</p>
                  <div className="flex flex-col gap-2">
                    {PLUGIN_OPTIONS.map((option) => (
                      <div className="flex items-center gap-2" key={option.key}>
                        <Checkbox
                          id={`plugin-${option.key}`}
                          checked={plugins[option.key]}
                          disabled={!!sessionId}
                          onCheckedChange={(checked) =>
                            setPlugins((prev) => ({ ...prev, [option.key]: checked === true }))
                          }
                        />
                        <Label htmlFor={`plugin-${option.key}`}>{option.label}</Label>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>,
            optionsSlot
          )}

        {optionsSlot &&
          createPortal(
            <Card className="flex-1">
              <CardHeader>
                <CardTitle className="text-base">Page Options</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Rebuild Page: Form handling</p>
                  <RadioGroup
                    value={formHandling}
                    onValueChange={(v) => setFormHandling(v as FormHandling)}
                    className="flex flex-col gap-2"
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="keep" id="form-handling-keep" />
                      <Label
                        htmlFor="form-handling-keep"
                        title="Just wire in the form SE Page Transfer already recreated — no further rebuild"
                      >
                        As Is
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="rebuild-cf7" id="form-handling-rebuild-cf7" />
                      <Label
                        htmlFor="form-handling-rebuild-cf7"
                        title="Rebuild the form to match the target site's own existing CF7 markup/styling conventions"
                      >
                        CF7
                      </Label>
                    </div>
                    {builder === "elementor" && elementorPro && (
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="rebuild-elementor-pro" id="form-handling-rebuild-elementor-pro" />
                        <Label
                          htmlFor="form-handling-rebuild-elementor-pro"
                          title="Rebuild the form as a native Elementor Pro Form widget instead of a CF7 embed"
                        >
                          Elementor
                        </Label>
                      </div>
                    )}
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Create: Styles</p>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="self-styles-only"
                      checked={selfStylesOnly}
                      onCheckedChange={(checked) => setSelfStylesOnly(checked === true)}
                    />
                    <Label
                      htmlFor="self-styles-only"
                      title="Off (default): a Page/Header/Footer Create links to the Kit's Global Colors/Fonts and applies its Custom CSS button/text-link classes when a match already exists, instead of duplicating them locally. On: use only local, literal widget-level values and skip those Custom CSS classes too — never link to the Kit, even if a match exists — so this build stands entirely on its own, unaffected by any later Global Styles change."
                    >
                      Self Styles
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="canvas-template"
                      checked={canvasTemplate}
                      onCheckedChange={(checked) => setCanvasTemplate(checked === true)}
                    />
                    <Label
                      htmlFor="canvas-template"
                      title="Page scope only. Off (default): the page uses the theme's Default Template, rendering in full context with whatever header/footer is currently active — even if that's still the old, not-yet-replaced chrome. On: the page gets Elementor's Canvas template instead — no header/footer/sidebar at all, standing entirely alone, isolated from whatever chrome does or doesn't exist yet."
                    >
                      Canvas
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="webp-images"
                      checked={webpImages}
                      onCheckedChange={(checked) => setWebpImages(checked === true)}
                    />
                    <Label
                      htmlFor="webp-images"
                      title="On (default): every new image a Create pass uploads gets converted to WebP first (checking/installing a WebP-capable PHP image extension on the site's own server first if needed), instead of staying in whatever format the source file came in — usually a much smaller file at the same visual quality. Off: upload each image as-is, unconverted."
                    >
                      WebP images
                    </Label>
                  </div>
                </div>
              </CardContent>
            </Card>,
            optionsSlot
          )}
      </CardHeader>

      <Separator />

      <CardContent className="flex-1 flex flex-col min-h-0 pt-4">
        <ScrollArea className="flex-1 min-h-0 pr-4" viewportRef={scrollRef}>
          <div className="space-y-3">
            {items.map((item) => (
              <ChatItem key={item.id} item={item} />
            ))}
            {items.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No messages yet. Send one below to start a session against{" "}
                <code>{cwd || "(no directory set — fill in Settings first)"}</code>.
              </p>
            )}
          </div>
        </ScrollArea>

        {working && (
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground animate-pulse">
              {liveStatus ?? "Agent is working…"}
            </p>
            <Button size="sm" variant="destructive" onClick={handleStop}>
              Stop
            </Button>
          </div>
        )}

        {pendingImages.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {pendingImages.map((image) => (
              <div key={image.id} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image.dataUrl}
                  alt="Pasted"
                  className="h-16 w-16 rounded-md object-cover border"
                />
                <button
                  type="button"
                  onClick={() => removePendingImage(image.id)}
                  className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-foreground text-background text-xs leading-none flex items-center justify-center"
                  aria-label="Remove image"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex gap-2 items-end">
          <Textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onPaste={handlePaste}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask Agent to do something in the selected directory... (paste images too)"
            disabled={!cwd}
            className="min-h-[60px] max-h-40 overflow-y-auto"
          />
          <Button
            onClick={handleSend}
            disabled={!cwd || starting || (!inputText.trim() && pendingImages.length === 0)}
          >
            Send
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="absolute top-1 right-1 rounded border bg-background/80 px-1.5 py-0.5 text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function ChatItem({ item }: { item: DisplayItem }) {
  if (item.kind === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm whitespace-pre-wrap space-y-2">
          {item.images && item.images.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {item.images.map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={src}
                  alt="Pasted"
                  className="h-24 w-24 rounded-md object-cover"
                />
              ))}
            </div>
          )}
          {item.text}
        </div>
      </div>
    );
  }

  if (item.kind === "assistant") {
    return (
      <div className="flex justify-start">
        <div className="group relative max-w-[80%] rounded-lg bg-muted px-3 py-2 pr-12 text-sm whitespace-pre-wrap">
          {item.text}
          <CopyButton text={item.text} />
        </div>
      </div>
    );
  }

  if (item.kind === "tool_use") {
    return (
      <div className="flex items-start gap-2 text-sm">
        <Badge variant="secondary">
          Tool: {item.name}
          {typeof item.elapsedSeconds === "number" ? ` · ${item.elapsedSeconds.toFixed(0)}s` : ""}
        </Badge>
        <pre className="text-xs text-muted-foreground overflow-x-auto max-w-[70%]">
          {JSON.stringify(item.input, null, 2)}
        </pre>
      </div>
    );
  }

  if (item.kind === "tool_result") {
    return (
      <div className="group relative text-xs text-muted-foreground border rounded-md p-2 pr-12 whitespace-pre-wrap">
        {item.preview}
        <CopyButton text={item.preview} />
      </div>
    );
  }

  if (item.kind === "turn_complete") {
    return (
      <p className="text-xs text-muted-foreground">
        Turn complete
        {typeof item.costUsd === "number" ? ` · $${item.costUsd.toFixed(4)}` : ""}
        {typeof item.durationMs === "number" ? ` · ${item.durationMs}ms` : ""}
      </p>
    );
  }

  if (item.kind === "auto_resume") {
    return (
      <div className="flex justify-center">
        <p className="text-xs italic text-muted-foreground border rounded-md px-2 py-1">
          ↻ Auto-resumed: &ldquo;{item.text}&rdquo;
        </p>
      </div>
    );
  }

  if (item.kind === "error") {
    return (
      <div className="flex justify-center">
        <p className="text-xs text-destructive border border-destructive/40 bg-destructive/10 rounded-md px-2 py-1 whitespace-pre-wrap">
          ⚠ {item.text}
        </p>
      </div>
    );
  }

  if (item.kind === "model_refusal_fallback") {
    return (
      <div className="flex justify-center">
        <p
          className="text-xs italic text-muted-foreground border rounded-md px-2 py-1"
          title="The model declined to continue this turn, so the CLI automatically retried it on a fallback model — and that swap sticks for the rest of this session, not just this one turn."
        >
          ⚠ {item.originalModel} refused this turn — switched to {item.fallbackModel} for the rest of this session.
        </p>
      </div>
    );
  }

  return null;
}
