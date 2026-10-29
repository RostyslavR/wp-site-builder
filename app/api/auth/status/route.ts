import { NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

// Default (Node.js) runtime required — shells out to the `claude` CLI.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { stdout } = await execFileAsync("claude", ["auth", "status", "--json"], {
      timeout: 10_000,
    });
    const status = JSON.parse(stdout);
    return NextResponse.json(status);
  } catch (error) {
    // Covers both "claude auth status" itself reporting logged-out (some
    // CLI versions exit non-zero in that case) and the command genuinely
    // failing (not installed, timeout) — either way, the dashboard only
    // needs to know it can't currently confirm a logged-in state.
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ loggedIn: false, error: message });
  }
}
