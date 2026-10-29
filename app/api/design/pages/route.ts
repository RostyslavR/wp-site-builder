import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

/**
 * Lists the real pages the design (siteUrl) actually has, for the "Slug"
 * field's page-picker: prefers whatever analyze-report.md already recorded
 * (it's the source of truth once a whole-site Analyze has run and read the
 * design closely), and only falls back to crawling siteUrl directly when
 * that report doesn't exist yet or didn't come with a page list — e.g. before
 * the first Analyze, or if a past Analyze (like this project's own first
 * pass) only ever looked at the homepage and never followed its links.
 *
 * The crawl fetches siteUrl's raw HTML with a plain fetch() rather than a
 * headless browser: confirmed by hand that this specific class of design
 * export (a client-rendered SPA) still serves its real <a href> links in the
 * initial HTML payload (a static site generation / server-rendered shell),
 * so a full Playwright render isn't needed just to enumerate paths — only
 * the earlier per-page pixel analysis actually needed a real browser.
 */

const ASSET_EXTENSIONS = /\.(js|css|png|jpe?g|svg|gif|webp|ico|json|xml|woff2?|ttf|map)$/i;

function pathsFromText(text: string): string[] {
  const found = new Set<string>();
  // Backtick-wrapped, slash-led tokens, e.g. `/womens-hormone-health` —
  // deliberately not matching `#anchor` (no leading slash) or bare prose
  // mentions (too many false positives from folder paths, code snippets,
  // etc. outside backticks).
  const matches = text.matchAll(/`(\/[a-z0-9][a-z0-9-]*\/?)`/gi);
  for (const m of matches) {
    const p = m[1].replace(/\/$/, "") || "/";
    if (!ASSET_EXTENSIONS.test(p)) found.add(p);
  }
  return [...found];
}

/**
 * The body of a "## Pages" heading (analyze.md now always writes one), up to
 * the next "## " heading or end of file — plain string ops rather than a
 * single do-everything regex, specifically to avoid relying on a JS end-of-
 * string anchor inside a character-class alternation (there's no `\Z` in JS
 * regex the way Perl/Python have one; it silently matches a literal capital
 * "Z" instead, which is exactly how this first cut itself broke — the
 * capture quietly stopped at the "Z" in "Analyze" rather than reaching the
 * actual list).
 */
function pagesHeadingSection(markdown: string): string | null {
  const headingMatch = markdown.match(/^##\s+Pages\s*$/im);
  if (!headingMatch || headingMatch.index === undefined) return null;
  const afterHeadingLine = markdown.slice(headingMatch.index + headingMatch[0].length);
  const nextHeading = afterHeadingLine.match(/\n##\s/);
  return nextHeading ? afterHeadingLine.slice(0, nextHeading.index) : afterHeadingLine;
}

function extractPathsFromReport(markdown: string): string[] {
  // Preferred: scoped to just the "## Pages" section, so nothing elsewhere in
  // the report (e.g. a WordPress-site fact like an existing `/es/` Polylang
  // homepage, unrelated to the design being matched) gets picked up as a
  // false positive.
  const section = pagesHeadingSection(markdown);
  if (section) {
    const scoped = pathsFromText(section);
    if (scoped.length > 0) return scoped;
  }
  // Fall back to a whole-document scan for a report written before analyze.md
  // required the dedicated section — imprecise (can pick up an unrelated
  // backtick-wrapped path from elsewhere in the document), but better than
  // nothing for an older report.
  return pathsFromText(markdown);
}

async function crawlPaths(siteUrl: string): Promise<string[]> {
  const res = await fetch(siteUrl, { signal: AbortSignal.timeout(15000) });
  const html = await res.text();
  const found = new Set<string>(["/"]);
  const matches = html.matchAll(/href="([^"]+)"/gi);
  for (const m of matches) {
    const href = m[1];
    if (!href.startsWith("/") || href.startsWith("//")) continue; // external or protocol-relative
    if (href.includes("#")) continue; // in-page anchor
    if (ASSET_EXTENSIONS.test(href)) continue;
    found.add(href.replace(/\/$/, "") || "/");
  }
  return [...found];
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const wpSiteDir = searchParams.get("wpSiteDir") ?? "";
  const siteUrl = searchParams.get("siteUrl") ?? "";

  if (wpSiteDir) {
    try {
      const reportPath = path.join(wpSiteDir, "reports", "analyze-report.md");
      const markdown = await readFile(reportPath, "utf-8");
      const pages = extractPathsFromReport(markdown);
      if (pages.length > 0) {
        return NextResponse.json({ pages: pages.sort(), source: "report" });
      }
    } catch {
      // No report yet, or unreadable — fall through to crawling.
    }
  }

  if (!siteUrl) {
    return NextResponse.json(
      { pages: [], source: "none", error: "No analyze-report.md page list and no Design URL to crawl." },
      { status: 400 }
    );
  }

  try {
    const pages = await crawlPaths(siteUrl);
    return NextResponse.json({ pages: pages.sort(), source: "crawl" });
  } catch (err) {
    return NextResponse.json(
      { pages: [], source: "none", error: err instanceof Error ? err.message : "Crawl failed." },
      { status: 502 }
    );
  }
}
