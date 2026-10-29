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

Investigate the overall design system of the reference design at {{siteDir}} (it runs at {{siteUrl}}) and write a
build-ready plan for setting it up as {{builder}}'s **Global** styles (Site Settings → Global Colors / Global Fonts
/ Theme Style / Layout) — the shared, reusable definitions every later page/header/footer build should link to,
rather than each repeating its own literal values. **Analysis only — make no changes to either site.**

If a whole-site Analyze has already been run, reuse its design-system findings (§2 in that report) as the starting
point and skip straight to the Kit-mapping work below; only re-derive values directly from {{siteUrl}} if the plan
below reads "(no plan found — send an Analyze prompt first and wait for a response)":

{{plan}}

Before executing, make sure {{siteUrl}} is actually reachable — if it isn't already running, start it yourself
(find and use whatever PORT/BASE_PATH/env vars the project requires, the same way Install Site would).

1. **Colors.** List every distinct color used across the design (not just one page — sample several if the whole-
   site plan above doesn't already cover this), each with its exact hex value and semantic role. Explicitly map:
   - Which four map to {{builder}}'s four **system** color slots (Primary/Secondary/Text/Accent) — these are what a
     widget's color picker offers first, so they should carry the design's most-used, most-central colors.
   - Every other color as a **custom** named swatch (a short, human name — "Ivory background", "Teal hairline @
     18%" — not just its hex).
2. **Typography.** Same mapping exercise for fonts:
   - Family/weight for the four **system** typography slots (Primary/Secondary/Text/Accent) — which one is
     headings, which is body, etc.
   - Per-heading-level sizes (H1–H6) and any other named text style (an eyebrow/label style, a button label style)
     that repeats across the design — these apply to Theme Style, not the Global Fonts catalog itself (see step 4).
   - Confirm whether every font is a system font (no web-font loading needed) or note exactly which ones need
     enqueuing.
3. **Layout.** The site's boxed content width (measured directly, not assumed — confirm it holds at multiple
   viewports), and the base spacing scale/unit if one is apparent (e.g. "4px base, common increments 8/16/24/48").
4. **Theme Style defaults** implied by the above: heading color/family/size per level, body font/size/line-height/
   color, link color + hover, and the primary button's own bg/text/radius/padding — matching {{builder}}'s Theme
   Style panel fields, not just the raw design values from step 1–2, so Create can set these directly.

Finish with a report posted in chat covering the color/typography mapping (step 1–2, explicit about which slot
each value becomes), the layout values (step 3), and the Theme Style defaults (step 4). Also save this same complete
report to {{wpSiteDir}}/reports/analyze-global-styles-report.md (create the folder if needed; overwrite any previous
version) — the whole report exactly as posted in chat, not a summary, so it exists independent of chat history.
