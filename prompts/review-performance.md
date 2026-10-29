Review the performance of the WordPress site at {{wpSiteDir}} (it runs at {{wpSiteUrl}}) — page load speed, Core Web
Vitals, and page weight. Do not make any code or content changes yet — this is a comparison + reporting task only,
same as Review UI and the Accessibility review, but for performance instead.

This review is scoped to {{wpSiteUrl}}/{{wpSiteDir}} only — evaluate it against real-world performance standards
directly, not against {{siteUrl}}/{{siteDir}}. The original is an unoptimized Vite dev server serving a React mockup
— its own load characteristics (no production build, no image optimization, no caching, hot-module-reload overhead)
aren't a meaningful performance baseline in either direction, so don't compare against it or start it for this pass.

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
   below). **Run Lighthouse with {{wpSiteDir}} as the working directory** (`cd {{wpSiteDir}}` first, or run it via
   `cwd`), never from this dashboard app's own repo. Chrome's launcher writes its disposable scratch profile into the
   *current working directory* when the WSL/Windows path quirk below hits, so wherever you launch from is where the
   debris lands — and a stray profile inside the app repo breaks its dev server outright (Turbopack walks the project
   tree, hits the profile's `SingletonSocket`, and panics with `ENXIO`/"No such device or address" on a file that is
   a socket rather than a regular file). Launching from {{wpSiteDir}} keeps that debris in one predictable place,
   which is also the only place the cleanup step below looks.
   Then run an automated audit across every page using Lighthouse (`CHROME_PATH=<path found above> npx
   lighthouse <url> --output=json
   --output-path={{wpSiteDir}}/reports/lighthouse/<page-slug>-performance.json --chrome-flags="--headless=new --no-sandbox --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-renderer-backgrounding"
   --only-categories=performance`, creating `{{wpSiteDir}}/reports/lighthouse/` first if it doesn't exist yet — same
   `reports/` location everything else in this project saves to, not wherever Lighthouse/Chrome would default to
   otherwise — or the same via Playwright if that's easier to script across multiple pages in one pass) — capture the
   overall performance score, Core Web Vitals (LCP, CLS, TBT as a
   proxy for INP), and the "Opportunities"/"Diagnostics" sections, which name concrete fixable issues (render-blocking
   resources, unoptimized images, unused CSS/JS, missing text compression, etc.) rather than just a number.

   **Known local-dev latency, already diagnosed — don't re-investigate it:** if this is reviewing the local
   Docker-hosted dev environment, expect TTFB/response times to be dramatically inflated (measured at 12-17s on a
   basic page load) purely as an artifact of this environment, not a real site defect. Root cause: Elementor and
   Elementor Pro do extensive filesystem scanning on every load (widget registration, icon library, CSS/asset
   cache-invalidation checks), and when {{wpSiteDir}} lives on a Windows drive bind-mounted into Docker (e.g. an
   `E:\...` path mounted at `/mnt/e/...`), every one of those file reads crosses the WSL/Windows filesystem boundary,
   which measured ~2.5x slower than native disk I/O directly (confirmed via `docker stats` showing idle CPU/memory,
   ruling out resource contention; DNS resolution under 100ms; cron jobs each completing in under 0.03s; and a direct
   before/after comparison — deactivating Elementor + Elementor Pro dropped TTFB from ~14s to ~2.4s; that was a
   one-off diagnostic already carried out, recorded here as settled evidence — **do not repeat it**, since
   deactivating a plugin is never something a review may do). This is a dev
   environment artifact tied to where the project directory happens to live, not something fixable via caching,
   code changes, or anything else in scope for this review — note it once in the report as a known caveat (with a
   pointer to move {{wpSiteDir}} onto the WSL2 native filesystem as the actual fix, out of scope here) rather than
   treating every slow TTFB/LCP number as a fresh finding to chase, and don't assume it says anything about the live
   deployment's real-world performance, which isn't subject to this at all. If instead this is reviewing a live
   deployed URL (see any live-review note above), none of this applies — those scores are measuring real-world
   conditions directly and are worth trusting at face value.

   **On a live URL, check for a stale CDN edge before trusting any number.** If a CDN/proxy sits in front (look for
   `Server: cloudflare`, `cf-cache-status`, `cf-ray`, `via`, `x-cache` on `curl -I`), it caches assets independently
   of the origin, and a deploy that regenerates the page builder's compiled CSS does **not** invalidate it. The edge
   then serves a stylesheet pointing at pre-deploy asset URLs — old unconverted images, superseded filenames — while
   the origin is correct. Nothing looks broken, because the old files usually still exist; the page just silently
   loads the heavy versions. Symptoms: scores and LCP swinging wildly between otherwise identical runs, because each
   run happens to get a different cached variant.
   So before reporting: fetch the builder's compiled CSS (e.g. `uploads/elementor/css/post-<id>.css`) and the LCP
   resource, and compare `age`/`last-modified` against when the site was last deployed. Re-fetch the same URL with a
   cache-busting query (`?cb=123`) and diff it — if they differ, the edge is stale. When they differ, say so
   prominently and treat the run as measuring a version of the site that no longer exists, rather than reporting the
   numbers as the site's performance. The remedy is a CDN purge at deploy time, which is a process fix for the user,
   not a code finding. Also note whether text compression (`content-encoding: gzip`/`br`) is present, and where it
   comes from — a CDN often supplies it, so a site that later moves to DNS-only loses it silently and every text
   asset gets several times heavier with no code change at all.

   If a page's run fails outright (e.g. `NO_FCP` — no paint captured at all, not just a low score) despite the flags
   above, retry that one page's audit once before giving up on it — on the local dev environment this is plausibly
   just the latency above pushing past Lighthouse's paint-timeout budget, not necessarily a real defect in the page,
   but a page that fails twice in a row is worth reporting as genuinely unreviewed rather than silently omitted.
   Afterward, check
   for and delete any stray Chrome temp-profile directories Lighthouse's browser launch left behind (recognizable by
   a `Default/`/`Local State`/`Safe Browsing` structure — Chrome's own disposable scratch profile, never real report
   content) — check both the usual OS temp location and, due to a known WSL/Windows path-interop quirk, directly
   inside {{wpSiteDir}} itself (the working directory the audit was launched from, per the step above), where one can
   land as a single oddly-named folder containing literal backslashes/colons (e.g. `C:\Users\...\lighthouse.NNNNNN`)
   instead of a real nested Windows path. Expect one per audited page, not one per run.
