import { NextResponse } from "next/server";
import { getSession, interruptSession } from "@/lib/chat-sessions";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = getSession(id);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  await interruptSession(session);
  return NextResponse.json({ ok: true });
}
