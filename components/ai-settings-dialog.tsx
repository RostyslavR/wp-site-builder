"use client";

import { useState } from "react";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthStatus } from "@/components/auth-status";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { SiteSettings } from "@/lib/use-local-settings";

// "default" (not "") stands in for "no override" — an empty string as an
// item value is a real footgun in most Select implementations, which
// reserve it as an internal "nothing selected" sentinel. Matches the SDK's
// own catalog, which happens to use the literal value "default" for exactly
// the same "let the CLI pick" meaning.
const DEFAULT_MODEL_VALUE = "default";

interface ModelOption {
  value: string;
  displayName: string;
  description?: string;
}

// Used only if the live /api/auth/models fetch fails (e.g. auth isn't set
// up yet) — the dropdown shouldn't go completely empty just because the
// catalog lookup couldn't run.
const FALLBACK_MODEL_OPTIONS: ModelOption[] = [
  { value: DEFAULT_MODEL_VALUE, displayName: "Default" },
  { value: "sonnet", displayName: "Sonnet" },
  { value: "opus", displayName: "Opus" },
  { value: "haiku", displayName: "Haiku" },
];

interface AiSettingsDialogProps {
  settings: SiteSettings;
  onSave: (next: SiteSettings) => void;
}

/** Global, cross-project settings (which model to use, auth) — separate from
 * the per-project Site/WP paths in the main Settings card, since these don't
 * vary per project the way those do. */
export function AiSettingsDialog({ settings, onSave }: AiSettingsDialogProps) {
  const [models, setModels] = useState<ModelOption[]>(FALLBACK_MODEL_OPTIONS);
  const [loadingModels, setLoadingModels] = useState(false);

  function update(key: "model" | "apiKey", value: string) {
    onSave({ ...settings, [key]: value });
  }

  function updateModel(value: string | null) {
    update("model", !value || value === DEFAULT_MODEL_VALUE ? "" : value);
  }

  // Re-fetches every time the dialog opens (not cached client-side) — the
  // server itself caches the underlying catalog lookup, so this stays cheap
  // while still picking up a server-side cache refresh without a reload.
  async function handleOpenChange(open: boolean) {
    if (!open) return;
    setLoadingModels(true);
    try {
      const res = await fetch("/api/auth/models");
      const data = await res.json();
      if (Array.isArray(data.models) && data.models.length > 0) {
        setModels(data.models);
      }
    } catch {
      // Keep whatever's already in `models` (fallback or a previous
      // successful fetch) rather than clearing it on a transient failure.
    } finally {
      setLoadingModels(false);
    }
  }

  return (
    <Dialog onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="outline" size="icon" aria-label="AI settings" />}>
        <Settings />
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>AI Settings</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <AuthStatus />
          <div className="flex items-center gap-2">
            <Label htmlFor="ai-model" className="w-10 shrink-0 text-xs text-muted-foreground">
              Model
            </Label>
            <Select
              value={settings.model || DEFAULT_MODEL_VALUE}
              onValueChange={updateModel}
            >
              <SelectTrigger id="ai-model">
                {/* Explicit lookup rather than relying on the selected item's
                    rendered children — those include the description
                    subtext below, which shouldn't also show up crammed into
                    the closed trigger's single line. */}
                <SelectValue>
                  {(value: string) => models.find((m) => m.value === value)?.displayName ?? value}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {models.map((opt) => (
                  <SelectItem value={opt.value} key={opt.value}>
                    <div className="flex flex-col">
                      <span>{opt.displayName}</span>
                      {opt.description && (
                        <span className="text-xs text-muted-foreground">{opt.description}</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {loadingModels && (
            <p className="text-xs text-muted-foreground">Refreshing available models…</p>
          )}
          <div className="flex items-center gap-2">
            <Label htmlFor="ai-api-key" className="w-10 shrink-0 text-xs text-muted-foreground">
              Key
            </Label>
            <Input
              id="ai-api-key"
              type="password"
              placeholder="Leave blank to use claude CLI login"
              value={settings.apiKey}
              onChange={(e) => update("apiKey", e.target.value)}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Only needed if the Login button above can&apos;t be used (e.g. no subscription) — an API
            key here is billed separately via the Anthropic Console, not your Claude subscription.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
