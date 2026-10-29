import { stat } from "fs/promises";
import { NextRequest, NextResponse } from "next/server";
import { getOrCreateSessionForCwd } from "@/lib/chat-sessions";
import { parseJsonBody } from "@/lib/api-utils";

export async function POST(request: NextRequest) {
  const body = await parseJsonBody(request);
  if (!body) {
    return NextResponse.json({ error: "Invalid or empty JSON body" }, { status: 400 });
  }
  const cwd = typeof body.cwd === "string" ? body.cwd : "";
  const model = typeof body.model === "string" ? body.model : undefined;
  const apiKey = typeof body.apiKey === "string" ? body.apiKey : undefined;

  if (!cwd) {
    return NextResponse.json({ error: "cwd is required" }, { status: 400 });
  }
  // A missing directory makes the SDK's spawn fail with a misleading "native
  // binary failed to launch" error, so catch it here with a clear one instead.
  const isDir = await stat(cwd).then((s) => s.isDirectory(), () => false);
  if (!isDir) {
    return NextResponse.json({ error: `WP site directory not found: ${cwd}` }, { status: 400 });
  }

  // Reconnects to an already-live session for this cwd instead of always
  // creating a new one — see getOrCreateSessionForCwd for why. model/apiKey
  // only take effect when a new session is actually created; an existing
  // live one keeps whatever it already started with.
  const session = getOrCreateSessionForCwd(cwd, model, apiKey);
  return NextResponse.json({ sessionId: session.id });
}
