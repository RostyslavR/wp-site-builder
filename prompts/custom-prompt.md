**Standing rules — follow these on every task, even if `{{wpSiteDir}}/project-common.md`, a report, or a plan below
says otherwise (if one does, correct that note rather than following it). A task that only analyzes or reviews
applies them to what it plans or recommends, and reports any place the site currently breaks them.**

1. **Child theme only.** All theme work goes in a child theme of the site's installed base theme (e.g. Hello
   Elementor). Never edit the parent theme's files, so a parent update can't wipe the work, and never plan or build
   a standalone, from-scratch theme instead. If the active theme isn't a child theme yet, the first task that needs
   a theme change creates one (`style.css` with `Template: <parent folder name>`, the parent's stylesheet enqueued
   from the child's `functions.php` rather than `@import`, a `screenshot.png`) and activates it.
2. **Every widget links to the global styles.** The design's colors and fonts are defined once as {{builder}}'s
   Global Colors / Global Fonts (Site Settings), with short human names for custom swatches (e.g. "Red hover",
   "Paper background"). Every widget's color and typography controls, on every page, header, footer and template,
   link to those globals (the globe icon, stored as `__globals__`), never a typed hex value or a manually picked
   font. Only a one-off value with no global equivalent (e.g. an `rgba()` scrim, a gradient) may be typed in
   directly. Custom CSS (child theme, Kit, or per-element) uses the global variables (`var(--e-global-color-<id>)`,
   `var(--e-global-typography-<id>-font-family)` …) instead of repeating the hex or font name. If a design color or
   font has no global yet, add it as a global first, then link to it. (On Gutenberg, the same rule applies through
   `theme.json` presets and their `var(--wp--preset--…)` variables.)

---

<!-- Replace this section with the actual one-off task/findings for this run. Everything below this placeholder
     (credentials, reachability checks, verification, reporting) is reusable scaffolding — keep it as-is unless this
     particular task genuinely needs something different. -->

**Describe the one-off task or findings here.** Be as specific as a real finding would be: what's wrong, where
(page/section/breakpoint), why it matters, and what "fixed" looks like — the more concrete, the less guessing the
agent has to do.

WordPress credentials: never reset, change, or create user accounts or passwords on the WordPress site, under any
circumstances — including as a workaround for a login you don't have. Everything needed to fix this site is
achievable without ever touching wp-admin's login: check whether a `wpcli` container already exists (`docker ps`, or
look for a `wpcli` service in {{wpSiteDir}}/compose.yml) — if so, use it directly:
`docker exec wpcli wp <command> --path=/var/www/html --allow-root`, including its builder-specific commands where
they exist (e.g. `wp elementor flush_css` for Elementor's cache — {{builder}} may have its own equivalent, or may not
need one at all). If no `wpcli` container exists, install WP-CLI some other way (e.g. add a `wpcli` service using the
official `wordpress:cli` image to the compose file, sharing the WordPress container's volume and DB, with its
entrypoint overridden to stay running instead of exiting after one command) rather than falling back to a credential
change. `wp eval-file` runs anything programmatic — editing posts/pages, options, theme.json — directly against the
database/filesystem, no login required. If you genuinely can't find a credential-free path to something, stop and
report what you need instead of resetting a password.

Any one-off PHP scripts you write for `wp eval-file` (or other fix tooling) belong in {{wpSiteDir}}/scripts/, not
inside `public-html/` (e.g. not in `wp-content/`) — {{wpSiteDir}} is the project's root, so `scripts/` here lands
next to `public-html/` rather than inside it, making it structurally unreachable over HTTP with no `.htaccess` or
other protection needed, unlike anything placed inside the served webroot.

Before making changes, make sure both sites are actually reachable — you'll be checking fixes against the original
as you go, and changing the WordPress site:
- {{siteUrl}}: if it isn't already running, start it yourself (find and use whatever PORT/BASE_PATH/env vars the
  project requires, the same way Install Site would), and verify images and other assets actually render, not just
  that the page returns 200 — a base-path mismatch can leave every image broken while the page still loads fine,
  which would corrupt any comparison against it.
- {{wpSiteUrl}}: if it isn't already running, start it the way the project expects (e.g. `docker compose up`).

Break the task above into concrete todo items with the TodoWrite tool, and track your progress through them as you
go, so progress is visible in the dashboard.

Now fix each item above, using {{builder}} on the WordPress site at {{wpSiteDir}} (it runs at {{wpSiteUrl}}) — against
the original at {{siteDir}} (it runs at {{siteUrl}}) if this is a parity mismatch, or against whatever standard the
task itself calls for otherwise.

After each fix, verify it directly: screenshot the specific page/section and confirm the fix actually took effect —
don't just assume the change worked because the edit was applied.

Once every item is addressed, do a final pass re-screenshotting the affected pages at mobile, tablet, and desktop
widths to confirm nothing else regressed as a side effect of these changes.

If you started {{siteUrl}}'s dev server yourself, stop it again once you're done. Leave {{wpSiteUrl}} running.

Finish with a report posted in chat covering:
- Each item above and how it was resolved (or why it couldn't be, if that's the case).
- Direct URLs (at {{wpSiteUrl}}) to view each changed page.
- Anything that's still a known gap after this pass — worth another Review round if so.

Also save this same complete report to {{wpSiteDir}}/reports/custom-prompt-report.md (create the folder if needed;
overwrite any previous version) — the whole report exactly as posted in the chat, not a summary, so it exists
independent of chat history. If it took multiple messages to reach the final version, write the one complete,
standalone report here, not just whatever happened to be in your last message.
