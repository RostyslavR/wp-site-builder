"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function InfoDialog() {
  const [content, setContent] = useState("");

  // Re-fetches every time the dialog opens (not just the first time) — same
  // no-caching intent as prompt templates, so an edit to the doc on disk
  // shows up on the very next open, not just after a page reload.
  async function handleOpenChange(open: boolean) {
    if (!open) return;
    const res = await fetch("/api/setup-info");
    const data = await res.json();
    setContent(typeof data.content === "string" ? data.content : "Failed to load.");
  }

  return (
    <Dialog onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={<Button variant="outline" size="icon" aria-label="Setup info" />}
      >
        <Info />
      </DialogTrigger>
      <DialogContent className="w-[40vw] max-w-[40vw] sm:max-w-[40vw]">
        <DialogHeader>
          <DialogTitle>Setup Info</DialogTitle>
        </DialogHeader>
        <pre className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap font-mono text-xs">
          {content || "Loading…"}
        </pre>
      </DialogContent>
    </Dialog>
  );
}
