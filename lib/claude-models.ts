import { query, type ModelInfo, type SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";

// Same minimal async-iterable queue pattern as chat-sessions.ts's
// PushableStream, just for prompt input we never actually push anything to
// — this only exists long enough to complete the SDK's own connect/
// initialize handshake (which already includes the account's real available
// models, no prompt/turn needed) before being torn down again.
class EmptyPromptStream implements AsyncIterable<SDKUserMessage> {
  [Symbol.asyncIterator](): AsyncIterator<SDKUserMessage> {
    return {
      next: () => new Promise(() => {}), // never resolves; nothing is ever sent
    };
  }
}

// Cached for the server process's lifetime (pinned to globalThis for the
// same Turbopack dev-mode re-evaluation reason as the sessions Map) — the
// account's available models don't change often enough to justify spinning
// up a real `claude` subprocess on every Settings-dialog open.
declare global {
  var __claudeModelsCache: ModelInfo[] | undefined;
}

export async function fetchAvailableModels(forceRefresh = false): Promise<ModelInfo[]> {
  if (!forceRefresh && globalThis.__claudeModelsCache) {
    return globalThis.__claudeModelsCache;
  }

  const q = query({
    prompt: new EmptyPromptStream(),
    options: {
      cwd: process.cwd(),
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
    },
  });

  try {
    const models = await q.supportedModels();
    globalThis.__claudeModelsCache = models;
    return models;
  } finally {
    try {
      await q.return(undefined);
    } catch {
      // Best-effort cleanup — we have what we needed either way.
    }
  }
}
