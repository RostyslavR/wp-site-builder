import { NextResponse } from "next/server";
import { closeSession } from "@/lib/chat-sessions";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const closed = await closeSession(id);
  if (!closed) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
