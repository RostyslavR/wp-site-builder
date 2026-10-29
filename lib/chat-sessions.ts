import { randomUUID } from "crypto";
import { readFile, mkdir, readdir, readlink, writeFile, unlink } from "fs/promises";
import path from "path";
import os from "os";
import {
  RESET_BUFFER_MS,
  MIN_RETRY_DELAY_MS,
  RETRY_SPACING_MS,
  MAX_AUTO_RESUME_ATTEMPTS,
} from "@/lib/rate-limit-timing";
import {
  query,
  type Query,
  type SDKMessage,
  type SDKUserMessage,
} from "@anthropic-ai/claude-agent-sdk";
import { READABLE_REPORT_SLUGS } from "@/lib/report-slugs";
import { formatContinueContextBlock } from "@/lib/continue-context";

/**
 * A minimal async-iterable queue. push() adds a value; the async iterator
 * awaits new pushes indefinitely (it never completes on its own) — used
 * both as the streaming input fed to query() and as the SDK message output
 * channel read by the SSE route.
 */
class PushableStream<T> implements AsyncIterable<T> {
  private queue: T[] = [];
  private resolvers: Array<(result: IteratorResult<T>) => void> = [];

  push(value: T) {
    const resolve = this.resolvers.shift();
    if (resolve) {
      resolve({ value, done: false });
    } else {
      this.queue.push(value);
    }
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    return {
      next: (): Promise<IteratorResult<T>> => {
        const value = this.queue.shift();
        if (value !== undefined) {
          return Promise.resolve({ value, done: false });
        }
        return new Promise((resolve) => {
          this.resolvers.push(resolve);
        });
      },
    };
  }
}

export type OutboundEvent = SDKMessage;

export interface ChatSession {
  id: string;
  cwd: string;
  input: PushableStream<SDKUserMessage>;
  output: PushableStream<OutboundEvent>;
  q: Query;
  wakeTimer?: ReturnType<typeof setTimeout>;
  // The SDK's own conversation id (distinct from `id` above, which is just
  // this app's in-memory Map key) — captured off incoming messages, needed
  // to resume the conversation with a fresh query() after the underlying
  // one has terminated (see `qEnded`).
  sdkSessionId?: string;
  // A hard rate-limit rejection ends the query loop outright (terminal_reason
  // "blocking_limit") rather than pausing it — set once the drain loop below
  // actually exits, so sendMessage() knows the old query/input pair is dead
  // and a resume is needed before anything more can be sent.
  qEnded?: boolean;
  // Unix-seconds reset time of a pending rejected rate limit, mirroring
  // whatever `wakeTimer` is scheduled for — a backstop for maybeAutoResume()
  // to check against wall-clock time on session lookup, in case the timer
  // itself never fires (e.g. it was canceled by a stray close, or the delay
  // spans a host sleep in a way that drops it). Cleared alongside the timer.
  pendingRateLimitReset?: number;
  // Text of the most recent assistant message, kept only so a "session
  // limit" cutoff (see parseSessionLimitReset below) can be recovered from
  // it — some limit types end the query with a plain-text notice in the
  // assistant's own reply and a normal terminal_reason "blocking_limit"
  // result, never a structured rate_limit_event, so there's nothing else to
  // read the reset time from.
  lastAssistantText?: string;
  // The stated reset time of the limit currently being retried, as it appeared
  // in the notice ("22:50") rather than as a resolved timestamp — the key for
  // telling "the same limit window, still not lifted" apart from "a genuinely
  // new limit". Needed because a re-parse of the *same* notice silently rolls
  // to tomorrow once enough time has passed, so comparing resolved timestamps
  // can't distinguish the two.
  retryNoticeKey?: string;
  // How many consecutive resumes for retryNoticeKey have been rejected again;
  // indexes the backoff schedule. Reset when the window changes or a real
  // (non-auto) message is sent.
  retryStreak?: number;
  // Optional per-session overrides from Settings — empty/undefined means
  // "use whatever ambient auth/default model already works," matching this
  // session's behavior before either setting existed. Fixed at creation
  // time; changing Settings doesn't retroactively affect an already-live
  // session, only the next one created for that cwd.
  model?: string;
  apiKey?: string;
  // Set by a real (non-auto) sendMessage when the browser tells us which
  // report(s) on disk the current task is working from (Build → analyze,
  // Change → whichever review it's fixing, Create → the scoped analysis it's
  // building). An auto-resume re-reads these fresh off disk rather than
  // trusting continue.md's generic "re-read the plan" reminder alone — that
  // reminder is useless once the literal report text has been compacted out
  // of context, which is exactly when a resume needs it most. Only ever set,
  // never cleared, by a message that actually knows its context — a plain
  // Continue/Prompt send passes none, which correctly leaves whatever the
  // last real task's context was in place rather than losing it.
  activeLabel?: string;
  activeReportSlugs?: string[];
}

