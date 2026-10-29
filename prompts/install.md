Prepare the project at {{siteDir}} to run locally, so it can be started afterwards with a fixed, known set of commands.

Track your progress through the numbered steps below with the TodoWrite tool as you go, so progress is visible in
the dashboard.

1. Inspect {{siteDir}} to understand its structure: a single app, or a monorepo with separate frontend and
   backend/server packages. Identify the package manager from the lockfile (npm, pnpm, or yarn) and use that one
   exclusively.
2. Install dependencies. Handle anything non-interactive that would otherwise block a plain install (e.g. pnpm's
   build-script approval step) so a single install command works end-to-end from now on.
3. Work out what each runnable part needs to listen on a specific port — env vars, config flags, or defaults — and
   configure it to run on:
   - Server (only if the project has a separate backend from the frontend): {{serverPort}}
   - Frontend: {{frontendPort}}
   If it's a single app with one dev server, use {{frontendPort}} for it and ignore {{serverPort}}.
4. Find the pages/components/designs the frontend contains (e.g. a components or pages directory, a router's route
   list) and the images/assets each one references. Identify which one is the actual homepage — the main landing
   design, not a sub-section, variant, or utility page — and note its path.
5. If the frontend's root path ("/") currently shows a placeholder, index, or gallery rather than real site content,
   and you identified a homepage in step 4, modify the frontend's routing so the homepage renders at "/" directly
   (not a redirect — render the homepage component itself there). If other pages are reached through a path that's
   just the preview tool's own bookkeeping (e.g. a "/preview/" prefix, or a directory grouping that doesn't mean
   anything outside the source tree), give each one the shortest unique path instead — bare "/<name>" when no two
   discovered pages share that name, falling back to just enough of the original path to tell them apart when they
   do. The homepage itself is always exactly "/", never "/<name>".
6. Note any other requirements to actually run the project (databases, required env vars, Docker services, etc.).
   Don't provision them — just record what's needed and whether it's already satisfied.
7. Smoke-test: start each part in the background — server first (if present), then frontend — then confirm each
   responds AND that its actual content loads correctly, not just that the root URL returns 200. A client-rendered
   app's shell HTML can return 200 while every image inside it 404s, so also check that hardcoded absolute asset
   paths in the source (e.g. `src="/something/images/..."`) actually resolve against whatever base path / URL
   prefix you're running with — if they don't, either fix the base path to match what the source already assumes,
   or fix the source references, whichever is the smaller change. Stop each part again once confirmed. Fix anything
   that fails before moving on.

Finish with a concise summary posted in chat covering: what you found (including the homepage and other
pages/components discovered), any restructuring you did and why, and any other requirements/caveats — then end the
summary with the exact command(s) to start each part as the last thing in your response — server first (if present),
then frontend — so they're the last thing read and easiest to copy.
