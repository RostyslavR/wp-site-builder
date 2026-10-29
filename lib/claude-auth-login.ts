import { spawn, ChildProcessWithoutNullStreams } from "child_process";

// `claude auth login` is a device-code OAuth flow: it prints a URL, the user
// authorizes in a browser, gets back a short code, and that code has to be
// typed/pasted into the CLI's own stdin to finish — this isn't optional, the
// process just sits open waiting for it. Pinned to globalThis (not a plain
// module variable) for the same reason as the sessions Map in
// chat-sessions.ts: Turbopack dev-mode can re-evaluate this module.
declare global {
  var __pendingClaudeLogin: ChildProcessWithoutNullStreams | undefined;
}

const URL_PATTERN = /https?:\/\/\S+/;

export function startLogin(): Promise<{ url: string | null; raw: string }> {
  return new Promise((resolve) => {
    // A previous unfinished attempt is now moot — starting a new one
    // replaces it rather than leaving an orphaned process nothing can ever
    // write to again.
    if (globalThis.__pendingClaudeLogin) {
      globalThis.__pendingClaudeLogin.kill();
      globalThis.__pendingClaudeLogin = undefined;
    }

    const child = spawn("claude", ["auth", "login", "--claudeai"], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    globalThis.__pendingClaudeLogin = child;

    let buffer = "";
    let settled = false;

    function finish(url: string | null) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ url, raw: buffer.slice(-2000) });
    }

    child.stdout.on("data", (chunk: Buffer) => {
      buffer += chunk.toString();
      const match = URL_PATTERN.exec(buffer);
      if (match) finish(match[0]);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      buffer += chunk.toString();
      const match = URL_PATTERN.exec(buffer);
      if (match) finish(match[0]);
    });
    child.on("error", () => finish(null));
    child.on("exit", () => {
      if (globalThis.__pendingClaudeLogin === child) {
        globalThis.__pendingClaudeLogin = undefined;
      }
    });

    const timer = setTimeout(() => finish(null), 15_000);
  });
}

export function submitLoginCode(code: string): Promise<{ success: boolean; message: string }> {
  return new Promise((resolve) => {
    const child = globalThis.__pendingClaudeLogin;
    if (!child) {
      resolve({ success: false, message: "No login in progress — click Login again first." });
      return;
    }

    let buffer = "";
    let settled = false;

    function finish(success: boolean, message: string) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child?.stdout.removeListener("data", onData);
      child?.stderr.removeListener("data", onData);
      if (globalThis.__pendingClaudeLogin === child) {
        globalThis.__pendingClaudeLogin = undefined;
      }
      resolve({ success, message });
    }

    function onData(chunk: Buffer) {
      buffer += chunk.toString();
      // No fixed success/failure string is guaranteed across CLI versions —
      // the process exiting cleanly after accepting the code is the
      // reliable signal, handled by the 'exit' listener below. This listener
      // only accumulates output for the final message.
    }

    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.once("exit", (exitCode) => {
      finish(exitCode === 0, buffer.slice(-1000) || (exitCode === 0 ? "Logged in." : "Login failed."));
    });
    child.once("error", () => finish(false, "The login process errored out — try Login again."));

    child.stdin.write(code.trim() + "\n");

    // The CLI should exit on its own once it accepts (or rejects) the code;
    // this is just a backstop against it hanging silently.
    const timer = setTimeout(() => finish(false, "Timed out waiting for a response — check auth status manually."), 15_000);
  });
}