/** Reads {wpSiteDir}/reports/{slug}-report.md straight off disk for a
 * resume — same allowlist and shape as the client-facing /api/fs/report
 * route, just called in-process since this runs server-side already. */
async function readReportFile(wpSiteDir: string, slug: string): Promise<string | null> {
  if (!READABLE_REPORT_SLUGS.has(slug)) return null;
  try {
    const contents = (
      await readFile(path.join(wpSiteDir, "reports", `${slug}-report.md`), "utf-8")
    ).trim();
    return contents || null;
  } catch {
    return null;
  }
}

// Pinned to globalThis, not a plain module-level variable: in Next.js dev
// (Turbopack), route modules can be evaluated more than once independently
// (e.g. the first hit to a not-yet-compiled route), which would otherwise
// give that route its own empty Map instead of the one other routes wrote to.
declare global {
  var __chatSessions: Map<string, ChatSession> | undefined;
  var __chatSessionsSweepInterval: ReturnType<typeof setInterval> | undefined;
  var __chatSessionsReconciled: boolean | undefined;
  var __chatSessionsShutdownHandler: (() => void) | undefined;
}

const sessions: Map<string, ChatSession> = globalThis.__chatSessions ?? new Map();
globalThis.__chatSessions = sessions;

// Where each live session's spawned subprocess PID is recorded (see
// findSpawnedChildPid/reconcileOrphanedSessions below) — a plain tmp dir
// rather than anything under the repo, since this is pure runtime state.
const SESSIONS_REGISTRY_DIR = path.join(os.tmpdir(), "site-wp-app-sessions");

function registryPathFor(id: string): string {
  return path.join(SESSIONS_REGISTRY_DIR, `${id}.json`);
}

// The SDK's public Query type never exposes the PID of the subprocess it
// spawns, so this finds it the only way available: scan /proc for a direct
// child of this server process whose cwd matches the session's. The spawn
// happens synchronously inside query(), but this polls briefly anyway since
// /proc can lag a tick behind on a loaded system. Linux-only (WSL2/prod) —
// fails silently and harmlessly elsewhere, since this is a best-effort
// backstop, not load-bearing for normal operation.
async function findSpawnedChildPid(cwd: string): Promise<number | undefined> {
  const resolvedCwd = path.resolve(cwd);
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      const pids = await readdir("/proc");
      for (const entry of pids) {
        const pid = Number(entry);
        if (!Number.isInteger(pid)) continue;
        try {
          const statText = await readFile(`/proc/${pid}/stat`, "utf-8");
          // comm can itself contain spaces/parens, so PPID is the first
          // field after the *last* closing paren, not a naive split(" ")[3].
          const afterComm = statText.slice(statText.lastIndexOf(")") + 2);
          const ppid = Number(afterComm.split(" ")[1]);
          if (ppid !== process.pid) continue;
          const childCwd = await readlink(`/proc/${pid}/cwd`);
          if (childCwd === resolvedCwd) return pid;
        } catch {
          // Process exited mid-scan, or unreadable — skip it.
        }
      }
    } catch {
      return undefined; // No /proc (non-Linux) — give up silently.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return undefined;
}

async function writeSessionRegistry(id: string, pid: number, cwd: string) {
  try {
    await mkdir(SESSIONS_REGISTRY_DIR, { recursive: true });
    await writeFile(
      registryPathFor(id),
      JSON.stringify({ pid, cwd: path.resolve(cwd), ownerPid: process.pid }),
      "utf-8"
    );
  } catch {
    // Best-effort — losing this just means a later crash won't be able to
    // clean this particular session's subprocess up on next startup.
  }
}

async function removeSessionRegistry(id: string) {
  await unlink(registryPathFor(id)).catch(() => {});
}

