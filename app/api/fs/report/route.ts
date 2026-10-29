import { NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import path from "path";
import { READABLE_REPORT_SLUGS } from "@/lib/report-slugs";

/**
 * Reads a report straight off disk, so a later step (Change fixing a review's
 * findings; Build executing Analyze's plan) can pick it up even when it's no
 * longer in the chat transcript (a closed tab, a New Chat, or any button —
 * they all call resetSession(), which clears `items`).
 *
 * Every prompt that produces one of these already ends by saving it to
 * {wpSiteDir}/reports/{slug}-report.md "so it exists independent of chat
 * history" — this route is what finally makes that promise usable. The naming
 * is conventional across all of prompts/: X.md always writes X-report.md.
 */

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const wpSiteDir = searchParams.get("wpSiteDir");
  const slug = searchParams.get("slug");

  if (!wpSiteDir || !slug || !READABLE_REPORT_SLUGS.has(slug)) {
    return NextResponse.json({ report: "", modifiedAt: null, path: null }, { status: 400 });
  }

  const filePath = path.join(wpSiteDir, "reports", `${slug}-report.md`);

  try {
    const [report, stats] = await Promise.all([readFile(filePath, "utf-8"), stat(filePath)]);
    return NextResponse.json({ report, modifiedAt: stats.mtimeMs, path: filePath });
  } catch {
    // No report written yet for this review (or it isn't readable) — not an
    // error worth surfacing as one: the caller falls back to the transcript.
    return NextResponse.json({ report: "", modifiedAt: null, path: filePath }, { status: 404 });
  }
}
