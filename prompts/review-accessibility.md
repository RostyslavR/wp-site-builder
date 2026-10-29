Review the accessibility of the WordPress site at {{wpSiteDir}} (it runs at {{wpSiteUrl}}) against WCAG 2.1 Level AA.
Do not make any code or content changes yet — this is a comparison + reporting task only, same as Review UI, but for
accessibility instead of visual design.

This review is scoped to {{wpSiteUrl}}/{{wpSiteDir}} only — evaluate it against the WCAG standard directly, not
against whatever the original design at {{siteUrl}}/{{siteDir}} does or doesn't do. The original is a Vite/React
mockup, not a reference for accessibility; it may have its own real gaps (missing labels, poor contrast, no keyboard
support) that shouldn't be treated as acceptable just because the mockup has them, and it may also do things
correctly that the rebuild should still meet independently. Don't touch {{siteUrl}}/{{siteDir}} at all in this pass.

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
   Run an automated accessibility scan across every page. Write one Playwright script (run with Bash, saved to
   {{wpSiteDir}}/scripts/ — not wherever it'd otherwise land, but run with `NODE_PATH=$(npm root -g)` the same way,
   and **with {{wpSiteDir}} as the working directory**, never this dashboard app's own repo: a browser launch can
   drop a disposable scratch profile into the current working directory, and a stray profile inside the app repo
   breaks its dev server outright — the bundler walks the project tree, hits the profile's `SingletonSocket`, and
   fails on a file that is a socket rather than a regular file)
   that opens a single browser and, in one pass, loops through every page, injecting and running the axe-core engine
   (`@axe-core/playwright`, installed globally the same way as Playwright itself above, if it isn't already there —
   or the plain `axe-core` script injected
   and invoked directly via `page.evaluate` if it genuinely can't be) and collecting every violation with its WCAG
   criterion, severity (`critical`/`serious`/`moderate`/`minor`), and the specific element(s) it applies to. If
   axe-core genuinely can't be made available, say so explicitly in the
   report and rely more heavily on the manual checks below instead of skipping the automated pass silently.
   Afterward, check for and delete any stray Chrome/browser temp-profile directories the script's browser launch left
   behind (recognizable by a `Default/`/`Local State`/`Safe Browsing` structure — a disposable scratch profile, never
   real output) — check both the usual OS temp location and, due to a known WSL/Windows path-interop quirk, directly
   inside {{wpSiteDir}} itself, where one can land as a single oddly-named folder containing literal backslashes/
   colons (e.g. `C:\Users\...\lighthouse.NNNNNN`) instead of a real nested Windows path.
4. Beyond what the automated scan catches, manually check each of the following — an automated scanner can confirm
   an `alt` attribute exists, for instance, but not that its wording is actually meaningful:
   - Keyboard-only navigation: tab through every interactive element on a representative set of pages (nav, forms,
     buttons, links, the mobile hamburger menu) — confirm a visible focus indicator appears on every one of them,
     confirm the tab order is logical (matches visual reading order), and confirm nothing traps focus (a modal or
     dropdown that opens should be escapable and should return focus sensibly on close).
   - Heading hierarchy: exactly one `<h1>` per page, matching its actual primary heading, with no skipped levels
     (an `<h3>` directly under an `<h1>` with no `<h2>`, etc.). **Derive this from the rendered DOM — the full,
     in-order list of `<h1>`–`<h6>` on the page — never from the builder's own settings.** A page builder exposes a
     heading level only for the widgets it owns (Elementor's `header_size`), while third-party addon widgets carry
     their own setting under a different name (Royal Addons' slider uses `slider_title_tag`, and other widgets
     hardcode the tag with no setting at all). A check that reads builder settings therefore reports a page clean
     while it visibly skips a level. Where a skip traces to a widget with no exposed setting, say so and leave it —
     that's a plugin-markup finding for the user, not something to patch around. Report the actual rendered sequence
     for each page in the finding, so a later fix pass can be verified against it rather than against the settings
     it happened to change.
   - Landmark regions: `<header>`, `<nav>`, `<main>`, `<footer>` present and used correctly, not just generic `<div>`s
     with no semantic role.
   - Image alt text: meaningful, specific alt text on real content images (not the filename, not "image"); empty
     `alt=""` (not a missing attribute) on purely decorative images.
   - Form labels: every input/select/textarea programmatically associated with a visible `<label>` (via `for`/`id` or
     wrapping) — a placeholder alone doesn't count, since it disappears the moment the user starts typing.
   - Color contrast: verify actual rendered contrast ratios via `getComputedStyle` (text color vs. background color,
     accounting for any overlay/gradient it sits on) against WCAG 2.1 AA's 4.5:1 (normal text) / 3:1 (large text,
     ≥18pt or ≥14pt bold) thresholds — check body text, muted/secondary text, placeholder text, and button text
     specifically, since those are the most common failures. This WCAG 2.1 ratio is the pass/fail standard for every
     contrast finding — it's what real-world compliance actually checks against. Alongside it, also compute and
     report the APCA (Lc) value for the same color pairs as supplementary, informational-only context, not a second
     pass/fail gate — WCAG 2's ratio math is known to be perceptually inaccurate in some cases (passing some
     bad-looking combinations, failing some fine-looking ones, especially with thin/light fonts), and APCA is a more
     perceptually accurate model, even though it isn't a ratified standard yet and has no fixed conformance
     threshold. Compute it with the `apca-w3` npm package (install it into {{wpSiteDir}}/scripts/, same as any other
     one-off tooling — see the script-location note elsewhere in this file) rather than approximating it by hand.
     As a rough, non-normative reference for reading the reported Lc values: roughly |Lc| ≥ 90 reads as strongly
     readable body text, ~75 as a reasonable minimum for body text, ~60 as usable for larger/bolder text.

     For any pair that already **passes** WCAG 2.1 (so it isn't a violation), also check its APCA score against
     those reference numbers for its text size/weight. If the APCA score is notably below the relevant reference
     despite passing WCAG 2.1 — a real, perceptually-weak result the ratio math alone doesn't catch — report it as a
     separate **quality finding**, clearly distinguished from the WCAG violations above: labeled as a suggestion for
     genuinely better readability, not a compliance requirement, since there's no ratified APCA threshold to fail
     against. This is most useful as a second-pass check once WCAG 2.1 violations have already been fixed — on a
     first pass with real violations still present, prioritize those, and only flag APCA-quality findings for pairs
     that are otherwise already passing.
   - Accessible names on icon-only controls: the mobile hamburger menu button, the scroll-to-top button, and any
     other icon-only button or link need an accessible name (`aria-label` or visually-hidden text), not just a
     visual icon with nothing for a screen reader to announce.
   - Link purpose: link text should make sense out of context (not bare "click here" or "read more" with nothing
     else identifying what it leads to).
   - Skip-to-content link: present and functional, so keyboard users aren't forced to tab through the entire nav on
     every single page.
   - Zoom/reflow: check the page at 200% browser zoom and at narrow mobile widths — content shouldn't be clipped,
     overlapping, or force horizontal scrolling.
   - Reduced motion: if any animation/transition is more than incidental (an auto-playing carousel, a parallax
     effect), confirm it respects `prefers-reduced-motion` — note it as a gap if not, but don't invent an animation
     concern if the site doesn't really have any non-trivial motion to begin with.

Then write a concrete, numbered findings report, split into two clearly labeled sections so it's obvious which is
which:
- **WCAG violations** — one entry per issue, each stating: which page/element, what's wrong, the relevant WCAG
  success criterion (e.g. "1.4.3 Contrast (Minimum)"), and severity (`critical`/`serious`/`moderate`/`minor`,
  matching the automated scan's own scale so findings from both sources sit on one consistent scale). For every
  contrast finding specifically, report both numbers side by side — the WCAG 2.1 ratio (the pass/fail basis for the
  finding) and the APCA Lc value (informational context alongside it, not a second requirement).
- **APCA quality suggestions** — pairs that already pass WCAG 2.1 but scored notably weak on APCA per the reference
  above; one entry per suggestion, stating which page/element, the passing WCAG ratio, the weak APCA score, and why
  it's worth a look. Explicitly not required for compliance — label it that way so it doesn't get treated as a
  blocking issue.
Order the WCAG section with `critical`/`serious` issues first. If a page has no material accessibility issues, say so
briefly rather than padding the report with minor nitpicks. List any page that had to be skipped (script error,
timeout) so it's visibly flagged as unreviewed rather than silently missing.

Present the finished report here in the chat as a plan for what needs to change — don't start fixing anything yet.

Also save the complete, final report to {{wpSiteDir}}/reports/review-accessibility-report.md (create the folder if
needed; overwrite any previous version) — the whole report exactly as presented in the chat, not a summary, so it
exists independent of chat history. If reaching the final report took multiple messages, write the one complete,
standalone version here, not just whatever happened to be in your last message.