// Backstop for the case the graceful-shutdown handler below can't cover: the
// server process gets force-killed (SIGKILL, or a process manager's kill
// timeout expiring) before it finishes closing sessions. Each session writes
// its subprocess's PID to disk on start and removes it on a clean close, so
// anything still on disk the next time this module loads belongs to a server
// generation that's gone — verify it's still the same process (cwd match,
// guarding against a reused PID) and kill it, then clear the stale file.
// Guarded against Turbopack's dev-mode hot reloading re-running this on
// every recompile of this file, the same way the Map above is pinned to
// globalThis.
//
// That globalThis guard is NOT enough on its own, though: Next.js dev also
// evaluates this module in separate worker processes (different PIDs, no
// shared globalThis), and each of those ran this sweep against the live
// server's still-running sessions — SIGTERMing every new session's subprocess
// seconds after it started ("exited with code 143"). So each entry records
// which server process owns it, and is only treated as orphaned once that
// owner is actually gone.
function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM means it exists but belongs to someone else — still alive.
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

async function reconcileOrphanedSessions() {
  let entries: string[];
  try {
    entries = await readdir(SESSIONS_REGISTRY_DIR);
  } catch {
    return; // Directory doesn't exist yet — nothing to reconcile.
  }
  for (const entry of entries) {
    const filePath = path.join(SESSIONS_REGISTRY_DIR, entry);
    try {
      const { pid, cwd, ownerPid } = JSON.parse(await readFile(filePath, "utf-8")) as {
        pid: number;
        cwd: string;
        ownerPid?: number;
      };
      // Owned by a server process that's still running (this one, or the
      // main dev server when we're a worker) — a live session, not an orphan.
      if (typeof ownerPid === "number" && isProcessAlive(ownerPid)) continue;
      try {
        const actualCwd = await readlink(`/proc/${pid}/cwd`);
        if (actualCwd === cwd) process.kill(pid, "SIGTERM");
      } catch {
        // Already dead, or /proc unavailable — nothing to kill either way.
      }
    } catch {
      // Unreadable/corrupt registry file — just clear it below.
    }
    await unlink(filePath).catch(() => {});
  }
}

if (!globalThis.__chatSessionsReconciled) {
  globalThis.__chatSessionsReconciled = true;
  void reconcileOrphanedSessions();
}

export function getSession(id: string): ChatSession | undefined {
  const session = sessions.get(id);
  if (session) maybeAutoResume(session);
  return session;
}

// Used only if prompts/continue.md can't be read — the resume still has to
// say something rather than silently sending nothing.
const AUTO_RESUME_FALLBACK = "Your usage limit has reset — please continue where you left off.";

/**
 * An auto-resume sends exactly what the Continue button sends: the contents of
 * prompts/continue.md. It used to send a bare one-liner instead, which quietly
 * dropped that file's actual instructions — check the TodoWrite list for what's
 * really done, re-read the original plan, don't trust a fuzzy recollection of
 * exact values. Resuming from a rate-limit pause is precisely when context may
 * have been compacted away, so that guidance matters more there than anywhere
 * else, not less. Read fresh each time, like fetchPromptTemplate does, so
 * editing the file takes effect on the next resume.
 */
async function sendAutoResume(session: ChatSession) {
  let text = AUTO_RESUME_FALLBACK;
  try {
    const contents = (
      await readFile(path.join(process.cwd(), "prompts", "continue.md"), "utf-8")
    ).trim();
    if (contents) text = contents;
  } catch {
    // Fall through to the hardcoded text.
  }

  const contextBlock = await buildContextBlock(session);
  text = text.includes("{{contextReport}}")
    ? text.replace("{{contextReport}}", contextBlock)
    : text + contextBlock;

  sendMessage(session, text, undefined, { auto: true });
}

/**
 * The re-read-fresh-off-disk report(s) for whichever task last sent a real
 * message with known context (see ChatSession.activeReportSlugs above).
 * Empty string when there's no known context or none of the files are
 * actually readable — continue.md is written so an empty {{contextReport}}
 * just leaves a blank line, not a dangling reference to nothing.
 */
async function buildContextBlock(session: ChatSession): Promise<string> {
  if (!session.activeReportSlugs || session.activeReportSlugs.length === 0) return "";
  const sections: { slug: string; content: string }[] = [];
  for (const slug of session.activeReportSlugs) {
    const report = await readReportFile(session.cwd, slug);
    if (report) sections.push({ slug, content: report });
  }
  return formatContinueContextBlock(session.activeLabel ?? "current task", sections);
}

