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

interface WpPage {
  title: string;
  slug: string;
  status: string;
}

interface WpPagesDialogProps {
  wpSiteUrl: string;
  onSelect: (title: string, slug: string) => void;
}

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; pages: WpPage[] };

/**
 * "Show Page List" — the button next to the Page/Slug fields in Settings'
 * WP site section. Picking an entry fills both fields at once (title and
 * its real post_name), unlike the Design pages picker which only ever
 * fills one field with a path.
 */
export function WpPagesDialog({ wpSiteUrl, onSelect }: WpPagesDialogProps) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [open, setOpen] = useState(false);

  async function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) return;
    setState({ status: "loading" });
    try {
      const params = new URLSearchParams({ wpSiteUrl });
      const res = await fetch(`/api/wp/pages?${params}`);
      const data = await res.json();
      if (!res.ok || !Array.isArray(data.pages)) {
        setState({ status: "error", message: data.error || "Failed to load page list." });
        return;
      }
      setState({ status: "ready", pages: data.pages });
    } catch (err) {
      setState({ status: "error", message: err instanceof Error ? err.message : "Failed to load page list." });
    }
  }

  function handlePick(p: WpPage) {
    onSelect(p.title, p.slug);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={<Button type="button" variant="outline" size="icon-sm" aria-label="Show WP page list" />}
      >
        <ListTree />
      </DialogTrigger>
      <DialogContent className="w-[28rem] max-w-[28rem]">
        <DialogHeader>
          <DialogTitle>WordPress pages</DialogTitle>
          <DialogDescription>
            {state.status === "ready" && "Live from the WordPress REST API — published pages only."}
            {state.status === "loading" && "Loading…"}
            {state.status === "error" && state.message}
          </DialogDescription>
        </DialogHeader>
        {state.status === "ready" && (
          <ul className="max-h-[50vh] space-y-1 overflow-y-auto">
            {state.pages.map((p) => (
              <li key={p.slug}>
                <button
                  type="button"
                  onClick={() => handlePick(p)}
                  className="flex w-full items-baseline justify-between gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted"
                >
                  <span className="truncate text-xs">{p.title}</span>
                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                    {p.slug} · {p.status}
                  </span>
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
