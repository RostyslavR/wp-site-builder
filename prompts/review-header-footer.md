Review how closely the WordPress site's **header and footer** match the original — this is a narrower, faster
sibling of Review UI, not a replacement for it: Review UI screenshots every page and catches whatever's visibly
different; this one is a deep, numeric audit of just the header and footer specifically, because those two
components are shared across every page (so they only need checking once) and have repeatedly turned out to hide
mismatches that a per-page visual skim doesn't reliably catch — a wrong container width, or a text style silently
overridden by another stylesheet, can look "close enough" in a screenshot while being measurably wrong. Do not make
any code or content changes yet — this is a comparison + reporting task only, same as the other review prompts.

Site identity — get this right before writing anything, mixing it up makes every finding backwards and actively
misleading: {{siteUrl}} (source at {{siteDir}}) is the ORIGINAL design being matched — the reference, never to be
edited. {{wpSiteUrl}} (source at {{wpSiteDir}}, using {{builder}}) is the WORDPRESS REBUILD being graded.

{{liveReviewNote}}

**No original configured:** treat this as having no reference design at all — not just when {{siteDir}}/{{siteUrl}}
are blank or literally "(not set)", but also if either one actually resolves to the same site as {{wpSiteUrl}}/
{{wpSiteDir}} itself. In that case there's nothing to diff against — just confirm {{wpSiteUrl}} itself is reachable,
skip straight to step 5 below (font-family/color source-of-truth check only, which doesn't need a reference), and
say plainly in the report that no parity comparison was possible.

Track your progress through the steps below with the TodoWrite tool as you go.

1. Confirm both sites are reachable ({{siteUrl}} and {{wpSiteUrl}} should already be running from earlier steps) —
   don't start either yourself; if one isn't reachable, stop and report that back instead.
2. Before using Playwright, confirm it's actually resolvable globally (`NODE_PATH=$(npm root -g) node -e
   "require.resolve('playwright')"`) rather than assuming a prior session set it up; install it globally once
   (`npm install -g playwright`) if not, and always run scripts with `NODE_PATH=$(npm root -g)` set. Write one
   Playwright script, saved to {{wpSiteDir}}/scripts/, that opens one browser and does everything below in a single
   pass across both sites — this review only ever touches two components, so it should run in well under a minute,
   not per-element script invocations.
3. **Container width.** Measure the header's and footer's own outermost content container (not the page body's) at
   two viewport widths, e.g. 1440px and 1920px — `getBoundingClientRect().width` on the direct content wrapper
   (logo+nav row; logo+columns row), not the full-bleed background element around it. If it scales proportionally
   with the viewport rather than staying fixed, it's an uncapped/full-width container with just side padding, not a
   boxed max-width — record which, and the exact px values (max-width, side padding or gap, and — for the footer —
   column count/ratio and inter-column gap). Compare directly against the same measurement on the rebuild. Don't
   assume the header and footer share one container spec with each other or with the page body — measure each
   independently, since a theme-coded header/footer commonly differs from both. The footer is usually **two stacked
   containers, not one** — the main widget/columns area, and a separate below-footer copyright/legal bar underneath
   it (e.g. Astra's `.site-above-footer-inner-wrap` vs `.site-below-footer-inner-wrap`). These routinely have
   different specs: the main area boxed while the bar is full-bleed, or vice versa. Measure and report both as
   separate containers — a mismatch here reads as "correct" if you only measure the main area, and has already been
   missed that way.
4. **Every text element's computed style.** For each of: logo (rendered width/height), nav links, the header CTA
   button (text, not just its box), footer headings, footer tagline, footer contact text, footer nav/quick-links,
   footer copyright bar text — record `getComputedStyle` font-family, font-size, font-weight, line-height, and color
   on both sites, plus the CTA/any button's padding, border-radius, and border. List every value side by side in the
   report; don't summarize as "fonts match" without the actual numbers. Header and footer buttons are a common case
   of two genuinely different button systems on the same site (e.g. a theme-builder header button vs. the page
   builder's own body-CTA style) — measure each independently rather than assuming one CTA spec covers both.
5. **Font-family/color source-of-truth check (do this even with no original configured).** For every element
   measured in step 4, don't just trust the final `getComputedStyle` output — confirm *which stylesheet rule* is
   actually winning for font-family, color, and font-size, via:
   ```js
   [...document.styleSheets].flatMap(sheet => {
     try { return [...sheet.cssRules]; } catch { return []; }
   }).filter(rule => rule.selectorText && el.matches(rule.selectorText) &&
     (rule.style.fontFamily || rule.style.color || rule.style.fontSize))
   ```
   Header/footer are typically theme-coded (outside the page builder's own rendered content), but if {{builder}} is
   Elementor, its Kit still frequently emits **global, unscoped-looking rules** (e.g. `.elementor-kit-<N> a`,
   `.elementor-kit-<N> h1`..`h6`, `.elementor-kit-<N> button`) applied via a body class Elementor adds site-wide —
   these silently win over a theme rule that's only a single class selector, because class+tag beats a lone class in
   specificity. This has already caused real, hard-to-notice bugs here (a button rendering in the wrong font, a
   footer heading at the wrong size/color) that looked fine in a screenshot because the *values* happened to be
   plausible, just not the ones actually authored. For every element where a `.elementor-kit-*`-scoped rule
   matches, flag it explicitly as a specificity risk even if the current rendered value happens to look right by
   coincidence — that's still fragile and worth fixing at the source (bump the theme rule's own specificity, e.g. by
   doubling its class) rather than leaving it working by accident.
6. **Flags/badges/icons.** If the header or footer has a language switcher, certification badges, or similar small
   repeated icons: record each image's rendered width/height, gap between them, and distance from the nearest
   neighboring element (e.g. button-to-flags gap). Note whether the original implements these as one composite image
   or as separate individual assets — that's a real structural difference worth recording even if visually close,
   not something to paper over.
   **Never conclude the original "doesn't have" one of these elements from filenames or asset counts.** A design
   exported from a visual tool routinely bakes flags, badges, or a whole icon row into a *single* composite image
   with a generic name (`Untitled-design-1024x768.png`), so searching the original for `flag-*.png` finds nothing
   while the flags are plainly visible on the page. That exact mistake has already produced a confidently-wrong
   finding here — "the rebuild adds 3 flags the original doesn't have" — when the original had them all along, and
   acting on it would have deleted correct work. Before writing any finding of the form "the rebuild has X, the
   original has none", enumerate every `<img>` actually rendered in the original's header and footer with its
   rendered box, and look at what those images *depict* — a 107×80 image sitting where the rebuild's flags are is
   the flags. Absence is only reportable once the rendered images have been accounted for.
7. **Vertical rhythm and spacing.** Measure the *gaps between* things, not just the things themselves: each
   component's own top/bottom padding, the margin under each footer heading, the vertical gap between stacked items
   in a link list, the distance from a column's top edge to its first element, and the vertical offset of any
   image block (badges, flags) from the element above it. Record exact px on both sites and compare. Text metrics
   have been measured reliably here for a while; spacing has not been measured at all, and it is where the
   remaining visible differences have actually been hiding — a "the badge row sits lower on the original" note went
   three review rounds without ever becoming a finding, because nothing asked for the number.
8. **Surfaces, borders and dividers.** Record `background-color` for the header, the footer's main area, and the
   copyright bar, plus every `border-*-width/style/color` on those three (especially a top border between the footer
   and the copyright bar) and any `box-shadow`. A border that is present but fully transparent on one site and
   visibly tinted on the other renders as a real line and is easy to miss by eye — that exact case (`1px solid
   rgba(255,255,255,0)` vs `rgba(255,255,255,0.15)`) is live on this project right now and has never been reported.
   **Compare rendered result, not which element carries it:** a theme-coded rebuild routinely paints the same
   background on a different node than the original does (footer wrapper vs. inner bar). If the painted area and
   color match, that is not a finding — only report it when the visible result differs.
9. **Interactive states.** For header nav links, the header CTA, footer quick-links, and the copyright/privacy link,
   record the resting *and* `:hover` computed `color`, `background-color`, and `text-decoration` on both sites
   (drive it with a real Playwright `hover()`, not by reading the rule text — a hover rule that never wins on
   specificity would otherwise look correct in source and be wrong on screen). Also check the focus ring is still
   visible on keyboard focus. None of this is currently measured, so a wrong hover color survives every review.
10. **Header scroll behaviour.** Everything above measures the header standing still, so a header that is *supposed*
    to stay put and doesn't would pass every check. Record its computed `position` — then **scroll the page and
    re-measure its rect**. Applying `position:sticky` is not the same as it working: the property computes as
    `sticky` and the header still scrolls away if anything disables it. If it is meant to be sticky/fixed and isn't:
    - **Check `overflow-x`/`overflow-y` on `html` and `body` first.** `overflow-x:hidden` — a very common rule for
      suppressing sideways scroll — turns that element into a scroll container, which silently disables
      `position:sticky` on descendants. No error, no warning, the property simply does nothing. `overflow-x:clip`
      prevents the same sideways scroll without creating a scroll container, and is the fix. Also check ancestors
      for `transform`/`filter`/`contain`, which break `fixed` similarly.
    - **Check in-page anchors clear it.** With a sticky/fixed header, an anchor target scrolls to the very top and
      lands *underneath* the bar unless `scroll-padding-top` (on the scroll container) or `scroll-margin-top` (on the
      targets) offsets it. Verify by actually activating an in-page link — a nav CTA pointing at a `#section`, and
      the skip link's target, which matters most since it's an accessibility path — then confirming the target's top
      is at or below the header's bottom edge. Check per breakpoint: the header is usually shorter on mobile, so one
      hardcoded offset is right at one width and wrong at the other.
    Report what you measured after scrolling, not just the declared value.
11. **The footer at mobile and tablet.** At 390px and 768px, record the footer's column count, the stacking order of
    its columns, its side padding, and whether any block (badge grid, flag row, long heading) overflows its column
    or the viewport. Step 3 measures container *width* at desktop widths only, so a footer that reflows badly below
    1440px currently produces no finding at all.

Then write a concrete report, numbered, ordered most-impactful first: for each finding, which component
(header/footer), which element, what the original has vs. what the rebuild has (exact values), and — for anything
caught by step 5 — whether it's a currently-wrong value or a currently-correct-but-fragile one. If a category has no
issues, say so briefly rather than padding the report.

**Anything you measured that differs belongs in the numbered findings.** Don't demote a real measured difference to
a closing remark, a "known notes" aside, or a parenthetical inside another finding — Change fixes the numbered list,
so anything outside it is something that quietly never gets fixed. This has already happened repeatedly here: a
badge row sitting lower, a tagline wrapping to three lines instead of two, a visible 1px border, all noted in prose
across several rounds and none ever fixed, because none was ever a finding. If a difference is genuinely not worth
fixing, it still gets a number, plus one line saying why it's being left — that's a decision on the record rather
than a detail that fell off the list.

Present the finished report here in the chat — don't start fixing anything yet.

Also save the complete, final report to {{wpSiteDir}}/reports/review-header-footer-report.md (create the folder if
needed; overwrite any previous version) — the whole report exactly as presented in the chat, not a summary, so it
exists independent of chat history.
