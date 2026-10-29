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

Here is a review report identifying issues to fix on the WordPress site — it may contain a mix of finding types
(e.g. Review UI's parity mismatches vs. the original alongside its own site-quality findings, or a separate
accessibility, performance, best-practices, SEO, cache-configuration, CSS `!important`/specificity, or theme
PHP/CSS code-quality audit); read it to see which:

{{reviewReport}}

**If the report above is a Review: Images candidate list rather than a findings report**, it is a list of images to
convert to WebP, not defects to judge — treat every entry still in the list as approved for conversion (the user
edits the list to drop anything they don't want touched, so an entry's presence *is* the instruction) and skip the
rest of this prompt's finding-type reasoning, which doesn't apply. For each entry:
1. Convert the original **and every one of its generated `-WxH` size variants** at quality ~80 — lower only where a
   specific image still looks degraded, never as the starting point. Use Imagick/GD via a `wp eval-file` script or
   `cwebp`; any such script belongs in {{wpSiteDir}}/scripts/, never inside `public-html/`.
2. Update the attachment's own records so WordPress doesn't still think it's a PNG/JPEG — `_wp_attached_file` and the
   serialized `_wp_attachment_metadata` (every variant's filename and mime type). Apply the same serialized-data care
   as any other postmeta edit: confirm the *entire* blob unserializes cleanly before writing and again after.
3. Rewrite every reference the scan found (`_elementor_data`, `widget_block`, theme options) to the `.webp` filename
   — hard replace, no `<picture>` fallback wrapper.
4. Only once every reference is confirmed rewritten, delete the old files (original + all variants). Never delete
   first, and never leave a reference pointing at a file that no longer exists.
Then verify rather than assume: re-fetch each new `.webp` URL for a 200 and the expected content-type, report actual
before/after bytes and percentage saved per image plus a total, re-screenshot every affected page at mobile/tablet/
desktop against its pre-conversion state, and grep again for any lingering reference to an old filename. Report
anything left unconverted with the reason rather than dropping it silently.

Otherwise, fix each finding against whatever standard it actually states, not one assumed standard for the whole
report:
- A **parity mismatch** (the rebuild differs from the original design) means match the original at
  {{siteDir}}/{{siteUrl}} exactly.
- A **site-quality finding** (inconsistent spacing/sizing, a dated or unfinished-looking component, an awkward gap —
  judged on the rebuild's own merits, per Review UI's step 6) means improve past whatever's there now, even if the
  finding notes the original has the same flaw — matching the original would not resolve this kind of finding, since
  the original isn't the standard for it.
- A **standard-based finding** (e.g. an accessibility audit graded against WCAG, a performance audit graded against
  Core Web Vitals/page-weight targets, a best-practices audit covering security/hygiene/console errors, an SEO audit
  covering meta tags/structured data/semantic HTML, a cache-configuration audit covering `Cache-Control`/`Expires`
  headers, a CSS `!important` audit covering specificity/maintainability, or a theme code-quality audit covering
  output escaping/input sanitization/SQL safety/deprecated APIs/global-variable hygiene/global design-settings
  drift, Elementor Kit or `theme.json`) means meet that standard directly, on its own terms — don't just copy the
  original's behavior for that
  aspect, since the original (an unoptimized dev server with no WordPress-specific concerns, and likely no real
  per-page SEO to begin with) may not
  meet the standard either, and generally isn't even a comparable thing to check against for this finding type.
If a finding's type isn't explicitly labeled, infer it from how it's phrased (a stated "original has X, rebuild has
Y" is a parity mismatch; a finding with no original-side comparison at all is a site-quality or standard-based one).

**A finding that recommends keeping the rebuild's version is a decision, not a mismatch to fix.** A review will
sometimes record a real original-vs-rebuild difference and then explicitly say the rebuild's version should stay —
"recommend NOT reverting", "recommend keeping the rebuild's", "the rebuild's version is the better UX", "keep the
rebuild's separate assets", or similar. That is the reviewer having already made the call, and it overrides the
match-the-original rule above for that finding specifically. Do not revert it. It appears in the numbered list
because a real difference belongs on the record, not because it's an instruction to change something — reviews are
required to number every measured difference, including the ones they're deliberately leaving. Treat it as done:
say in your report that it was kept by the review's own recommendation, and move on.

Read the whole finding before acting on it, not just its heading and its original-vs-rebuild table. This class of
finding usually looks like an ordinary parity mismatch right up until the last line, where the recommendation is —
and reverting one actively destroys correct work, which is worse than leaving a real mismatch unfixed. Where such a
finding also calls out a genuinely fixable sub-part (e.g. keep the element, but its size or spacing is wrong), fix
only that sub-part and leave the part the review said to keep.

**"Replicate what page X already does" is a lead to investigate, not a change to copy.** When a finding points at one
page that handles something correctly and asks for the same treatment on the others, don't lift that page's literal
values onto the rest. First find the code that actually produces the behaviour there (file and function — a review
may describe the effect without ever having located its cause), then check that the values it relies on hold on each
target page rather than assuming the working page is representative. It frequently isn't: it may be a special case,
or the other pages may carry per-breakpoint or per-page variants of the same setting that the working page happens
not to have. Where the underlying values do differ, derive them per page — read them from the builder's stored data
at runtime — instead of hardcoding one page's copy across all of them.

This matters most for findings whose fix is invisible once applied. A resource hint, a preload, a cached header or a
meta tag either points at the right thing or the wrong thing, and both render identically; copying the working page's
literal value onto a page that needed a different one produces a change that looks done, passes a screenshot check,
and quietly makes the audited metric worse than before the fix. Verify those against the mechanism, not the
appearance, and say in your report which pages you actually confirmed rather than which ones you edited.

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

**Never install, activate, deactivate, remove, or update a plugin or theme.** Not to resolve a finding, not because
an update is available, not as a dependency of some other fix — this is a standing preference for every category,
with no exceptions here. The site's plugin and theme inventory is the user's decision, made once via Build Options
when the site is built; changing it during a fix pass is not a fix, it's a change to what the site *is*. It's also
a real risk to the work: a plugin update can silently alter rendered output (an Elementor release changing markup
or default spacing), which quietly undoes exactly the pixel-parity this project spends its passes establishing —
and it would land in the same run that's supposed to be *improving* parity, making the regression very hard to
attribute afterwards.

This applies to reports too. A review may legitimately *report* that a plugin is inactive, unnecessary, or has an
update available — that's information worth having. It is not an instruction to act. Leave that finding unresolved,
carry on with the rest, and call it out in the final report as needing the user's own decision, exactly like the
mu-plugin case below. The same goes for a finding whose only available fix is a plugin you'd have to add: don't add
it, don't stop the run over it, and report it as needing a plugin the user should decide on themselves.

Never create a new file in `wp-content/mu-plugins/` as a fix, even when it looks like the only way to persist a
change against theme/builder-generated output the normal editor can't reach directly (e.g. Astra/Elementor/Royal
Addons markup, or a server-side output filter). If a finding genuinely seems to need that kind of always-on,
code-level fix, don't write the file and don't stop the run over it — leave that one finding unresolved, move on
to the rest, and call it out clearly in the final report as needing a mu-plugin (or equivalent) the user should
decide on themselves, the same way any other finding you couldn't fully resolve gets reported. This is a standing
preference, not something to re-derive per finding.