// Backstop for the scheduled wakeTimer: every lookup (an SSE reconnect, a
// message send, an interrupt) checks whether a pending rate-limit reset has
// already passed and resumes right then if so — so recovery doesn't depend
// solely on that one timer having survived untouched for however many hours
// the wait was.
function maybeAutoResume(session: ChatSession) {
  if (
    session.qEnded &&
    session.pendingRateLimitReset !== undefined &&
    Date.now() >= session.pendingRateLimitReset * 1000
  ) {
    session.pendingRateLimitReset = undefined;
    void sendAutoResume(session);
  }
}

// A second, independent backstop: getSession()'s check only runs when
// something actually looks a session up (a reconnect, a message, an
// interrupt) — if the browser tab stays closed for the entire wait, nothing
// ever does. This sweep needs no client at all: it just wakes up on its own
// periodically and checks every session, so recovery never depends on the
// user's tab being open, or on any request happening to arrive right after
// the reset. Cleared-and-reset on module reevaluation for the same reason
// the Map above is pinned to globalThis — otherwise Turbopack's dev-mode hot
// reloading would stack up a duplicate interval on every route recompile.
if (globalThis.__chatSessionsSweepInterval) {
  clearInterval(globalThis.__chatSessionsSweepInterval);
}
globalThis.__chatSessionsSweepInterval = setInterval(() => {
  for (const session of sessions.values()) {
    maybeAutoResume(session);
  }
}, 60_000);

// Closes every live session properly (the SDK's own .return() cleanup, not
// just a bare kill) on normal termination, so a dev-server restart or deploy
// doesn't orphan subprocesses in the first place — reconcileOrphanedSessions
// above is only the backstop for when this can't run at all (SIGKILL, or a
// process manager's kill-timeout expiring before this finishes). Guarded the
// same way as the sweep interval above: Turbopack re-running this module's
// top level on every hot reload must not stack duplicate listeners.
if (globalThis.__chatSessionsShutdownHandler) {
  process.off("SIGTERM", globalThis.__chatSessionsShutdownHandler);
  process.off("SIGINT", globalThis.__chatSessionsShutdownHandler);
}
const shutdownHandler = () => {
  void Promise.all([...sessions.keys()].map((id) => closeSession(id))).finally(() => {
    process.exit(0);
  });
};
globalThis.__chatSessionsShutdownHandler = shutdownHandler;
process.on("SIGTERM", shutdownHandler);
process.on("SIGINT", shutdownHandler);

