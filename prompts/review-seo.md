Review the SEO implementation and semantic HTML structure of the WordPress site at {{wpSiteDir}} (it runs at
{{wpSiteUrl}}). Do not make any code or content changes yet — this is a comparison + reporting task only, same as the
other review prompts.

This review is scoped to {{wpSiteUrl}}/{{wpSiteDir}} only — grade it against real SEO/semantic-HTML best practices
directly, not against {{siteUrl}}/{{siteDir}}. The original is very likely a generic design-tool export with a shared
head/meta shell rather than real per-page SEO (the same thing Analyze itself already checks for before ever assuming
otherwise) — it's a source for actual page *content and topic* (what each page is genuinely about, needed to judge
whether a title/description is any good), not a reference for SEO implementation. Don't compare implementation
details against it or start it for this pass.

If {{wpSiteDir}}/reports/analyze-report.md exists, read its SEO section first — it documents the concrete per-page
SEO plan this site was supposed to be built against. Check whether the site being reviewed actually followed through
on it, but don't stop there: still grade every page directly against real SEO/semantic best practices below
regardless of what the plan said, since the plan itself could have been incomplete, or the build could have drifted
from it in a way that's still fine, or wrong in a way the plan didn't anticipate.

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
   Then run Lighthouse's SEO category across every page (`CHROME_PATH=<path found above> npx lighthouse
   <url> --output=json
   --output-path={{wpSiteDir}}/reports/lighthouse/<page-slug>-seo.json --chrome-flags="--headless=new --no-sandbox --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-renderer-backgrounding"
   --only-categories=seo`, creating `{{wpSiteDir}}/reports/lighthouse/` first if it doesn't exist yet — same
   `reports/` location everything else in this project saves to, not wherever Lighthouse/Chrome would default to
   otherwise) — this catches structural basics: a `<title>` element present,
   a meta description present, a valid canonical link, crawlable links, a valid `robots.txt`, image `alt` attributes
   present, and mobile-friendly tap-target sizing. It confirms these things *exist*, not that they're actually good —
   the manual checks below cover that.

   **Known local-dev latency, already diagnosed:** if this is the local Docker-hosted dev environment, expect TTFB to
   be dramatically inflated (measured 12-17s on a basic page load) — a diagnosed artifact of Elementor/Elementor
   Pro's heavy filesystem scanning combined with {{wpSiteDir}} living on a Windows drive bind-mounted into Docker
   (cross-WSL/Windows file I/O measured ~2.5x slower than native), not a real site defect (see `review-performance.md`
   for the full diagnosis). A `robots-txt` audit failure here specifically can be this same latency causing
   Lighthouse's own fetch to time out even though the file is genuinely valid — verify directly with a manual
   `curl`/fetch of `{{wpSiteUrl}}/robots.txt` before reporting it as broken. If a page's run fails outright (e.g. `NO_FCP` — no paint captured at all) despite the flags above, retry that one page's audit once before giving up on it — this specific failure is a known Chrome-throttling flake, not necessarily a real defect in the page, but a page that fails twice in a row is worth reporting as genuinely unreviewed rather than silently omitted. Afterward, check for and delete any stray Chrome temp-profile directories
   Lighthouse's browser launch left behind (recognizable by a `Default/`/`Local State`/`Safe Browsing` structure —
   Chrome's own disposable scratch profile, never real report content) — check both the usual OS temp location and,
   due to a known WSL/Windows path-interop quirk, directly inside {{wpSiteDir}} itself, where one can land as a
   single oddly-named folder containing literal backslashes/colons (e.g. `C:\Users\...\lighthouse.NNNNNN`) instead of
   a real nested Windows path.
4. Beyond the automated pass, specifically check each page for:
   - Title and meta description quality: unique per page (not a copy-pasted template), genuinely descriptive of that
     page's actual content, and a reasonable length (title roughly 50-60 characters, description roughly 150-160) —
     not just present, which Lighthouse already confirmed.
   - Open Graph / Twitter Card tags: present per page, with `og:image`/`twitter:image` pointing at a real, rendering
     image rather than a broken or default placeholder path.
   - Structured data: confirm it comes from {{seoPlugin}}'s own settings only (Organization/Person fields, etc.), not
     a hand-written JSON-LD snippet in theme code — check the actual rendered `<script type="application/ld+json">`
     output on a page or two to confirm it's well-formed and reflects real business info, not placeholder/example
     values left unedited.
   - XML sitemap: reachable at whatever path {{seoPlugin}} exposes (Yoast uses
     `{{wpSiteUrl}}/sitemap_index.xml`; core's own is `{{wpSiteUrl}}/wp-sitemap.xml`) and actually lists every real page —
     note any page missing from it.
   - Indexability: `blog_public` being set to discourage search engines is *expected and correct* if this is
     reviewing the local dev build, not a bug — note it as a go-live reminder (same as domain/hosting/SSL elsewhere),
     don't flag it as an issue to fix now. If this review is instead running against a live deployed URL (see any
     live-review note above), that same setting being on would be a real, high-severity finding — a live site meant
     to be found by search engines shouldn't be sitewide-noindexed at all. **Unless that note also says the
     deployment is temporary/staging**, in which case it inverts again: a throwaway host should not be indexed at
     all, so noindex there is correct and not a finding, while being crawlable *is* one. Separately, check whether any individual
     page has its own per-page "discourage search engines"/noindex setting left on unintentionally — that's a real,
     distinct issue either way, since it's page-specific rather than a sitewide default of any kind.
   - Heading hierarchy and semantic HTML: exactly one `<h1>` per page matching its real primary topic, no skipped
     heading levels, and genuine semantic elements used where they reflect real structure — `<nav>` for navigation,
     `<ul>`/`<ol>` for actual lists, `<article>`/`<section>` where content is genuinely structured that way — rather
     than everything flattened into generic `<div>`s regardless of what it represents.
   - Internal linking: nav/footer/body-copy links connect related pages sensibly, and no real page is an orphan with
     zero internal links pointing to it anywhere on the site.
   - Image filenames: uploaded media has reasonably descriptive filenames (not `image-1.jpg`, `IMG_4821.png`) where
     that's still under your control (newly uploaded media, not identical to how the original had it).
   - URL structure: clean, descriptive slugs (`/services/`, not `/?p=123` or `/page-2/`), matching the SEO-friendly
     URL structure Analyze already called for.

Then write a concrete, numbered findings report — one entry per issue, each stating: which page, what's wrong, the
category (Meta tags / Structured data / Sitemap / Indexability / Semantic HTML / Internal linking / URLs / etc.), and
severity. Order it so issues affecting real crawlability/indexing (missing sitemap entries, accidental per-page
noindex, broken canonical) come before purely quality-of-copy issues (a slightly generic meta description). If a page
has no material issues, say so briefly rather than padding the report. List any page that had to be skipped (script
error, timeout) so it's visibly flagged as unreviewed rather than silently missing.

Present the finished report here in the chat as a plan for what needs to change — don't start fixing anything yet.

Also save the complete, final report to {{wpSiteDir}}/reports/review-seo-report.md (create the folder if needed;
overwrite any previous version) — the whole report exactly as presented in the chat, not a summary, so it exists
independent of chat history. If reaching the final report took multiple messages, write the one complete, standalone
version here, not just whatever happened to be in your last message.
