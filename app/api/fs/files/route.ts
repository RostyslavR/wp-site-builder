import { NextRequest, NextResponse } from "next/server";
import { readdir } from "fs/promises";
import path from "path";

/**
 * Like /api/fs/subdirs, but also returns files matching a given extension —
 * used for fields like Rebuild Page's Bundle path, where a browser
 * <input type="file"> can't help: it deliberately never exposes a picked
 * file's real filesystem path (only its name), and the agent needs the real
 * path to read the file directly from disk. Directories are still included
 * (suffixed with "/") so the suggestion list can be used to navigate deeper,
 * the same way the plain directory suggestions do.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const dir = searchParams.get("path") || "/";
  const ext = searchParams.get("ext")?.toLowerCase();

  try {
    const entries = await readdir(dir, { withFileTypes: true });
    const results = entries
      .filter((entry) => !entry.name.startsWith(".") && entry.name !== "node_modules")
      .filter(
        (entry) =>
          entry.isDirectory() || !ext || entry.name.toLowerCase().endsWith(`.${ext}`)
      )
      .map((entry) => path.join(dir, entry.name) + (entry.isDirectory() ? "/" : ""))
      .sort();
    return NextResponse.json({ entries: results });
  } catch {
    // Path doesn't exist, isn't a directory, or isn't readable — just
    // return no suggestions rather than erroring the whole form.
    return NextResponse.json({ entries: [] });
  }
}
