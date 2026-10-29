import { NextRequest, NextResponse } from "next/server";
import { getSession, sendMessage, type InlineImage } from "@/lib/chat-sessions";
import { parseJsonBody } from "@/lib/api-utils";

const ALLOWED_MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

function parseImages(value: unknown): InlineImage[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const images: InlineImage[] = [];
  for (const item of value) {
    const mediaType = (item as { mediaType?: unknown })?.mediaType;
    const data = (item as { data?: unknown })?.data;
    if (typeof mediaType === "string" && ALLOWED_MEDIA_TYPES.has(mediaType) && typeof data === "string") {
      images.push({ mediaType: mediaType as InlineImage["mediaType"], data });
    }
  }
  return images.length > 0 ? images : undefined;
}

/** Which report(s) on disk this message's task is working from — see
 * ChatSession.activeReportSlugs. Absent/malformed just means "unknown",
 * which leaves whatever context an earlier message in this session already
 * set (see sendMessage) rather than erroring the whole send over it. */
function parseContext(value: unknown): { label: string; reportSlugs: string[] } | undefined {
  const obj = value as { label?: unknown; reportSlugs?: unknown } | undefined;
  if (!obj || typeof obj.label !== "string" || !Array.isArray(obj.reportSlugs)) return undefined;
  const reportSlugs = obj.reportSlugs.filter((s): s is string => typeof s === "string");
  return reportSlugs.length > 0 ? { label: obj.label, reportSlugs } : undefined;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = getSession(id);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const body = await parseJsonBody(request);
  if (!body) {
    return NextResponse.json({ error: "Invalid or empty JSON body" }, { status: 400 });
  }
  const text = typeof body.text === "string" ? body.text : "";
  const images = parseImages(body.images);
  if (!text && !images) {
    return NextResponse.json({ error: "text or images required" }, { status: 400 });
  }
  const context = parseContext(body.context);

  sendMessage(session, text, images, context ? { context } : undefined);
  return NextResponse.json({ ok: true });
}