// Starts (or resumes) the underlying SDK query for a session and drains its
// messages into session.output. Used both for the session's initial query
// and, via resumeSessionId, to revive it after a hard rate-limit rejection
// ends the previous query outright.
function startQuery(session: ChatSession, resumeSessionId?: string) {
  session.qEnded = false;

  const q = query({
    prompt: session.input,
    options: {
      cwd: session.cwd,
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
      includePartialMessages: true,
      // Some tools (e.g. AskUserQuestion) always go through canUseTool
      // regardless of permissionMode, since the SDK can't silently
      // auto-approve a tool whose whole purpose is asking a human — honor
      // the app's auto-accept-everything policy ourselves instead of
      // blocking on a UI click that no longer exists.
      canUseTool: () => Promise.resolve({ behavior: "allow" }),
      ...(resumeSessionId ? { resume: resumeSessionId } : {}),
      ...(session.model ? { model: session.model } : {}),
      // Only overrides the environment at all when an explicit key was
      // given — otherwise leaves ambient auth (claude CLI login, or an
      // already-set ANTHROPIC_API_KEY) completely untouched.
      ...(session.apiKey ? { env: { ...process.env, ANTHROPIC_API_KEY: session.apiKey } } : {}),
    },
  });

  session.q = q;

  // Record the newly-spawned subprocess's PID for reconcileOrphanedSessions
  // to find if this server generation dies before closing it cleanly. Runs
  // every time startQuery does (fresh session or resume), since a resume
  // spawns a brand-new subprocess and the old registry entry would otherwise
  // point at an already-dead PID.
  void findSpawnedChildPid(session.cwd).then((pid) => {
    if (pid !== undefined) void writeSessionRegistry(session.id, pid, session.cwd);
  });

  // Drain the SDK's message generator into the combined output queue as
  // soon as the session exists, so nothing is missed if the SSE connection
  // attaches slightly later.
  (async () => {
    for await (const message of q) {
      const sdkSessionId = (message as { session_id?: string }).session_id;
      if (typeof sdkSessionId === "string") session.sdkSessionId = sdkSessionId;
      session.output.push(message);
      if (message.type === "assistant") {
        const blocks =
          (message as { message?: { content?: Array<{ type?: string; text?: string }> } }).message
            ?.content ?? [];
        const text = blocks
          .filter((block) => block.type === "text" && typeof block.text === "string")
          .map((block) => block.text)
          .join("\n");
        if (text) session.lastAssistantText = text;
      }
      if (message.type === "rate_limit_event") {
        scheduleWakeIfRejected(session, message as unknown as Record<string, unknown>);
      }
      // Not every rate limit surfaces as a structured rate_limit_event — a
      // session/hourly/weekly/etc. cutoff can instead end the query with a
      // plain-text notice in the assistant's own reply ("...resets 12:10am
      // (UTC)"). Without this fallback, that case leaves every auto-resume
      // path with nothing to react to, which looks exactly like silently not
      // resuming. Only kicks in if a real rate_limit_event hasn't already
      // scheduled a resume, so it never double-fires.
      //
      // The notice itself is the trigger, NOT terminal_reason "blocking_limit".
      // Requiring that reason is what actually broke auto-resume in practice:
      // the *first* rejection of a run arrives with it, but the rejection that
      // comes straight back after an auto-resume was observed ending the turn
      // without it — the notice was in the assistant's text, the turn ended,
      // and nothing scheduled anything. The session sat idle with no timer, no
      // give-up message, and qEnded false. A limit notice at the end of a turn
      // means the limit is in force regardless of how the result was labelled.
      //
      // Safe against false positives because lastAssistantText is cleared at
      // the start of every turn (see sendMessage), so this can only ever see
      // text the current turn actually produced, and the notice regex requires
      // a full "resets H:MM(am|pm) UTC" match.
      if (message.type === "result" && session.pendingRateLimitReset === undefined) {
        const notice = parseSessionLimitNotice(session.lastAssistantText);
        const blockingLimit =
          (message as { terminal_reason?: string }).terminal_reason === "blocking_limit";
        if (notice !== undefined) {
          const synthetic = {
            type: "rate_limit_event",
            rate_limit_info: {
              status: "rejected",
              resetsAt: notice.resetsAt,
              rateLimitType: notice.rateLimitType,
            },
            uuid: randomUUID(),
            session_id: session.sdkSessionId ?? "",
          } as unknown as SDKMessage;
          session.output.push(synthetic);
          scheduleWakeIfRejected(session, synthetic as unknown as Record<string, unknown>);
        } else if (blockingLimit) {
          // The wording didn't match — this app has no other way to recover a
          // reset time for this limit type, so without a visible trace, a
          // rephrased notice would silently reproduce the exact "no banner,
          // no autostart" bug this fallback exists to fix, with nothing
          // pointing at why. A server console.warn alone isn't enough — a
          // browser tab has no way to see it — so this also lands directly in
          // the chat transcript as a real assistant message, impossible to
          // miss the way a dead server log would be.
          console.warn(
            "[chat-sessions] blocking_limit result but couldn't parse a reset time from the assistant's text:",
            session.lastAssistantText
          );
          session.output.push({
            type: "assistant",
            message: {
              role: "assistant",
              content: [
                {
                  type: "text",
                  text:
                    "⚠️ This session hit a usage limit, but its reset time couldn't be parsed from the " +
                    "notice above — auto-resume has NOT been scheduled for this one. Press Continue " +
                    "yourself once the limit has actually reset.",
                },
              ],
            },
            uuid: randomUUID(),
            session_id: session.sdkSessionId ?? "",
          } as unknown as SDKMessage);
        }
      }
    }
    session.qEnded = true;
  })().catch((error) => {
    session.qEnded = true;
    session.output.push({
      type: "result",
      subtype: "error_during_execution",
      is_error: true,
      result: error instanceof Error ? error.message : String(error),
    } as unknown as SDKMessage);
  });
}

