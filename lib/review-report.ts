export interface OnDiskReport {
  report: string;
  modifiedAt: number;
  path: string;
}

/**
 * Fetches the on-disk report for a slug (a review, or "analyze"), fresh (no
 * caching) — the same reasoning as fetchPromptTemplate: a report that just
 * finished being written should be picked up on the very next click of
 * whatever step consumes it (Change for a review, Build for analyze).
 *
 * Returns null when there's no readable report, which callers treat as "fall
 * back to the chat transcript" rather than as a failure.
 */
export async function fetchOnDiskReport(
  wpSiteDir: string,
  slug: string
): Promise<OnDiskReport | null> {
  try {
    const params = new URLSearchParams({ wpSiteDir, slug });
    const res = await fetch(`/api/fs/report?${params}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (typeof data.report !== "string" || !data.report.trim()) return null;
    return { report: data.report, modifiedAt: data.modifiedAt, path: data.path };
  } catch {
    return null;
  }
}

/** The report file a review slug writes — prompts/X.md always saves X-report.md. */
export function reportFileName(slug: string): string {
  return `${slug}-report.md`;
}

/**
 * Coarse "how old is this report" label for the Change hint. Deliberately
 * rough — the point is spotting that a report is days stale, not reading a
 * precise timestamp off it.
 */
export function formatAge(modifiedAt: number): string {
  const minutes = Math.floor((Date.now() - modifiedAt) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