If fixing a finding requires editing a serialized or JSON postmeta value directly (e.g. `_elementor_data`) and the
normal WordPress API (`update_post_meta()`) can't be used safely for it — most commonly because the existing value is
already malformed (a prior `wp_unslash()`/encoding issue) and needs hand-repairing before it can even be decoded —
re-validate the *entire* repaired value round-trips cleanly (`json_decode()`/`unserialize()` without error, on the
whole blob, not just the one field you touched) before writing it back, and do the same check again immediately after
the write completes. A corruption event affecting one part of a blob is a real sign the same event may have damaged
other, unrelated data in it too — confirming only that the specific section you meant to fix now renders correctly
is not the same as confirming nothing else in that same value silently broke.

**Never flip sitewide indexability on your own** — `blog_public` ("Discourage search engines"), a sitewide
`noindex`, or the SEO plugin's XML sitemap toggle. A review of a temporary/staging host will legitimately report
that it shouldn't be crawlable, but the correct setting depends on timing the user owns: crawlable while the site
is being actively audited (a noindex floors every SEO score and makes those runs meaningless), noindex once it goes
quiet. Worse, these live in the database, so whatever you set here rides the next migration into production and has
to be reversed at launch — forgetting that is the single most expensive mistake available in this project, costing
weeks of not ranking before anyone notices. Report the finding, state which setting you'd recommend and when, and
leave it for the user to flip. If they've explicitly asked for it in this run, apply it and say plainly in the
report that it must be reverted on the production domain.

