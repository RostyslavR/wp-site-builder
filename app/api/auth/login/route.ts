import { NextResponse } from "next/server";
import { startLogin } from "@/lib/claude-auth-login";

// Default (Node.js) runtime required — shells out to the `claude` CLI.
export const dynamic = "force-dynamic";

// `claude auth login` is a device-code OAuth flow: it prints a URL, the user
// authorizes in a browser, gets a short code back, and that code has to be
// submitted here (POST /api/auth/login/code) to actually finish — this route
// only starts the process and returns the URL once printed.
export async function POST() {
  const result = await startLogin();
  return NextResponse.json(result);
}
