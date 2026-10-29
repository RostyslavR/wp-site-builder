Review how closely the WordPress site's visual design currently matches the original — colors, typography, spacing,
layout, and responsive behavior. Then, separately, judge the WordPress site on its own merits: does it hold up as
good, consistent, modern UI, independent of whatever the original does? A rebuild can match the original exactly and
still have real gaps — inconsistent spacing or sizing between similar elements, a component that looks dated or
unfinished, an awkward layout gap — including in spots where the original mockup has that exact same flaw. Those are
worth flagging too, since the goal is a WordPress site that's genuinely good, not just a faithful copy of whatever
the original happened to get right or wrong. Keep these two judgments distinct in the report (see the categories
near the end) — fixing a parity mismatch means matching the original; fixing a site-quality issue means improving
past it, which is a different instruction for whoever acts on this report next.

**Read the previous version of this report if one exists on disk, and honour its accepted divergences.** Not every
difference from the original is a defect: some are deliberate improvements the user asked for, and those get
re-discovered as "mismatches" on every single run unless something records the decision. A sticky header where the
original's scrolls away, a component deliberately laid out differently, a label added that the original lacks — each
is a real measured difference and a wrong thing to revert. So carry forward any finding the earlier report marked as
an **accepted divergence**, keeping it as a single line ("accepted: header is sticky by request; original is not")
rather than re-arguing it, and never write it up as a fresh parity mismatch. When you find a difference that looks
deliberate but isn't recorded yet, report it normally and say plainly that it may be intentional and worth marking
accepted — don't assume either way. This matters because the fix pass reads this report literally: an unmarked
parity mismatch is an instruction to make the rebuild match the original again, which would undo the very change
that was asked for.

Do not make any code or content changes yet — this is a comparison + reporting task only. Treat this as grading
someone else's work: don't assume anything already matches just because it was supposedly built to match: verify
every claim against fresh screenshots. This pass is UI/visual only — content accuracy, functionality, and SEO are
covered separately, not here.

Site identity — get this right before writing anything, mixing it up makes every finding backwards and actively
misleading: {{siteUrl}} (source at {{siteDir}}) is the ORIGINAL design being matched — the reference, never to be
edited. {{wpSiteUrl}} (source at {{wpSiteDir}}, using {{builder}}) is the WORDPRESS REBUILD being graded — the one
whose fixes this report is for. If you find yourself citing a WordPress- or {{builder}}-specific detail
(builder-generated class names, wp-content paths, a builder widget) as evidence for "the original," or a source
file under {{siteDir}} as
evidence for "the rebuild," that's a sign the labels have flipped somewhere — stop and re-attribute before
continuing.

{{liveReviewNote}}

**No original configured:** treat this as having no reference design at all — not just when {{siteDir}}/{{siteUrl}}
are blank or literally "(not set)", but also if either one actually resolves to the same site as {{wpSiteUrl}}/
{{wpSiteDir}} itself (e.g. {{siteUrl}} pointing at the WordPress site's own live URL, or {{siteDir}} being the same
directory as {{wpSiteDir}}) — that's not an independent original, just the rebuild pointed at itself, and comparing a
site against itself is meaningless rather than a real parity check. Check this before doing anything else: if
{{siteUrl}} and {{wpSiteUrl}} (or a configured live URL) are the same host, don't try to start or reach {{siteDir}}/
{{siteUrl}} as if they were separate, and don't treat this as an error. Skip the entire parity-comparison side of
this review (steps 1-2's original-reachability/page-matching, and steps 4-5 below) and run this as a
**site-quality-only review**: only step 3's screenshot capture (against {{wpSiteUrl}} alone, no original to pair it
with) and step 6 apply. The final report in that case has no "Parity mismatches" section at all — say so explicitly
rather than leaving it silently empty — and covers only site-quality findings.

Track your progress through the steps below with the TodoWrite tool as you go, so progress is visible in the
dashboard.

1. If an original is configured: check that both sites are actually reachable before comparing them — {{siteUrl}} and
   {{wpSiteUrl}} should already be running from earlier steps. Verify images and other assets actually render too,
   not just that the page returns 200 — a base-path mismatch can leave every image broken while the page still loads
   fine, which would corrupt this entire review. Do not start either site yourself: if either one isn't reachable,
   stop here and report that back instead of spending time bringing it up. If no original is configured (see above),
   just confirm {{wpSiteUrl}} itself is reachable instead.
