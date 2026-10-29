import { NextRequest, NextResponse } from "next/server";
import { readdir } from "fs/promises";
import path from "path";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const dir = searchParams.get("path") || "/";

  try {
    const entries = await readdir(dir, { withFileTypes: true });
    const dirs = entries
      .filter(
        (entry) =>
          entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules"
      )
      .map((entry) => path.join(dir, entry.name))
      .sort();
    return NextResponse.json({ dirs });
  } catch {
    // Path doesn't exist, isn't a directory, or isn't readable — just
    // return no suggestions rather than erroring the whole form.
    return NextResponse.json({ dirs: [] });
  }
}
