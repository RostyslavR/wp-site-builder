# WP Site Builder

A Next.js dashboard that drives a [Claude Agent SDK](https://github.com/anthropics/claude-agent-sdk-python) session
against a WordPress + Elementor project, to rebuild it as a pixel-accurate match of a separate reference design
(e.g. a React/Vite mockup) and keep it that way through review and fix passes.

## What it does

The dashboard's Settings panel points at four things: the reference design's source directory and URL, and the
WordPress project's source directory and URL (plus an optional live-deployed URL). The chat panel runs a real Claude
Code session against the WordPress project directory, with one button per stage of the workflow:

- **Analyze** — investigate both projects and produce a detailed migration plan.
- **Build** — implement that plan: theme, pages, media, plugins.
- **Install Site** — start the reference design's own dev server, if it isn't already running.
- **Review: UI / Accessibility / Performance / Best Practices / SEO / Cache / !Important** — a family of independent
  review passes, each producing a written report (and, for most, a Lighthouse/axe-core-backed automated scan) without
  making any changes yet. A "Live" checkbox lets these run against a deployed URL instead of the local build.
  !Important audits the project's own CSS (excluding Elementor/vendor code) for `!important` overuse — a
  maintainability smell, not a compliance standard.
- **Pre-Migration / Theme** — two source-code-only reviews, always local (no Live checkbox effect, since both need
  direct filesystem access this app doesn't have against a live server). Pre-Migration checks for the kind of thing
  that causes migration bugs (hardcoded URLs, placeholder email sender domains, plugin integrity, exposed backup
  folders) — see the Migration Guide
  dialog for the full runbook. Theme audits the active theme's own PHP (escaping, sanitization, nonces, SQL safety,
  deprecated APIs, global-variable hygiene, enqueue correctness) and CSS architecture (dead/duplicate rules,
  hardcoded values with an existing design-token equivalent) — everything about the theme's own code quality that
  isn't `!important` overuse specifically.
- **Change** — takes whichever review report was most recently produced and fixes every finding in it, matched to
  whatever standard that finding is actually graded against (visual parity with the original, an accessibility/
  performance/SEO standard, etc.), not a single one-size-fits-all rule. It reads that report from the file the review
  saved (`<wp project>/reports/<review>-report.md`), so it still works after the tab was closed or the chat was
  reset — falling back to the chat transcript only if no report file exists. A line under the buttons shows which
  report it would use and how old it is.
- **Prompt** — an escape hatch for one-off instructions, editable in `prompts/custom-prompt.md`.
- **Continue** — nudges a session that's paused (e.g. mid rate-limit wait) rather than starting something new.

Rate-limit pauses are handled automatically: the app schedules its own resume once a session reports a rejected
usage limit, both client-side (while a tab stays open) and server-side (so it recovers even if the tab was closed).

## Getting started

```bash
npm install
npm run dev
```

Opens on [http://localhost:4789](http://localhost:4789) (not the Next.js default 3000 — set in `package.json`'s
`dev` script, since 3000 is often already in use by whatever's being built).

Fill in the Settings panel with the two projects' directories and URLs before using any of the buttons.

## Project layout

- `app/`, `components/`, `lib/` — the dashboard itself (Next.js App Router, shadcn/ui on Base UI, Tailwind v4).
- `prompts/` — the actual instructions sent to the Claude Code session for each button; edit these directly to
  change what a button does. `prompts/custom-prompt.md` is the one meant to be rewritten per one-off task.
- `docs/` — reference material shown in the dashboard's own dialogs (Info, Migration Guide), not sent to the agent.
