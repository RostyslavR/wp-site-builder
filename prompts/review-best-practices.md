Review the WordPress site at {{wpSiteDir}} (it runs at {{wpSiteUrl}}) for general web and WordPress best-practices
issues — the kind of technical hygiene that isn't visual design, accessibility, or raw page speed, but still affects
security, reliability, and maintainability. Do not make any code or content changes yet — this is a comparison +
reporting task only, same as the other review prompts.

This review is scoped to {{wpSiteUrl}}/{{wpSiteDir}} only — evaluate it against general web/WordPress best practices
directly, not against {{siteUrl}}/{{siteDir}}. Most of what this pass checks (WordPress hardening,
broken internal links, console errors) doesn't have a meaningful counterpart on the original Vite/React mockup at
all, so don't compare against it or start it for this pass.

{{liveReviewNote}}

Track your progress through the steps below with the TodoWrite tool as you go, so progress is visible in the
dashboard.

1. Check that {{wpSiteUrl}} is actually reachable before reviewing it — it should already be running from earlier
   steps. Do not start it yourself: if it isn't reachable, stop here and report that back instead of spending time
   bringing it up.
2. Enumerate every real page/post that exists on {{wpSiteUrl}} (check {{wpSiteDir}} and the {{builder}} content, not
   just the homepage).
3. Before using Playwright, confirm it's actually resolvable globally (`NODE_PATH=$(npm root -g) node -e
   "require.resolve('playwright')"`) rather than assuming a prior session set it up. If not, install it globally,
   once for this whole host — `npm install -g playwright` — and use Playwright only, never `puppeteer` alongside or
   instead of it (remove a redundant one if you find it). Always run any script that needs it with
   `NODE_PATH=$(npm root -g)` set (e.g. `NODE_PATH=$(npm root -g) node {{wpSiteDir}}/scripts/<script>.js`) — a global
   install alone doesn't make `require('playwright')` resolve from an arbitrary project directory without it. The
   browser binary itself is usually already cached globally at `~/.cache/ms-playwright/` from other projects' prior
   work; check there before re-running `npx playwright install chromium`, which re-downloads needlessly otherwise.
   Then set `CHROME_PATH` to a native Linux Chrome/Chromium binary (`which chromium`, `chromium-browser`, or
   `google-chrome`, or Playwright's own bundled Chromium under `~/.cache/ms-playwright/`) rather than letting
   Lighthouse's chrome-launcher fall back to a Windows-side Chrome through WSL interop — that path is known to
   fail outright with `ECONNREFUSED` on several pages in this environment, and separately leaves stray
   `C:\Users\...` scratch-profile folders behind as a side effect of the failed attempt (see the cleanup step
   below). **Run Lighthouse with {{wpSiteDir}} as the working directory** (`cd {{wpSiteDir}}` first), never from this
   dashboard app's own repo: Chrome's launcher drops its disposable scratch profile into the current working
   directory when the path quirk below hits, and a stray profile inside the app repo breaks its dev server outright
   (the bundler walks the project tree, hits the profile's `SingletonSocket`, and fails on a file that is a socket
   rather than a regular file). It also keeps the debris in the one place the cleanup step below looks.
   Then run Lighthouse's Best Practices category across every page (`CHROME_PATH=<path found above> npx
   lighthouse <url> --output=json
   --output-path={{wpSiteDir}}/reports/lighthouse/<page-slug>-best-practices.json --chrome-flags="--headless=new --no-sandbox --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-renderer-backgrounding"
   --only-categories=best-practices`, creating `{{wpSiteDir}}/reports/lighthouse/` first if it doesn't exist yet —
   same `reports/` location everything else in this project saves to, not wherever Lighthouse/Chrome would default to
   otherwise) — this catches things like browser console errors/warnings, deprecated APIs, incorrect image aspect
   ratios, missing charset/doctype declarations, and mixed content. An HTTPS-related finding is expected and not
   actionable if this is reviewing the local `http://localhost` dev environment — flag it as a go-live item rather
   than something to fix now, the same way domain/hosting/SSL is already handled as a deferred item elsewhere in this
   project. If this review is instead running against a live deployed URL (see any live-review note above), an HTTPS
   finding there is real and actionable — it isn't a deferred local-dev non-issue in that case.

   **Known local-dev latency, already diagnosed:** if this is the local Docker-hosted dev environment, expect TTFB to
   be dramatically inflated (measured 12-17s on a basic page load) — a diagnosed artifact of Elementor/Elementor
   Pro's heavy filesystem scanning combined with {{wpSiteDir}} living on a Windows drive bind-mounted into Docker
   (cross-WSL/Windows file I/O measured ~2.5x slower than native), not a real site defect (see `review-performance.md`
   for the full diagnosis) — don't report it as a best-practices finding to fix here. If a page's run fails outright (e.g. `NO_FCP` — no paint captured at all) despite the flags above, retry that one page's audit once before giving up on it — this specific failure is a known Chrome-throttling flake, not necessarily a real defect in the page, but a page that fails twice in a row is worth reporting as genuinely unreviewed rather than silently omitted. Afterward, check for
   and delete any stray Chrome temp-profile directories Lighthouse's browser launch left behind (recognizable by a
   `Default/`/`Local State`/`Safe Browsing` structure — Chrome's own disposable scratch profile, never real report
   content) — check both the usual OS temp location and, due to a known WSL/Windows path-interop quirk, directly
   inside {{wpSiteDir}} itself, where one can land as a single oddly-named folder containing literal backslashes/
   colons (e.g. `C:\Users\...\lighthouse.NNNNNN`) instead of a real nested Windows path.
