Stack

This dashboard is a Next.js (App Router) app that drives Claude Code (via the Claude Agent SDK) against a local WordPress installation, using shadcn/ui (Base UI primitives + Tailwind CSS) for the interface.

- Next.js 16 + React 19 — this dashboard
- @anthropic-ai/claude-agent-sdk — runs the Claude Code agent against your WP site directory
- shadcn/ui (Base UI primitives) + Tailwind CSS — UI components
- Playwright — launched on demand by the agent to screenshot your site and the reference site side by side. Used by Analyze, Build, Review UI, and Change — every step except Install Site.

Setup

1. Node.js and this project's npm dependencies (npm install).
2. A running WordPress install and reference site, with their paths/URLs filled in under Settings.
3. For Analyze, Build, Review UI, and Change (anything that screenshots the sites to compare them): headless Chromium needs a few system libraries that aren't installed by default on most minimal Linux images. Install them with (either command can be run from anywhere — both are machine-wide, not scoped to this or any other project directory):

     npx playwright install chromium
     npx playwright install-deps chromium

   Don't prefix the second command with `sudo` yourself — it checks whether it's already root and, if not, elevates itself (spawns `sudo apt-get ...` internally) to install the OS packages it needs (on Debian/Ubuntu: libnspr4, libnss3, libatk1.0-0, libatk-bridge2.0-0, libcups2, libgbm1, and similar). It'll prompt you for your sudo password itself when it gets to that point. Running `sudo npx ...` instead switches to root's PATH before `npx` even runs, which often doesn't include wherever nvm/your Node install put `npx` — giving "sudo: npx: command not found" instead of the deps actually installing.

   Without those libraries, the affected steps fail partway through with an error like:

     error while loading shared libraries: libnspr4.so: cannot open shared object file: No such file or directory

   If you don't have sudo access at all in this environment, run that second command on a machine/container where you do, or ask whoever manages the environment to run it once.

   Note: this app doesn't depend on Playwright itself (the agent only uses it ad hoc when it writes a screenshot script, in whatever directory that runs in) — so `npx playwright install...` here will warn that "your project's dependencies" aren't installed. That's expected and safe to ignore: the browser binary and system libraries it installs are both machine-wide, not tied to any one project's node_modules.