// The safety net for a client that's lost track of its sessionId (a stale
// tab, a hot-reload remount, a second tab opened on the same project) —
// rather than letting it silently spin up a second concurrent session
// against the same WordPress directory (two agents editing the same site at
// once is a real corruption risk: race conditions on the DB, conflicting
// Elementor edits), reconnect it to whichever session is already live for
// that cwd instead. `!qEnded` is "live"; a query merely paused on a rate
// limit is still live (and must not be duplicated) even though `qEnded` is
// briefly true between the rejection and the resume, so a pending
// `pendingRateLimitReset` also counts as live for this check.
export function getOrCreateSessionForCwd(
  cwd: string,
  model?: string,
  apiKey?: string
): ChatSession {
  for (const session of sessions.values()) {
    if (session.cwd === cwd && (!session.qEnded || session.pendingRateLimitReset !== undefined)) {
      return session;
    }
  }
  return createSession(cwd, model, apiKey);
}

export function createSession(cwd: string, model?: string, apiKey?: string): ChatSession {
  const id = randomUUID();
  const input = new PushableStream<SDKUserMessage>();
  const output = new PushableStream<OutboundEvent>();

  const session: ChatSession = {
    id,
    cwd,
    input,
    output,
    q: undefined as unknown as Query,
    model: model || undefined,
    apiKey: apiKey || undefined,
  };
  startQuery(session);
  sessions.set(id, session);

  return session;
}

// Recovers both the reset time and which limit was actually hit from a
// plain-text notice (e.g. "You've hit your session limit · resets 12:10am
// (UTC)", or equally "...your five-hour limit...", "...your weekly limit...")
// — the only place either fact exists for this notice style, since it never
// arrives as a structured rate_limit_info. Whatever phrase sits between "hit
// your" and "limit" becomes the badge's label, so an hourly/weekly/etc. limit
// reads correctly instead of every case being mislabeled as "session". The
// notice gives a bare time of day, not a date, so this assumes the next
// occurrence of that UTC clock time — today if it's still ahead of now,
// otherwise tomorrow — which matches how these rolling-window resets
// actually work (always within 24h).
//
// One wrinkle this has to guard against: this same function is also used to
// re-parse the *identical* notice text on a retry, if the backend's actual
// limit lifts a bit later than the stated time (see the 45s buffer below —
// observed to not always be enough). By the time that retry's rejection
// comes back, wall-clock time has already passed the stated hour:minute by
// design, so without a grace window every retry would look like the notice
// must mean "tomorrow," pushing the next attempt a full day out instead of
// moments later — silently turning "still catching up" into "stuck for
// ~24h." A generous grace window treats a small overrun as the same
// still-resolving window rather than a new day's occurrence.
const NOTICE_ROLLOVER_GRACE_MS = 45 * 60 * 1000; // 45 minutes
function parseSessionLimitNotice(
  text: string | undefined
): { resetsAt: number; rateLimitType: string } | undefined {
  if (!text) return undefined;
  // Tolerant of "(UTC)", "UTC" with no parens, or "GMT" — the exact wording of
  // this notice isn't a documented, stable API contract, so matching only one
  // literal punctuation/zone-name combination is a real way for this to go
  // silently blind the moment Anthropic rephrases it slightly.
  const timeMatch = /resets\s+(\d{1,2}):(\d{2})\s*(am|pm)\s*\(?(?:UTC|GMT)\)?/i.exec(text);
  if (!timeMatch) return undefined;

  let hour = parseInt(timeMatch[1], 10) % 12;
  if (timeMatch[3].toLowerCase() === "pm") hour += 12;
  const minute = parseInt(timeMatch[2], 10);

  const now = new Date();
  const candidate = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour, minute, 0, 0)
  );
  if (candidate.getTime() <= Date.now() - NOTICE_ROLLOVER_GRACE_MS) {
    candidate.setUTCDate(candidate.getUTCDate() + 1);
  }

  const typeMatch = /hit your ([a-z0-9][a-z0-9\s-]*?) limit/i.exec(text);
  const rateLimitType = typeMatch ? typeMatch[1].trim().toLowerCase() : "usage";

  return { resetsAt: Math.floor(candidate.getTime() / 1000), rateLimitType };
}

