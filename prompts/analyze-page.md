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

Investigate ONE page of the reference design at {{siteDir}} (it runs at {{siteUrl}}) and write a build-ready plan
for it. **Analysis only — make no changes to either site.**

**Design page to analyze (path on {{siteUrl}}):** {{designPagePath}}

If that line is blank, stop here and report back asking for it to be filled in (Settings → Site → Page) — don't
guess a path.

If a whole-site Analyze has already been run, reuse its design-system findings below (colors, fonts, spacing scale,
container width) rather than re-deriving your own — they're the same source of truth this page's tokens have to
agree with. If it instead reads "(no plan found — send an Analyze prompt first and wait for a response)", derive
whatever page-specific colors/fonts/spacing you need directly from this page, the same way the whole-site Analyze
would have:

{{plan}}

Before executing, make sure {{siteUrl}} is actually reachable — if it isn't already running, start it yourself
(find and use whatever PORT/BASE_PATH/env vars the project requires, the same way Install Site would), and verify
images and other assets actually render, not just that the page returns 200.

1. Screenshot the page at mobile, tablet, and desktop widths.
2. Document its structure top to bottom, section by section — what each section contains (heading, copy, imagery,
   CTAs, interactive elements like forms/accordions/sliders), in the same spirit as a component inventory: enough
   detail that someone building it later doesn't have to re-look at the design to know what goes where.
3. Record exact design values actually used **on this page** via `getComputedStyle` — colors, fonts/sizes/weights,
   spacing, container widths — noting anywhere this page diverges from the shared system above (a one-off color, a
   different container width) rather than assuming it's identical throughout. **Before calling any color or font a
   new one-off, check the site's actual *current* Kit** — `wp eval` reading the active Kit's
   `_elementor_page_settings` (`system_colors`/`custom_colors`/`system_typography`/`custom_typography`), not just
   the static `{{plan}}` text above, since the Kit can have changed since that plan was last written (a color added
   from a different page's Create pass, say). A value that matches an existing swatch/font by hex or exact spec
   isn't new — say so explicitly and name the existing swatch/font to link to, rather than reporting it as a fresh
   discovery for Create to add again. This matters even for a value that currently only appears on one page: it
   might already be a literal-only "page-only" color intentionally left out of the Kit elsewhere — check for that
   hex appearing as a literal value on other pages' own `_elementor_data` too, not just in the Kit's global lists,
   since a color reused across pages as a literal is a real signal it should become an actual Global Color now
   (native, additive, always safe to add — unlike a Theme Style change) rather than staying copy-pasted per page.
4. List every media asset this page uses (images, icons) with its role (content vs. decorative) — this becomes the
   alt-text and upload list for whoever builds the page.
5. Note any content this page has that a straightforward rebuild might miss — a scroll-triggered animation, a
   sticky element, a form's exact field list and validation behavior.

If you started {{siteUrl}}'s dev server yourself, stop it again once you're done.

Finish with a report posted in chat covering the page's structure, exact design values, media list, and anything
easy to miss (step 5). Also save this same complete report to {{wpSiteDir}}/reports/analyze-page-report.md (create
the folder if needed; overwrite any previous version) — the whole report exactly as posted in chat, not a summary,
so it exists independent of chat history.
