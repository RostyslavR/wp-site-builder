Investigate the product-listing ("Shop") page of the reference design at {{siteDir}} (it runs at {{siteUrl}}) and
write a build-ready plan for it. **Analysis only — make no changes to either site.**

**Design page to analyze (path on {{siteUrl}}):** {{designPagePath}}

If that line is blank, stop here and report back asking for it to be filled in (Settings → Site → Page) — don't
guess a path.

If a whole-site Analyze has already been run, reuse its design-system findings below (colors, fonts, spacing scale,
container width) rather than re-deriving your own. If it instead reads "(no plan found — send an Analyze prompt
first and wait for a response)", derive whatever page-specific colors/fonts/spacing you need directly from this
page, the same way the whole-site Analyze would have:

{{plan}}

Before executing, make sure {{siteUrl}} is actually reachable — if it isn't already running, start it yourself
(find and use whatever PORT/BASE_PATH/env vars the project requires, the same way Install Site would), and verify
images and other assets actually render, not just that the page returns 200.

1. Screenshot the page at mobile, tablet, and desktop widths — including a hovered product card and, if the design
   demonstrates one, an active sort/filter state (a selected sort option, an applied category filter).
2. Document the page's structure top to bottom: any hero/category banner above the grid, the sort/filter controls
   (dropdown, sidebar checkboxes, tag pills — whichever the design actually uses, with their exact option labels),
   the product grid itself (columns per breakpoint, gap, and every element inside one card — image, sale/out-of-
   stock badge, title, price, rating, add-to-cart control, and what changes on hover), the pagination pattern
   (numbered pages, load-more button, infinite scroll), and any content before/after the grid (featured categories,
   a newsletter band, cross-sell content).
3. Record exact design values via `getComputedStyle` — grid container width and gutter, card padding/radius/shadow,
   badge styling, the rating stars' styling, the pagination control's styling, and the add-to-cart control's own
   style (cross-reference the design's general button system if a whole-site Analyze already documented one).
   **Before calling any color or font a new one-off, check the site's actual *current* Kit** — `wp eval` reading the
   active Kit's `_elementor_page_settings` (`system_colors`/`custom_colors`/`system_typography`/`custom_typography`),
   not just the static `{{plan}}` text above, since the Kit can have changed since that plan was last written. A
   value that matches an existing swatch/font by hex or exact spec isn't new — name the existing swatch/font to link
   to, rather than reporting it as a fresh discovery for Create to add again.
4. **Flag which parts of the page are genuinely fixed chrome vs. per-product dynamic content that must never be
   hardcoded.** The reference design most likely shows a fixed set of example products — everything about an
   individual card (its image, title, price, rating, stock state) has to come from the real product catalog at
   build time, not be copied verbatim from whichever sample products the design happens to display. Call out
   anything that IS genuinely static regardless of catalog (an intro heading above the grid, a promotional banner)
   separately from the per-card fields that are catalog-driven.
5. Note whether the design shows an empty/no-results state (a category or search with zero matches) — a static
   mockup usually doesn't demonstrate one. If it doesn't, say so explicitly as a real gap for Create to design a
   reasonable one for (matching the page's overall style) rather than silently skipping it.
6. Read-only inventory of the **current** WordPress site's shop page, for context on what a later Create pass would
   be coexisting with — don't change anything: is there already an Elementor Pro Theme Builder "Products Archive"
   template (`wp post list --post_type=elementor_library` — look for `_elementor_template_type` = `product-archive`
   in that post's meta), and if not, what currently renders the live Shop page (the active theme's own WooCommerce
   template files, or an Elementor Pro default skin) — so a new template can be built as a genuinely separate,
   unassigned artifact without guessing at what's already live. If an earlier report claims specific custom logic
   (a meta box, a hook, a filter) lives in a particular theme or plugin file, don't cite that claim as-is — grep the
   *current* active theme's `functions.php` and every active plugin yourself. Custom code routinely gets moved
   between theme and plugin across sessions (e.g. to survive a theme switch), and an old report's file location goes
   stale silently — the same staleness risk as the Kit colors/fonts check in step 3, just for code instead of styles.

If you started {{siteUrl}}'s dev server yourself, stop it again once you're done.

Finish with a report posted in chat covering the page's structure, exact design values, the static-vs-dynamic
content flag (step 4), the empty-state gap (step 5), and the current-WordPress inventory (step 6). Also save this
same complete report to {{wpSiteDir}}/reports/analyze-shop-report.md (create the folder if needed; overwrite any
previous version) — the whole report exactly as posted in chat, not a summary, so it exists independent of chat
history.
