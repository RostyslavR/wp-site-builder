/**
 * Shared timing rules for auto-resuming a rate-limited session. Lives in its
 * own module with no SDK/server imports so both the server (lib/chat-sessions)
 * and the client (components/chat-panel) can use exactly the same numbers —
 * they previously each hard-coded their own and drifted apart, leaving the
 * client firing instantly where the server waited two minutes, despite a
 * comment claiming the two matched.
 */

/** Slack past a notice's stated reset time, to absorb a backend that lifts slightly late. */
export const RESET_BUFFER_MS = 60_000;

/**
 * Floor for any retry. Never 0: when a notice's stated reset time has already
 * passed but the backend still rejects, an unfloored delay computes to
 * "immediately", producing a tight retry loop that costs real money against a
 * limit that isn't actually clear yet.
 */
export const MIN_RETRY_DELAY_MS = 200 * 1000;

/**
 * Spacing between auto-resume attempts for the same limit window.
 *
 * A fixed gap rather than a re-derived reset time: the notice carries only a
 * bare clock time ("resets 10:50pm") with no date, so once a retry lands past
 * the rollover grace it resolves to *tomorrow* and schedules the next attempt
 * ~23 hours out — indistinguishable from auto-resume being broken, which is
 * how this actually failed.
 */
export const RETRY_SPACING_MS = 200 * 1000;

/**
 * How many auto-resume attempts to make for one limit window before stopping.
 *
 * Deliberately small. Attempts are free (a rejected resume reports
 * total_cost_usd 0), so the limit isn't about cost — it's that a backend which
 * hasn't lifted after this many tries usually needs a real wait, and quietly
 * retrying for hours buries the transcript. Giving up is only acceptable
 * because it's announced: see the auto_resume_stopped path in lib/chat-sessions,
 * which posts a visible message rather than just going silent.
 */
export const MAX_AUTO_RESUME_ATTEMPTS: number = 2;
