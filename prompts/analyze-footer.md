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

Investigate the footer of the reference design at {{siteDir}} (it runs at {{siteUrl}}) and write a build-ready plan
for it. **Analysis only — make no changes to either site**, including the live WordPress site's own current footer.

If a whole-site Analyze has already been run, reuse its design-system findings below (colors, fonts, spacing scale,
container width) rather than re-deriving your own. If it instead reads "(no plan found — send an Analyze prompt
first and wait for a response)", derive whatever footer-specific colors/fonts/spacing you need directly from the
footer itself:

{{plan}}

Before executing, make sure {{siteUrl}} is actually reachable — if it isn't already running, start it yourself
(find and use whatever PORT/BASE_PATH/env vars the project requires, the same way Install Site would).

1. Screenshot the footer at mobile, tablet, and desktop widths.
2. Document its exact content column by column: logo/tagline, every link with its target and type (real page,
   anchor, external, `tel:`/`mailto:`), any contact details (address/phone/hours) shown as plain text, and the
   legal/copyright line.
3. Record exact design values via `getComputedStyle`: container width (measured directly on the footer, not assumed
   to match the body), background/text colors, fonts, spacing between columns and internally. Before calling any
   color/font new, check the site's actual *current* Kit (`wp eval` reading the active Kit's
   `_elementor_page_settings` — `system_colors`/`custom_colors`/`system_typography`/`custom_typography`), not just
   the static `{{plan}}` text above, since the Kit can have changed since that plan was last written. A value
   matching an existing swatch/font isn't new — name the existing one to link to instead of reporting it as a fresh
   discovery.
4. Read-only inventory of the **current** WordPress site's footer, for context on what a later Create pass would be
   coexisting with — don't change anything: which theme is active, whether the footer comes from an Elementor
   Theme Builder template (check `wp post list --post_type=elementor_library`) or a theme `footer.php`, and what
   the current footer actually contains. If an earlier report claims specific custom logic lives in a particular
   theme or plugin file, don't cite that claim as-is — grep the *current* active theme's `functions.php` and every
   active plugin yourself; custom code routinely moves between theme and plugin across sessions and an old report's
   file location goes stale silently.

If you started {{siteUrl}}'s dev server yourself, stop it again once you're done.

Finish with a report posted in chat covering the footer's exact content, design values, and the current-WordPress
inventory from step 4. Also save this same complete report to {{wpSiteDir}}/reports/analyze-footer-report.md
(create the folder if needed; overwrite any previous version) — the whole report exactly as posted in chat, not a
summary, so it exists independent of chat history.
