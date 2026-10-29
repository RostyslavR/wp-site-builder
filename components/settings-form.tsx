"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SiteSettings } from "@/lib/use-local-settings";
import { DesignPagesDialog } from "@/components/design-pages-dialog";
import { WpPagesDialog } from "@/components/wp-pages-dialog";

interface SettingsFormProps {
  settings: SiteSettings;
  onSave: (next: SiteSettings) => void;
}

/** Keys whose value is a string — the ones the text-input map below can render. */
type TextSettingKey = {
  [K in keyof SiteSettings]: SiteSettings[K] extends string ? K : never;
}[keyof SiteSettings];

/** Keys whose value is a boolean, rendered as a checkbox instead. */
type FlagSettingKey = {
  [K in keyof SiteSettings]: SiteSettings[K] extends boolean ? K : never;
}[keyof SiteSettings];

type SettingsField = { key: TextSettingKey; label: string };

const SECTIONS: Array<{
  title: string;
  // A plain field renders on its own row; an array of fields renders them
  // side by side in one row (e.g. Page + Slug, which are short enough to
  // share a line rather than each claiming a full row).
  fields: Array<SettingsField | SettingsField[]>;
  flags?: Array<{ key: FlagSettingKey; label: string; hint: string }>;
}> = [
  {
    title: "Site",
    fields: [
      { key: "siteDir", label: "Dir" },
      { key: "siteUrl", label: "URL" },
      { key: "rebuildPageUrl", label: "Page" },
      { key: "rebuildBundleZipPath", label: "Bundle" },
    ],
  },
  {
    title: "WP site",
    fields: [
      { key: "wpSiteDir", label: "Dir" },
      { key: "wpSiteUrl", label: "URL" },
      { key: "liveSiteUrl", label: "Live" },
      [
        { key: "newPageName", label: "Page" },
        { key: "newPageSlug", label: "Slug" },
      ],
    ],
    flags: [
      {
        key: "liveSiteIsTemporary",
        label: "Live is temporary",
        hint:
          "The Live URL is a staging/temporary host, not the final domain. " +
          "Reviews then treat it as a site that should NOT be indexed.",
      },
    ],
  },
];

function parentDir(value: string, defaultRoot = "/"): string {
  if (!value) return defaultRoot;
  const idx = value.lastIndexOf("/");
  if (idx <= 0) return "/";
  return value.slice(0, idx);
}

/** Debounced live listing of real subdirectories of wherever the user has
 * typed so far (or filesystem root when empty), used to populate a <datalist>. */
function useDirSuggestions(value: string): string[] {
  const [dirs, setDirs] = useState<string[]>([]);

  useEffect(() => {
    const parent = parentDir(value);
    const timeout = setTimeout(() => {
      fetch(`/api/fs/subdirs?path=${encodeURIComponent(parent)}`)
        .then((res) => res.json())
        .then((data) => setDirs(data.dirs ?? []))
        .catch(() => setDirs([]));
    }, 200);
    return () => clearTimeout(timeout);
  }, [value]);

  return dirs;
}

/**
 * Same idea as useDirSuggestions, but for picking a file rather than a
 * directory — used for the Bundle field, where a native <input type="file">
 * can't actually help: browsers deliberately never expose a picked file's
 * real path (only its name), and the agent needs the real path to read the
 * file directly from disk. Rooted at "/" when empty rather than /mnt/e —
 * unlike the project-directory fields, a downloaded bundle could be anywhere
 * (e.g. the native filesystem's own Downloads folder), not just the Windows
 * drive this project's WP sites happen to live on. Includes subdirectories
 * (suffixed with "/") alongside matching files so the list can also be used
 * to navigate deeper, not just to pick a final file.
 */
function useFileSuggestions(value: string, ext: string): string[] {
  const [entries, setEntries] = useState<string[]>([]);

  useEffect(() => {
    const parent = parentDir(value, "/");
    const timeout = setTimeout(() => {
      fetch(`/api/fs/files?path=${encodeURIComponent(parent)}&ext=${encodeURIComponent(ext)}`)
        .then((res) => res.json())
        .then((data) => setEntries(data.entries ?? []))
        .catch(() => setEntries([]));
    }, 200);
    return () => clearTimeout(timeout);
  }, [value, ext]);

  return entries;
}

