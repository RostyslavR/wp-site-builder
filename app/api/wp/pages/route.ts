import { NextRequest, NextResponse } from "next/server";

/**
 * Lists the real pages the WordPress site at wpSiteUrl actually has, for the
 * "Page"/"Slug" fields' page-picker. A plain REST API fetch, same idea as
 * the Design pages picker's crawl — no docker/wp-cli dependency, so it
 * works the same way regardless of how (or whether) the project's
 * containers are named/composed.
 *
 * Unauthenticated, so it only ever sees published pages — a freshly
 * Created/Rebuilt page that's still a draft won't show up here until it's
 * published. That's an accepted trade-off for staying credential-free (see
 * change.md's own standing rule against ever touching WordPress auth from
 * this app).
 */
interface WpRestPage {
  title: { rendered: string };
  slug: string;
  status: string;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/**
 * WordPress's `title.rendered` runs through wptexturize (curly quotes,
 * &amp;/&#8217;-style entities) before the REST API ever sees it — decode
 * those back to real characters, rather than showing/storing literal
 * "Hashimoto&#8217;s &amp; Thyroid Health" text.
 */
function decodeHtmlEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity: string) => {
    if (entity[0] === "#") {
      const code = entity[1] === "x" || entity[1] === "X" ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[entity] ?? match;
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const wpSiteUrl = searchParams.get("wpSiteUrl") ?? "";

  if (!wpSiteUrl) {
    return NextResponse.json({ pages: [], error: "No WP site URL set in Settings." }, { status: 400 });
  }

  const base = wpSiteUrl.replace(/\/$/, "");
  try {
    const res = await fetch(`${base}/wp-json/wp/v2/pages?per_page=100&_fields=title,slug,status`, {
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      return NextResponse.json(
        { pages: [], error: `${base}/wp-json/wp/v2/pages returned ${res.status}.` },
        { status: 502 }
      );
    }
    const data: WpRestPage[] = await res.json();
    const pages = data
      .map((p) => ({ title: decodeHtmlEntities(p.title.rendered), slug: p.slug, status: p.status }))
      .sort((a, b) => a.title.localeCompare(b.title));
    return NextResponse.json({ pages });
  } catch (err) {
    return NextResponse.json(
      { pages: [], error: err instanceof Error ? err.message : "Failed to reach the WordPress REST API." },
      { status: 502 }
    );
  }
}
