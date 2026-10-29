import { NextRequest, NextResponse } from "next/server";
import { submitLoginCode } from "@/lib/claude-auth-login";
import { parseJsonBody } from "@/lib/api-utils";

// Default (Node.js) runtime required — writes to the pending `claude auth
// login` child process's stdin.
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await parseJsonBody(request);
  const code = typeof body?.code === "string" ? body.code : "";
  if (!code.trim()) {
    return NextResponse.json({ success: false, message: "Paste the code first." }, { status: 400 });
  }

  const result = await submitLoginCode(code);
  return NextResponse.json(result);
}