**Never run a search-replace that rewrites {{wpSiteUrl}} — this site's own address — to a live domain.** A review
of a *deployed* copy will report stale `localhost` URLs as high severity, and its fix direction will name a
search-replace. That belongs on the destination, not here: locally those URLs are correct data, and rewriting them
points every image and link at a domain this environment isn't, taking the project's Playwright scripts (which use
{{wpSiteUrl}} as their base URL) down too. Leave the finding unresolved, and report it as belonging to the
migration step.

Before making changes, make sure {{wpSiteUrl}} is actually reachable — if it isn't already running, start it the way
the project expects (e.g. `docker compose up`). Only bother with the original at {{siteUrl}} if this report actually
has parity-mismatch findings that require comparing against it — a site-quality or standard-based finding generally
won't need it, since those are graded independently of the original. If it is needed, start it yourself if it isn't
already running (find and use whatever PORT/BASE_PATH/env vars the project requires, the same way Install Site
would), and verify images and other assets actually render, not just that the page returns 200 — a base-path
mismatch can leave every image broken while the page still loads fine, which would corrupt any comparison against
it.

Break the report above into concrete todo items with the TodoWrite tool, one per finding, and track your progress
through them as you go, so progress is visible in the dashboard.

Now fix each finding listed in the report, using {{builder}} on the WordPress site at {{wpSiteDir}} (it runs at
{{wpSiteUrl}}), against whichever standard applies to it per the instruction above. Prioritize the report's own
ordering. If fixing an item turns out to require a media upload, do that rather than skipping it — but never a
plugin or theme (see the standing rule below). For a caching finding specifically (missing `Cache-Control`/`Expires`
headers): fix it using
whichever server-appropriate mechanism the report itself specifies (Apache's `.htaccess`/`mod_expires`/
`mod_headers`, or the equivalent Nginx server-block `expires`/`add_header` directive plus the reload it requires to
take effect) — never by installing a new caching plugin, since that's this project's standing preference for this
one category of fix. If the report says the server couldn't be identified and gives both directions, identify it
yourself before fixing (same checks as the Cache review: `Server` header, running process/binary, or the project's
own compose/Dockerfile) rather than guessing which one applies. For an `!important` finding specifically: never fix
it by simply deleting the `!important` token — it exists to win a specificity conflict, so deleting it alone would
just let the losing side render instead, a real visual regression. Fix it by giving the overriding selector enough
natural specificity (or moving its rule later in source order) that it wins the same conflict without `!important`,
then remove the token — the rendered result must stay identical, only the mechanism changes.

Fix every finding completely — the goal is genuinely meeting the relevant standard in full (e.g. full WCAG 2.1 AA
compliance for an accessibility report), not just the easiest subset of items. Whenever a fix requires picking a new
visual value — a color, spacing, or sizing change, most commonly a contrast fix that needs a new color — don't just
reach for the minimum technically-passing value (the flattest gray, the first color that clears the ratio). Choose
something that looks genuinely polished and intentional, staying as close to the existing brand/design system as the
standard allows, so the result reads as a deliberate part of the design rather than a compliance patch bolted onto
it. This applies to every fix in this pass, not only color/contrast ones.

If a finding describes duplicate/redundant visible content (e.g. two headings on one page saying the same thing, a
leftover default section a new one was added alongside rather than replacing), fix it by removing the actual
redundant element/section from the page content itself — never by hiding it with CSS (`display:none`,
`visibility:hidden`) instead. A hidden element is still in the markup: assistive tech and crawlers can still
encounter it depending on how it was hidden, and it's dead weight in the page either way. CSS-hiding is only the
right tool for content that's genuinely meant to be conditionally shown (a closed mobile menu, an inactive tab), not
a stand-in for actually deleting something that shouldn't be there at all.

After each fix, verify it directly using whatever method actually demonstrates the fix worked, appropriate to that
finding's standard — don't just assume the change worked because the edit was applied:
- For a parity mismatch: screenshot the specific page/breakpoint on both {{wpSiteUrl}} and {{siteUrl}} and confirm
  they now match. If the fix touches a `<select>`/dropdown, actually open it and check the option text is legible,
  not just that the closed field looks right — a closed dropdown gives no visual signal that its open state is
  broken. If the fix touches one instance of a repeated element (a list/grid of icons, cards, bullets), check
  *every* instance got the same fix, not just the one you looked at first — a subset silently still using the old
  version is an easy, real mistake.
