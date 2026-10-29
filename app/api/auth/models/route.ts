import { NextRequest, NextResponse } from "next/server";
import { fetchAvailableModels } from "@/lib/claude-models";

// Default (Node.js) runtime required — spins up a real (throwaway) SDK
// connection to ask the CLI for its own model catalog.
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const forceRefresh = searchParams.get("refresh") === "1";

  try {
    const models = await fetchAvailableModels(forceRefresh);
    return NextResponse.json({ models });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ models: [], error: message }, { status: 500 });
  }
}