// Session/usage rate limits (distinct from tool permissions) report
// resetsAt as a unix seconds timestamp once status is "rejected". Schedule
// a server-side timer (survives the browser tab closing, unlike a
// client-side one) that nudges Claude Code to continue right at reset.
function scheduleWakeIfRejected(session: ChatSession, message: Record<string, unknown>) {
  if (session.wakeTimer) {
    clearTimeout(session.wakeTimer);
    session.wakeTimer = undefined;
  }
  session.pendingRateLimitReset = undefined;

  const info = message.rate_limit_info as
    | { status?: string; resetsAt?: number }
    | undefined;
  if (info?.status !== "rejected" || typeof info.resetsAt !== "number") {
    // Not a rejection — whatever window we were retrying is over.
    session.retryNoticeKey = undefined;
    session.retryStreak = undefined;
    return;
  }

  // Is this the same limit window we were already retrying, still not lifted?
  //
  // Keyed on the reset's UTC clock time (HH:MM) for BOTH detection paths. They
  // used to key differently — a structured event as `epoch:1785591000`, a
  // text-parsed notice as `13:30` — which are the same 13:30 limit but never
  // compare equal, so a window that surfaced one way and then the other reset
  // the streak to 0 every round. The attempt cap could then never be reached
  // and the give-up message could never fire. Clock time normalises both, and
  // survives the text path's day-rollover too: tomorrow-13:30 and today-13:30
  // both key as "13:30", which is exactly the "same limit, still not lifted"
  // case this needs to catch.
  const windowKey = new Date(info.resetsAt * 1000).toISOString().slice(11, 16);
  const sameWindow = windowKey === session.retryNoticeKey;
  session.retryStreak = sameWindow ? (session.retryStreak ?? 0) + 1 : 0;
  session.retryNoticeKey = windowKey;

  // Attempts for this window are spent. Retrying the *same* resume
  // (`resume: session.sdkSessionId`) N more times was never going to help if
  // it's failed N times already for the same reason — traced directly: a
  // heavy conversation's own resume can keep failing well past the point the
  // real rate limit has lifted (confirmed live — a manual Continue click
  // succeeds within seconds of a "gave up" notice, which a still-active
  // limit could not explain). What actually fixes it by hand is the accident
  // of getOrCreateSessionForCwd() treating a qEnded+no-pending-reset session
  // as not live and handing back a *fresh* session instead of resuming the
  // broken one. Do that automatically here instead of waiting for the user to
  // rediscover it by clicking Continue: drop the old SDK session id so the
  // next start is a genuinely new conversation, then send the same
  // continue.md + re-read-reports text a manual Continue would. The old,
  // large conversation is simply abandoned — its report files on disk are
  // what carry the real content forward, same as any other Continue.
  if (session.retryStreak >= MAX_AUTO_RESUME_ATTEMPTS) {
    session.pendingRateLimitReset = undefined;
    const attempts = `${MAX_AUTO_RESUME_ATTEMPTS} attempt${MAX_AUTO_RESUME_ATTEMPTS === 1 ? "" : "s"}`;
    session.output.push({
      type: "assistant",
      message: {
        role: "assistant",
        content: [
          {
            type: "text",
            text:
              `⚠️ Auto-resume couldn't pick the original conversation back up after ${attempts} ` +
              `(resuming it kept failing, independent of whether the stated limit had actually ` +
              `lifted). Starting a fresh session with the same task context re-read from disk, ` +
              `rather than the interrupted conversation itself.`,
          },
        ],
      },
      uuid: randomUUID(),
      session_id: session.sdkSessionId ?? "",
    } as unknown as SDKMessage);
    session.retryStreak = undefined;
    session.retryNoticeKey = undefined;
    session.sdkSessionId = undefined;
    void sendAutoResume(session);
    return;
  }

  // 45s past the stated reset, matching the client-side buffer (both now come
  // from lib/rate-limit-timing) — a real rejection was observed to arrive
  // twice, seconds apart, when the two margins differed and the actual backend
  // limit lifted a little later than the notice's stated time.
  //
  // Floored, never 0: if the backend is still lagging when a retry lands,
  // resetsAt is already in the past, which without a floor would fire the next
  // attempt near-instantly — a tight, real-money retry loop against a limit
  // that isn't actually clear yet.
  //
  // On a repeat of the same window, the parsed resetsAt is deliberately NOT
  // trusted: the notice carries only a bare clock time, so once a retry lands
  // past the rollover grace it resolves to *tomorrow* and would schedule the
  // next attempt ~23 hours out — silently indistinguishable from auto-resume
  // being broken, which is exactly how this failed in practice. Use fixed
  // spacing instead.
  const delayMs = sameWindow
    ? RETRY_SPACING_MS
    : Math.max(info.resetsAt * 1000 - Date.now() + RESET_BUFFER_MS, MIN_RETRY_DELAY_MS);

  // Keep the backstop in maybeAutoResume() consistent with the timer: on a
  // backed-off retry the stated resetsAt is already in the past, so storing it
  // unchanged would let the very next session lookup fire an immediate resume
  // and defeat the backoff entirely.
  session.pendingRateLimitReset = Math.floor((Date.now() + delayMs) / 1000);

  session.wakeTimer = setTimeout(() => {
    session.wakeTimer = undefined;
    session.pendingRateLimitReset = undefined;
    void sendAutoResume(session);
  }, delayMs);
}