- For a site-quality finding: screenshot the affected page/section on {{wpSiteUrl}} alone and confirm it now looks
  consistent/polished/complete — there's no original-side comparison to make here.
- For a standard-based finding (e.g. accessibility, performance, best-practices, SEO, caching, `!important` usage, or
  theme code quality): re-run whatever check the finding itself was based on — re-scan with axe-core, re-measure
  contrast via `getComputedStyle`, re-test keyboard navigation for an accessibility finding; re-run Lighthouse (or
  re-measure the specific metric called out, e.g. LCP or transferred image weight) for a performance finding —
  but for a performance finding, verify the **mechanism**, not the score: confirm the asset is genuinely out of the
  render-blocking list, that the byte count actually dropped, that the audit sub-check now passes. If the review it
  came from was run against a live URL, a local re-run measures a different machine on a different network, and this
  project's local environment additionally inflates TTFB by an order of magnitude (see the performance review's own
  note on it) — so a local score is evidence the change took effect, never evidence of how much it gained. Do not
  quote local before/after scores or timings as the result; say what mechanically changed and leave the numbers to
  the post-deploy review that can actually measure them;
  re-check the specific plugin list, link, or console output for a best-practices finding; re-check the actual
  rendered meta tags/sitemap/structured data for an SEO finding; re-run `curl -I` against the same static assets for
  a caching finding and confirm the header is now present; for an `!important` finding, confirm the rule renders
  identically after removing it (screenshot before/after, or check computed styles) — removing one must never change
  the rendered result, only how it's achieved; for a theme code-quality finding, re-read the fixed code directly
  (confirm the escaping/sanitization/nonce/`$wpdb->prepare()` call is actually present, not just that the page still
  loads) and, where the finding was reachable through the browser (a form submission, a URL parameter), exercise that
  path again to confirm the fix holds under real input, not just on inspection; for a global design-settings drift
  finding, re-check the actual generated CSS shows the corrected value — the Kit's compiled stylesheet
  (`wp-content/uploads/elementor/css/post-<kit-id>.css`) for Elementor, or the rendered page's generated global-styles
  `<style>` block for a `theme.json`-based Gutenberg theme — the same way the original finding should have been
  confirmed, since a saved setting with no matching rule in the actual output didn't take effect —
  and for Lighthouse's `link-text` audit specifically, know that it only reads an anchor's *visible* text, never an
  `aria-label` — adding a label there instead of fixing the visible text will still fail the same re-run, so fix the
  text itself, not the label, for this one audit —
  to confirm it now actually passes, not just that the change looks plausibly right.
If a listed finding turns out to already be fixed or was a false positive, note that rather than silently skipping
it.

If a verification check ever comes back contradicting a fix you just applied (e.g. a URL that should now redirect
still returns 200), don't explain it away as stale/cached without confirming that directly — re-run the exact same
check fresh right then (a new `curl -I`, a new page load) and let that result decide it, rather than a plausible-
sounding reason the check might be wrong. Only report a fix as verified once a fresh, current check actually shows
the expected result.

Once every item is addressed, do a final verification pass across everything this report touched, matched to its
standard: re-screenshot affected pages at mobile, tablet, and desktop widths (against the original for parity
mismatches, alone for site-quality ones) and re-run the relevant check (a fresh axe-core scan, a fresh Lighthouse
pass, etc.) for standard-based findings — either way, confirming nothing else regressed as a side effect of these
changes.

If you started {{siteUrl}}'s dev server yourself, stop it again once you're done. Leave {{wpSiteUrl}} running.

Finish with **one single, complete report posted in chat** — not fixes-in-progress updates as you go, and not the
report split across several messages. Post it once, at the end, after every finding has actually been addressed and
verified, covering:
- Each finding from the report and how it was resolved (or why it couldn't be, if that's the case).
- Direct URLs (at {{wpSiteUrl}}) to view each changed page.
- Anything that's still a known gap after this pass — worth another review round if so.

Also save this same complete report to {{wpSiteDir}}/reports/change-report.md (create the folder if needed; overwrite
any previous version) — the whole report exactly as posted in the chat, not a summary, so it exists independent of
chat history. If it took multiple messages to reach the final version, write the one complete, standalone report
here, not just whatever happened to be in your last message.