4. Beyond the automated audit, specifically check (caching is deliberately not checked here — it's covered by the
   dedicated Cache review instead, so a caching gap is only ever reported once, not duplicated across two reports):
   - Image sizing and format: sample a handful of uploaded media files — are they served at roughly their rendered
     display size (not, say, a 4000px-wide original scaled down to 400px in CSS), and in a modern format (WebP/AVIF)
     where the gain over JPEG/PNG would be substantial, not just theoretically available?
     **Account for every image the audit itself flags** — walk the image-delivery/oversized-image audit's item list
     per page and either raise it as a finding or say in the report why it isn't worth acting on. Don't let entries
     drop silently between the two. Note especially that an image can be flagged for *sizing alone* while already
     being WebP: that case is easy to skip past when scanning for format problems, and it has no other owner —
     the Images review converts formats and would never surface a file that is already converted, so an oversized
     WebP left out of this report is a finding nothing else will ever catch. Report display vs. intrinsic dimensions
     in CSS pixels, and say so — Lighthouse reports the displayed size in *device* pixels under mobile emulation
     (its DPR multiplies the CSS value), so quoting it raw overstates how large the asset actually needs to be.
   - Lazy-loading correctness: confirm below-the-fold images use `loading="lazy"`, and — just as important in the
     other direction — confirm the hero/LCP-candidate image on each page does *not* have `loading="lazy"` applied to
     it, since lazy-loading the very image that determines LCP actively hurts that metric rather than helping it.
   - LCP attribution: before prescribing any LCP fix, break the metric into its parts instead of quoting the headline
     number. Lighthouse's `lcp-breakdown-insight` audit splits it into time-to-first-byte, resource load delay,
     resource load duration and element render delay; `lcp-discovery-insight` reports whether the resource was
     discoverable in the initial HTML, `fetchpriority`-hinted, and not lazy-loaded. Attribute each fix to the subpart
     it actually moves: a `preload`/`fetchpriority` hint removes *resource load delay* and nothing else — not TTFB,
     not download time, not render delay — so a finding must not promise the whole LCP as its saving. Note too that
     the headline `largest-contentful-paint` value is Lantern-*simulated* under throttling while the insight subparts
     are *observed* trace milliseconds: they are on different scales, so never subtract one from the other, and never
     present an observed subpart as a share of the simulated total. If one page already handles this correctly, its
     subpart values are the honest benchmark for what the others can reach — quote those rather than estimating.
   - LCP source at the audited breakpoint: the default run is *mobile*, and a page builder will happily let one
     element carry a different image per breakpoint — as a builder-level responsive setting, a `srcset`/`sizes` set,
     or a `<picture>` with `media` (when {{builder}} is Elementor, that setting is `background_image_mobile`).
     Identify the LCP resource for the viewport actually being measured, not the desktop one — read it from the
     builder's stored page data (`_elementor_data` for Elementor) and the media queries in the builder's compiled
     per-page CSS, not from how the page looks on a desktop screen. This matters most when prescribing a `preload`:
     naming the desktop file
     on a page whose mobile hero is a different crop fetches an image the measured viewport never paints, and a
     high-priority preload of a non-LCP resource steals bandwidth from the real one, making LCP worse rather than
     better. Where the sources differ per breakpoint the fix must be media-scoped, and the finding has to say so.
   - Font loading: check whether custom `@font-face` declarations use `font-display: swap` (or are preloaded) rather
     than blocking text rendering until the font file arrives.
   - Render-blocking bloat: is there an unusually large number of enqueued scripts and stylesheets for what this site
     actually needs, several of which could plausibly be deferred, combined, or inlined? Measure and report the
     blocking cost — how many requests, how many bytes, how much estimated savings — and prescribe fixes that act on
     the *loading* of those assets. **Don't prescribe removing, deactivating or replacing a plugin as the remedy**,
     and don't audit the plugin inventory to get there: which plugins are installed is the user's own decision and
     is out of scope for every review. Naming the plugin an asset comes from is fine and useful (it's how the user
     knows what to weigh) — recommending its removal is not.
   - Builder asset optimization: when {{builder}} is Elementor, a long render-blocking chain is usually its
     per-widget CSS/JS split across the base plugin and each addon pack, and Elementor ships settings that address
     exactly that — check each and report which are off, since they're configuration rather than code and so are the
     lowest-risk fix available for this finding. Read the current state from the `elementor_experiment-*` options
     (and Elementor → Settings → Features / Performance in recent versions) rather than assuming a default:
     **Improved CSS Loading** (loads widget CSS conditionally instead of enqueuing every widget stylesheet on every
     page — the single biggest lever on a 25-30 stylesheet chain), **Improved Asset Loading**, **Inline Font Icons**
     (drops the blocking Font Awesome CSS where icons are Elementor's own), and **Optimized DOM Output**. Name the
     option key alongside the human label so the fix is unambiguous. Two cautions worth stating in the finding:
     these change what's enqueued, so anything depending on a stylesheet that's no longer loaded sitewide can shift
     visually — verify affected pages after, and say so; and Font Awesome must stay if a third-party addon draws
     icons from it, which is a real dependency to check before recommending its removal, not an assumption.

Then write a concrete, numbered findings report — one entry per issue, each stating: which page, what's wrong, the
category (Core Web Vitals / Images / Caching / Render-blocking resources / Fonts / etc.), a concrete metric where
available (e.g. "LCP 4.2s, driven by a 2.1MB unoptimized hero image"), and severity. Order it so the most
impactful/user-visible issues come first — a slow LCP on the homepage matters more than a minor unused-CSS byte
count on a rarely-visited page. If a page has no material performance issues, say so briefly rather than padding the
report. List any page that had to be skipped (script error, timeout) so it's visibly flagged as unreviewed rather
than silently missing.

If a finding's remedy is "do what page X already does", locate the code that produces that behaviour on page X and
name it (file and function) instead of referring to it as an existing mechanism to be replicated — otherwise the fix
isn't actionable and whoever picks it up has to redo the investigation from scratch. Reading that code also routinely
changes the finding itself: it's where you find out the working page is a special case that doesn't generalise, and
that copying it verbatim onto the other pages would be wrong.

Present the finished report here in the chat as a plan for what needs to change — don't start fixing anything yet.

Also save the complete, final report to {{wpSiteDir}}/reports/review-performance-report.md (create the folder if
needed; overwrite any previous version) — the whole report exactly as presented in the chat, not a summary, so it
exists independent of chat history. If reaching the final report took multiple messages, write the one complete,
standalone version here, not just whatever happened to be in your last message.