export interface InlineImage {
  mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  data: string;
}

export function sendMessage(
  session: ChatSession,
  text: string,
  images?: InlineImage[],
  options?: { auto?: boolean; context?: { label: string; reportSlugs: string[] } }
) {
  if (session.wakeTimer) {
    clearTimeout(session.wakeTimer);
    session.wakeTimer = undefined;
  }
  session.pendingRateLimitReset = undefined;

  // A real message from the user starts something new — any backoff streak
  // from a previous limit window shouldn't carry into it. An auto-resume is
  // the opposite: it's the retry itself, so its streak has to survive.
  if (!options?.auto) {
    session.retryNoticeKey = undefined;
    session.retryStreak = undefined;
    // Only ever set, never cleared, here — see ChatSession.activeReportSlugs.
    if (options?.context) {
      session.activeLabel = options.context.label;
      session.activeReportSlugs = options.context.reportSlugs;
    }
  }

  // Start each turn with no carried-over assistant text. The result handler
  // treats a limit notice in lastAssistantText as proof the limit is in force,
  // so a notice left over from a previous turn would schedule a resume for a
  // turn that ended perfectly normally — most easily on a turn that produces
  // only tool calls and no text of its own.
  session.lastAssistantText = undefined;

  // A message sent by the browser gets its chat bubble from the browser's
  // own optimistic local echo (see chat-panel.tsx's sendText) before it ever
  // reaches here — nothing else needs to show it. A server-triggered auto-
  // resume (maybeAutoResume / the wakeTimer callback above) has no browser
  // involved at all, so without this, it was completely invisible: it never
  // appeared as a chat item on any client, live or reconnecting, making a
  // working auto-resume indistinguishable from a broken one.
  if (options?.auto) {
    session.output.push({
      type: "system",
      subtype: "auto_resume",
      text,
      uuid: randomUUID(),
      session_id: session.sdkSessionId ?? "",
    } as unknown as SDKMessage);
  }

  if (session.qEnded) {
    // A "rejected" rate limit is a hard stop, not a pause: the SDK's query
    // loop actually terminates (terminal_reason "blocking_limit"), so the
    // old query/input pair no longer has anything reading from it. Reusing
    // the same input stream for the resumed query would also risk resolving
    // a dangling reader left over from the dead one, so swap in a fresh
    // stream and resume the same underlying conversation with a new query.
    session.input = new PushableStream<SDKUserMessage>();
    startQuery(session, session.sdkSessionId);
  }

  const content =
    images && images.length > 0
      ? [
          ...images.map((image) => ({
            type: "image" as const,
            source: { type: "base64" as const, media_type: image.mediaType, data: image.data },
          })),
          ...(text ? [{ type: "text" as const, text }] : []),
        ]
      : text;

  session.input.push({
    type: "user",
    message: { role: "user", content },
    parent_tool_use_id: null,
  });
}

export async function interruptSession(session: ChatSession) {
  await session.q.interrupt();
}

// Terminates the underlying Claude Code subprocess (Query.return() runs the
// SDK's own cleanup, which closes the transport and kills the process) and
// removes the session from the map. Without this, "New Chat" only reset
// client-side state — the old session's process kept running indefinitely
// with no way to reach it again.
export async function closeSession(id: string): Promise<boolean> {
  const session = sessions.get(id);
  if (!session) return false;

  if (session.wakeTimer) {
    clearTimeout(session.wakeTimer);
    session.wakeTimer = undefined;
  }

  sessions.delete(id);
  await removeSessionRegistry(id);

  if (!session.qEnded) {
    try {
      await session.q.return(undefined);
    } catch {
      // Best-effort — the process is being torn down either way.
    }
  }

  return true;
}