2. **Original configured only** — skip entirely otherwise: enumerate every real page/post that exists on
   {{wpSiteUrl}} (check {{wpSiteDir}} and the {{builder}} content, not just the homepage) and find its counterpart on
   {{siteUrl}}. Note any page that exists on one site but not the other — that's a discrepancy too. With no original,
   just enumerate {{wpSiteUrl}}'s own pages for step 3 to screenshot.
3. Before using Playwright, confirm it's actually resolvable globally (`NODE_PATH=$(npm root -g) node -e
   "require.resolve('playwright')"`) rather than assuming a prior session set it up. If not, install it globally,
   once for this whole host — `npm install -g playwright` — and use Playwright only, never `puppeteer` alongside or
   instead of it (remove a redundant one if you find it). Always run any script that needs it with
   `NODE_PATH=$(npm root -g)` set (e.g. `NODE_PATH=$(npm root -g) node {{wpSiteDir}}/scripts/<script>.js`) — a global
   install alone doesn't make `require('playwright')` resolve from an arbitrary project directory without it. The
   browser binary itself is usually already cached globally at `~/.cache/ms-playwright/` from other projects' prior
   work; check there before re-running `npx playwright install chromium`, which re-downloads needlessly otherwise.
   Write a single Playwright script (run with Bash, saved to {{wpSiteDir}}/scripts/ — not wherever it'd otherwise
   land) that opens one browser and, in one pass, loops through every matched page × {mobile, tablet, desktop} and
   screenshots both {{siteUrl}} and {{wpSiteUrl}} at each combination (or just {{wpSiteUrl}} alone, at each
   breakpoint, if no original is configured — see above) —
   don't launch a fresh script or browser per page, that's the difference between one review taking minutes vs.
   tying up a browser process per page. Within that one script, capture a modest number of pages concurrently (3-4
   at a time, each in its own page/tab on the shared browser) rather than fully serially — enough to keep total
   runtime down without hammering either dev server or racing a page's own render/network-idle wait. Give every
   navigation an explicit bounded timeout of at least 30 seconds (e.g. `goto(url, { waitUntil: "domcontentloaded",
   timeout: 30000 })`) — the local Docker-hosted dev environment has a known, already-diagnosed TTFB of 12-17s on a
   basic page load (Elementor/Elementor Pro's filesystem scanning colliding with {{wpSiteDir}} living on a
   Windows-mounted drive; see `review-performance.md` for the full diagnosis), and capturing several pages
   concurrently can push individual requests toward the higher end of that range, so a shorter timeout risks
   spuriously failing/skipping a perfectly fine page rather than catching a genuinely broken one. Then explicitly
   wait for every `<img>` on the page to actually finish loading (e.g.
   `page.waitForFunction(() => [...document.images].every(img => img.complete && img.naturalWidth > 0), { timeout:
   10000 })`) before screenshotting — not a fixed settle delay and not `networkidle`. A fixed delay is a guess at
   "probably loaded by now" that breaks down under the concurrency above (multiple pages sharing the browser can
   make legitimately-fine images load slower than the delay allows, producing false "missing image" findings), while
   `networkidle` can hang forever on a page with an analytics beacon, chat widget, or open websocket. Waiting on the
   images themselves is both targeted (only tracks `<img>` elements, not unrelated background network chatter) and
   bounded (its own timeout, so a genuinely broken image doesn't hang the script — it just means that page's capture
   times out and gets skipped/logged per the try/catch below, which is the correct outcome for an actually-broken
   image). Wrap each page/breakpoint capture in its own try/catch so a single slow or broken page is skipped and
   logged, not something the rest of the run blocks on. Save every screenshot to {{wpSiteDir}}/shorts/ (create it
   first if it doesn't exist yet — same `reports/`/`scripts/` convention everything else in this project uses, not
   wherever the script would default to otherwise) with a name that encodes page and breakpoint so you can refer back
   to them. Additionally, for any page that contains a
   `<select>`/dropdown, click it open and capture a second screenshot of the opened state (on both sites if an
   original is configured, {{wpSiteUrl}} alone otherwise), as part of
   this same capture pass — unconditionally, for every page that has one, not only pages that turn out to look
   different at rest. A closed dropdown gives no visual signal that its open state is broken (e.g. unreadable option
   text), so if this isn't captured now, no later "only check flagged pages" step can recover it — there's simply no
   screenshot showing the problem to look at. Run this script in the foreground and wait for it to finish — don't
   background it and check back later. With the concurrency and per-page timeouts above it should complete within a
   few minutes even for a multi-page site, and backgrounding it only trades that bounded wait for slower, open-ended
   polling.
4. **Original configured only** — skip entirely otherwise (the open-state screenshots still get checked directly for
   their own legibility as part of step 6 instead): compare every open-state dropdown screenshot pair from step 3
   directly, unconditionally — not gated behind whether the page's resting state got flagged below. This is the one
   category that has to be checked this way: a closed dropdown can look perfectly fine while its option list is
   unreadable, so there's no "visibly different at rest" signal to wait for.
5. **Original configured only** — skip entirely otherwise (go straight to step 6 with the single-site screenshots
   from step 3): do a fast first pass over all the remaining screenshots and flag which pages/sections actually look
   visibly different — most pages on a faithful rebuild won't. As part of this same first pass (not a separate deep-dive
   step), for any list/grid that repeats the same kind of item (checklist icons, card icons, bullet markers), spot
   check the instances against each other, not just whether the section as a whole looks right — a subset silently
   rendering differently (e.g. the first two items using a different icon than the rest) is exactly the kind of thing
   a glance at "does this look roughly fine" skips past, so it needs to be a deliberate part of the baseline scan,
   not something that only gets checked once a page is already flagged for some other reason. Also as part of this
   same baseline pass — not gated behind a page looking visibly off — pull `getComputedStyle` line-height and
   paragraph/list margin on one representative long-form body-copy paragraph (a text-editor-type widget, not a
   heading or card blurb) per page, on both sites, and compare the numbers directly. A several-px line-height or
   margin gap on body copy is real but doesn't reliably read as "visibly different" in a screenshot skim — it
   compounds quietly over a long page into a page-height mismatch rather than jumping out as an obvious defect, so it
   needs a numeric check on every page, not just the ones that already look off. Treat a mismatch found this way as
   its own flag into the drill-down below, the same as a page flagged by the visual skim.
   Extend that same always-on numeric check to the other properties a screenshot skim structurally cannot catch, on
   one representative instance per page, both sites: **border** width/style/color on a sectioning element (a card, a
   footer/section divider), and the `:hover` `color`/`background-color` of one link and one button. These share the
   line-height problem — a border that's `1px solid rgba(255,255,255,0)` on one site and `rgba(255,255,255,0.15)` on
   the other is a visible line that no resting screenshot comparison will ever flag, and a hover state simply isn't
   in a screenshot at all. Drive hover with a real Playwright `hover()` and read the computed value, never by reading
   the CSS rule text: a hover rule that loses on specificity looks perfectly correct in source and is wrong on
   screen, which is exactly the failure this check exists to catch. Only for pages flagged by
   any of the checks above, drill into the rendered HTML/CSS on both sides to pin down exact values — don't say
   "spacing looks off," say "card padding is 16px on the original vs 24px on the rebuild." Don't re-derive the full
   design system (every color, every type size, every spacing value) from scratch on every page that already looks
   fine — that's redoing the analysis pass, not reviewing against it. Once a page IS flagged, check it against every
   category below, not just whatever first caught your eye — a page can be flagged for one obvious reason (e.g. a
   missing nav item) while a separate, equally real issue on the same page (e.g. a missing content container) goes
   unchecked because you stopped looking after the first hit.
   Categories to check exact values for, on flagged pages only:
   - Colors: get exact values via `getComputedStyle` on the rendered page (e.g.
     `getComputedStyle(el).backgroundColor`) rather than manually converting HSL/OKLCH custom properties to hex by
     hand — manual conversion is a real, easy-to-make rounding error (a few RGB units off is enough to be a visibly
     different shade once flagged as a discrepancy or applied as a fix). Note each color's exact rendered value and
     semantic role: primary, secondary, accent, background, text, etc.
   - Typography scale (font families, sizes, weights, line-heights for headings/body/labels)
   - Spacing system (padding/margin/gaps)
   - Container widths (max-widths, side margins/centering, and how they change per breakpoint — edge-to-edge vs. a
     centered boxed layout is easy to miss in a quick visual scan, so check it explicitly rather than relying on it
     looking "off")
   - Buttons (variants, states — default/hover/active/disabled — padding, radius, and whether icons like arrows or
     chevrons are present, not just their color/size)
   - Cards (structure, padding, shadow, radius, border treatment)
   - Sections (vertical rhythm/padding patterns between page sections)
   - Background treatments (overlay/scrim color and opacity over image or video backgrounds, gradients — a lighter
     or missing overlay changes both mood and text contrast)
   - Form fields (input background fill, border, placeholder color, and focus state — not just label styling; the
     dropdown open-state check itself already happened unconditionally in step 4, not gated here)
   - Responsive breakpoints (exact widths, and what changes/breaks at each one)

   A missing/broken image is a capture-timing artifact until proven otherwise: before reporting one, re-check that
   specific page (re-navigate, wait for the image-load check from step 3 to actually pass, and take one more
   screenshot) rather than trusting the first pass — the batched capture optimizes for overall speed, not certainty
   on any single flagged element.
6. Separately from the parity comparison above (or as the *only* pass, if no original is configured), look at the
   WordPress site's own screenshots (rebuild only — the original isn't the standard for this pass) for genuine
   site-quality issues: spacing or sizing that's inconsistent between visually-similar elements *on the rebuild
   itself* (not "does it match the original," but "do these five service-page heroes actually use the same padding as
   each other"), any component that reads as visibly dated, unfinished, or out of step with the rest of the site's own
   design language, and any plain layout gap or rough edge (odd whitespace, a crowded section, misaligned items) —
   even where the original mockup has the identical issue (if one exists). This is a judgment call, not a value
   lookup, so don't force a finding where the site genuinely looks fine — but don't skip a real one just because "the
   original does this too" would technically excuse it; that excuse doesn't apply here, since this pass isn't graded
   against the original at all.

   **Check sibling cards/panels in multi-column sections at intermediate widths, not just the three capture
   breakpoints.** A card that doesn't fill its column is the most common builder-layout defect there is, and it hides
   from a fixed-breakpoint sweep: the container row stretches its columns to equal height correctly, but the panel
   *inside* each column keeps its content height, so whichever side has less text ends higher and leaves a gap under
   it. Whether that gap is visible depends entirely on where the text happens to wrap, so it can be invisible at
   1440px and obvious at 1280px — three fixed widths can sit either side of a defect that exists between them. For
   any section with two or more side-by-side cards, measure each card's rendered height against its own column's
   height at a few widths across the range (e.g. 1440/1366/1280/1200/1100). Equal columns with unequal cards inside
   them is the signature; report the widths where it appears and by how much. The fix belongs in the builder — the
   widget should fill its container — not in a theme override targeting a generated element id, which would be brittle
   against any edit to that section. If no original is configured, also check every open-state dropdown screenshot from
   step 3 directly here (there's no pairing step to have caught it instead): is the option text actually legible
   against its background — this is the one category a closed-state screenshot can never reveal on its own.

If an original is configured: before writing the report, re-read the site identity note above and check every
finding's attribution against it — this is the point where it's easiest to accidentally swap which site is which,
especially once you're deep into framework-specific details ({{builder}} vs. the mockup's own components). A quick
check: every "original" reference should trace back to {{siteUrl}}/{{siteDir}}, every "rebuild" reference to
{{wpSiteUrl}}/{{wpSiteDir}}.

Then write a concrete, numbered findings report. With an original configured, split it into two clearly labeled
sections so whoever fixes this next knows which standard applies to which finding:
- **Parity mismatches** (vs. the original): one entry per issue, stating which page/section, what the original has
  vs what the rebuild has (with exact values where applicable), and a rough severity (visual or minor polish).
- **Site-quality issues** (rebuild's own merits, from step 6): one entry per issue, stating which page/section, what's
  wrong, and why it doesn't hold up as good/consistent/modern UI — note explicitly if the original has the same flaw,
  since that's relevant context but not a reason to skip it.
With no original configured, state that plainly at the top of the report (no reference design was available, so
every finding below is judged on the rebuild's own merits, not against an original) and include only the
**Site-quality issues** section — don't leave an empty "Parity mismatches" heading in the report.
Order each section so the most impactful/user-visible issues come first. If a page or section is genuinely fine on
both counts, don't invent a nitpick for it — say so briefly rather than padding the report.

**Anything you measured that differs belongs in one of the numbered sections.** Don't demote a real measured
difference to a closing remark, a "known notes" aside, or a parenthetical inside another finding — Change fixes the
numbered findings, so anything outside them is something that quietly never gets fixed. This has already happened
repeatedly on this project's header/footer reviews: a badge row sitting lower, a tagline wrapping to three lines
instead of two, a visible 1px border — each observed and written down in prose across several rounds, none ever
fixed, because none was ever a finding. If a difference is genuinely not worth fixing, it still gets a number, plus
one line saying why it's being left — a decision on the record rather than a detail that fell off the list. List any page/breakpoint
that had to be skipped because its screenshot timed out or errored, so it's visibly flagged as unreviewed rather than
silently missing.

Present the finished report here in the chat as a plan for what needs to change — don't start fixing anything yet.

Also save the complete, final report to {{wpSiteDir}}/reports/review-ui-report.md (create the folder if needed;
overwrite any previous version) — the whole report exactly as presented in the chat, not a summary, so it exists
independent of chat history. If reaching the final report took multiple messages, write the one complete, standalone
version here, not just whatever happened to be in your last message.
