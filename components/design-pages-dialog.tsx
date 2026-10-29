"use client";

import { useState } from "react";
import { ListTree } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface DesignPagesDialogProps {
  wpSiteDir: string;
  siteUrl: string;
  onSelect: (path: string) => void;
}

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; pages: string[]; source: "report" | "crawl" };

/**
 * "Show Page List" — the button next to the Site → Page field in Settings. Prefers
 * whatever analyze-report.md already recorded (the /api/design/pages route
 * does that preference itself); this component just renders whichever it
 * got back and says so, since a crawled list is "what the design currently
 * has" while a report-sourced list is "what the last Analyze recorded" —
 * worth knowing which one you're picking from if they were ever to diverge.
 */
export function DesignPagesDialog({ wpSiteDir, siteUrl, onSelect }: DesignPagesDialogProps) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [open, setOpen] = useState(false);

  async function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) return;
    setState({ status: "loading" });
    try {
      const params = new URLSearchParams({ wpSiteDir, siteUrl });
      const res = await fetch(`/api/design/pages?${params}`);
      const data = await res.json();
      if (!res.ok || !Array.isArray(data.pages)) {
        setState({ status: "error", message: data.error || "Failed to load page list." });
        return;
      }
      setState({ status: "ready", pages: data.pages, source: data.source });
    } catch (err) {
      setState({ status: "error", message: err instanceof Error ? err.message : "Failed to load page list." });
    }
  }

  function handlePick(p: string) {
    onSelect(p);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={<Button type="button" variant="outline" size="icon-sm" aria-label="Show page list" />}
      >
        <ListTree />
      </DialogTrigger>
      <DialogContent className="w-[28rem] max-w-[28rem]">
        <DialogHeader>
          <DialogTitle>Design pages</DialogTitle>
          <DialogDescription>
            {state.status === "ready" &&
              (state.source === "report"
                ? "From analyze-report.md — the last whole-site Analyze."
                : `Crawled live from ${siteUrl || "the design URL"} (no page list in the report).`)}
            {state.status === "loading" && "Loading…"}
            {state.status === "error" && state.message}
          </DialogDescription>
        </DialogHeader>
        {state.status === "ready" && (
          <ul className="max-h-[50vh] space-y-1 overflow-y-auto">
            {state.pages.map((p) => (
              <li key={p}>
                <button
                  type="button"
                  onClick={() => handlePick(p)}
                  className="w-full rounded-md px-2 py-1.5 text-left font-mono text-xs hover:bg-muted"
                >
                  {p}
                </button>
              </li>
            ))}
            {state.pages.length === 0 && (
              <li className="px-2 py-1.5 text-xs text-muted-foreground">No pages found.</li>
            )}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
