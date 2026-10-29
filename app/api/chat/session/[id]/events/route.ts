import { NextRequest } from "next/server";
import { getSession } from "@/lib/chat-sessions";

// Default (Node.js) runtime required — the in-memory session Map and the
// SDK's bundled native binary are both Node-only; do not set `edge` here.
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = getSession(id);

  if (!session) {
    return new Response("Session not found", { status: 404 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of session.output) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        }
      } catch {
        // Connection closed by the client; nothing else to do — the
        // session itself stays alive in memory for a possible reconnect.
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