export function SettingsForm({ settings, onSave }: SettingsFormProps) {
  // Initialized once from `settings` — the parent page only mounts this
  // component after settings have finished loading from localStorage, so
  // there's no later prop change to keep in sync with.
  const [draft, setDraft] = useState<SiteSettings>(settings);

  const siteDirSuggestions = useDirSuggestions(draft.siteDir);
  const wpSiteDirSuggestions = useDirSuggestions(draft.wpSiteDir);
  const bundleZipSuggestions = useFileSuggestions(draft.rebuildBundleZipPath, "zip");

  const suggestionsByField: Record<TextSettingKey, string[]> = {
    siteDir: siteDirSuggestions,
    wpSiteDir: wpSiteDirSuggestions,
    siteUrl: [],
    wpSiteUrl: [],
    liveSiteUrl: [],
    rebuildPageUrl: [],
    rebuildBundleZipPath: bundleZipSuggestions,
    newPageName: [],
    newPageSlug: [],
    model: [],
    apiKey: [],
  };

  function update(key: TextSettingKey, value: string) {
    const next = { ...draft, [key]: value };
    setDraft(next);
    onSave(next);
  }

  function updateMultiple(patch: Partial<SiteSettings>) {
    const next = { ...draft, ...patch };
    setDraft(next);
    onSave(next);
  }

  function updateFlag(key: FlagSettingKey, value: boolean) {
    const next = { ...draft, [key]: value };
    setDraft(next);
    onSave(next);
  }

  return (
    <Card className="overflow-visible">
      <CardHeader>
        <CardTitle>Settings</CardTitle>
        <CardDescription>
          Local paths and URLs for each project. Saved in this browser only.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {SECTIONS.map((section) => (
          <div className="space-y-2" key={section.title}>
            <p className="text-sm font-medium">{section.title}</p>
            {section.fields.map((entry) => {
              const row = Array.isArray(entry) ? entry : [entry];
              return (
                <div className="flex items-center gap-4" key={row.map((field) => field.key).join("+")}>
                  {row.map((field) => {
                    const listId = `${field.key}-suggestions`;
                    const suggestions = suggestionsByField[field.key];
                    return (
                      <div className="flex flex-1 items-center gap-2" key={field.key}>
                        <Label htmlFor={field.key} className="w-10 shrink-0 text-xs text-muted-foreground">
                          {field.label}
                        </Label>
                        <Input
                          id={field.key}
                          list={listId}
                          value={draft[field.key]}
                          onChange={(e) => update(field.key, e.target.value)}
                        />
                        <datalist id={listId}>
                          {suggestions.map((suggestion) => (
                            <option value={suggestion} key={suggestion} />
                          ))}
                        </datalist>
                        {field.key === "rebuildPageUrl" && (
                          <DesignPagesDialog
                            wpSiteDir={draft.wpSiteDir}
                            siteUrl={draft.siteUrl}
                            onSelect={(p) => update("rebuildPageUrl", p)}
                          />
                        )}
                      </div>
                    );
                  })}
                  {row.some((f) => f.key === "newPageName") && row.some((f) => f.key === "newPageSlug") && (
                    <WpPagesDialog
                      wpSiteUrl={draft.wpSiteUrl}
                      onSelect={(title, slug) => updateMultiple({ newPageName: title, newPageSlug: slug })}
                    />
                  )}
                </div>
              );
            })}
            {section.flags?.map((flag) => (
              <div className="flex items-center gap-2" key={flag.key} title={flag.hint}>
                <span className="w-10 shrink-0" aria-hidden />
                <Checkbox
                  id={flag.key}
                  checked={draft[flag.key]}
                  onCheckedChange={(checked) => updateFlag(flag.key, checked === true)}
                />
                <Label htmlFor={flag.key} className="text-xs text-muted-foreground">
                  {flag.label}
                </Label>
              </div>
            ))}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