4. Beyond the automated pass, specifically check:
   - Do **not** audit the plugin/theme inventory. Available updates, inactive plugins, unused bundled themes, and a
     migration or maintenance plugin left active on a deployed site are all deliberately out of scope for this
     review — the inventory is the user's own decision, made via Build Options, and they don't want it re-reported.
     Don't run `wp plugin list`/`wp theme list` to survey it, and don't raise inventory findings as a side note under
     some other heading. This says nothing about *changing* anything: never install, activate, deactivate, remove or
     update a plugin or theme in any pass, which remains true everywhere. Naming a specific plugin as the *cause* of
     a different finding is still fine and expected (e.g. a builder widget emitting invalid markup) — what's out of
     scope is auditing what's installed, how old it is, and whether it should be there.
   - WordPress hardening basics: is the WordPress version exposed in the page `<meta name="generator">` tag (a minor
     but real, easily-fixed information-disclosure issue)? Is directory listing disabled for `wp-content/uploads/`
     and other asset directories? Is XML-RPC (`xmlrpc.php`) still enabled with no plugin actually depending on it (a
     common brute-force/DDoS-amplification vector when left on unnecessarily)?
   - `robots.txt`: reachable, and sensible — not blocking the whole site, not needlessly exposing `wp-admin`-adjacent
     paths beyond WordPress's own sane defaults.
   - Favicon: present and actually rendering in the browser tab, not a default/missing icon.
   - 404 handling: request a real nonexistent URL on the site and confirm it returns a proper themed 404 page (not a
     raw PHP error, a blank white screen, or a silent 200).
   - Broken internal links: check the nav, footer, and body copy across all pages for any link pointing to a URL
     that 404s on this site — an easy, common mistake when content gets restructured during a rebuild.
   - Local-network requests (**live reviews only** — skip entirely if this pass is running against the local
     `http://localhost` dev environment, where such requests are correct by definition and reporting them would be
     pure noise; same conditional treatment as the HTTPS finding in step 3): on every page, capture the full network
     request list and flag any request whose host is `localhost`, `127.0.0.1`, `::1`, a `.local` name, or a private
     IPv4 range (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`). A public site must never request any of these —
     it means a dev-environment URL survived migration in the database or in a builder's compiled CSS.
     **Critically: how these requests fail depends on the Chromium build, so don't check for one symptom.** In some
     builds they never fail at all — they hang at `Pending` while the browser blocks on its local-network-access
     permission prompt ("wants to access other apps and services on this device"), so a check that only inspects
     failed or 4xx/5xx responses reports the page as clean. In others the loopback/local-network-access policy
     rejects them outright and they surface as `net::ERR_FAILED` (often alongside a CORS error), never reaching a
     permission prompt at all. Both are the same defect and both are high severity; collect requests that errored
     **and** requests that were issued but never settled, and treat either as a finding. State in the report which
     behavior you actually observed, rather than restating the expected one. Report each finding with its
     **initiator** (the stylesheet, script, or document that issued it), not merely the request URL — the initiator is what identifies the source, e.g. the
     builder's compiled per-page CSS pointing back at its own stale stored page data (`post-<id>.css` and
     `_elementor_data` when {{builder}} is Elementor). Severity: high either way — the asset is
     broken for every real visitor, and depending on the browser it also downgrades an HTTPS page to mixed content
     or raises a local-network permission prompt.

     **Write the fix direction precisely — "re-run a serialization-safe search-replace" is wrong on its own and
     will fail a second time.** Builders that store layouts as JSON (Elementor's `_elementor_data`) hold the URL
     backslash-escaped by `json_encode`, as `http:\/\/host:port\/wp-content\/...`, which a plain `http://host:port`
     search never matches — different bytes, and `--precise`/`--recurse-objects` don't help, since this is JSON
     string escaping inside a value rather than PHP serialization. This is normally the actual reason a leak
     survived a migration whose find-replace reported a large, healthy count. So the fix direction must cover the
     builder data and everything else **separately**, because no single tool does both:
     - **Builder data** — prefer the builder's own URL tool over hand-typing escaped strings. Elementor ships
       **Tools → Replace URL** (CLI: `wp elementor replace-urls <from> <to>`), which escapes the slashes itself
       (`includes/utils.php`: `str_replace( '/', '\\/', $from )`), targets the JSON `_elementor_data` rows, and
       clears the compiled-CSS cache in the same call. If the builder has no such tool, fall back to a manual
       search-replace on the `\/`-escaped URL plus a separate CSS regeneration.
     - **Everything else** — a normal plain-URL search-replace, since the builder tool touches only its own data
       and leaves menu-item URLs, plugin options (e.g. {{seoPlugin}}'s stored logo/OG image), post content and
       `siteurl`/`home` untouched.
     Confirm the compiled CSS actually got rebuilt either way, since the on-disk `post-*.css` keeps serving old URLs
     no matter what the database says. Where wp-cli is available, confirm the split before writing the report by dry-running
     both forms (`wp search-replace '<old>' '<new>' --dry-run --all-tables --precise --recurse-objects`, then the
     same with `http:\/\/...`) and quote both counts in the finding, so the escaped remainder is a measured number
     rather than a guess. Point the reader at `docs/migration-guide.md` for the full runbook.

     Two things this fix is **not**. It is not something to perform during this pass, which changes nothing — and on
     a live review the destination database is generally unreachable from here anyway, so say plainly who has to run
     it and where. And it is never a search-replace against the *local* environment's own database: `localhost:PORT`
     is that site's correct address, so replacing it there breaks the very environment the site is migrated from.
     Dry runs against local are fine and are the right way to measure the split; a live run against local is not.
   - Browser console: load each page and capture any JavaScript errors or warnings logged to the console — Lighthouse's
     Best Practices category catches some of this already, but confirm it across every page, not just whichever one
     Lighthouse happened to audit in step 3.

**Before writing anything, read the previous version of this report if one exists on disk, and account for every
finding in it.** A re-run is a re-audit, not a fresh start: each earlier finding must reappear as fixed (say what
you re-checked to confirm it), still present (carry it forward, renumbered), or no longer applicable (say why —
e.g. the live host changed, or a caveat above reframes it). Silently omitting one reads as "resolved" to whoever
runs a fix pass next, so a finding that quietly vanishes between runs is worse than one never found: it removes
work that was already identified. This applies especially to low-severity and informational items, which are the
easiest to lose when a re-run reorganizes around some new high-severity finding. If the earlier report is missing
or unreadable, say so rather than assuming there wasn't one.

When writing any fix direction, keep it inside this project's standing rules — the fix a report proposes is the fix
someone will attempt. Never propose creating a file in `wp-content/mu-plugins/`, even where that's the tidiest way
to hold an always-on filter; a finding whose only clean fix is a mu-plugin should say so and be left for the user
to decide, not written as a step. The same goes for anything requiring a plugin or theme to be installed,
activated, deactivated, removed or updated.

Then write a concrete, numbered findings report — one entry per issue, each stating: which page/element, what's
wrong, the category (Console errors / Hardening / Broken links / etc.), and severity. Order it so
security-relevant and user-visible issues (broken links, real console errors, a raw error page) come before purely
cosmetic/informational ones (an exposed generator tag). If a page has no material issues, say so briefly rather than
padding the report. List any page that had to be skipped (script error, timeout) so it's visibly flagged as
unreviewed rather than silently missing.

Present the finished report here in the chat as a plan for what needs to change — don't start fixing anything yet.

Also save the complete, final report to {{wpSiteDir}}/reports/review-best-practices-report.md (create the folder if
needed; overwrite any previous version) — the whole report exactly as presented in the chat, not a summary, so it
exists independent of chat history. If reaching the final report took multiple messages, write the one complete,
standalone version here, not just whatever happened to be in your last message.
