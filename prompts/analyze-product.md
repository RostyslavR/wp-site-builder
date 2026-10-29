Investigate ONE single-product page of the reference design at {{siteDir}} (it runs at {{siteUrl}}) and write a
build-ready plan for it. **Analysis only — make no changes to either site.**

**Design page to analyze (path on {{siteUrl}}):** {{designPagePath}}

If that line is blank, stop here and report back asking for it to be filled in (Settings → Site → Page) — don't
guess a path.

If a whole-site Analyze has already been run, reuse its design-system findings below (colors, fonts, spacing scale,
container width) rather than re-deriving your own. If an Analyze: Shop has already run, also reuse its card/button
styling for consistency between the grid and this page (e.g. the same add-to-cart control style, the same rating-
stars treatment) rather than re-deriving a diverging version. If neither exists yet and the block below reads
"(no plan found — send an Analyze prompt first and wait for a response)", derive whatever page-specific colors/
fonts/spacing you need directly from this page:

{{plan}}

Before executing, make sure {{siteUrl}} is actually reachable — if it isn't already running, start it yourself
(find and use whatever PORT/BASE_PATH/env vars the project requires, the same way Install Site would), and verify
images and other assets actually render, not just that the page returns 200.

1. Screenshot the page at mobile, tablet, and desktop widths — plus the gallery's zoomed/lightbox state if it has
   one, and, if the demo product has variations, the visual change after selecting a different variant/attribute
   (a different color swatch, a different size).
2. Document the page's structure top to bottom: the gallery (main image plus thumbnail strip/dots, and its zoom/
   lightbox behavior), title, price display (regular vs. sale, the strikethrough treatment), rating/review-count
   summary, short description, variant/attribute selector style (swatches, color chips, or a plain dropdown) if the
   demo product has any, the quantity stepper and add-to-cart control's style, the meta row (SKU, categories,
   tags), the tabs section (exact tab labels — typically Description / Additional Information / Reviews — and
   which one is active by default), the related/upsell products section at the bottom (carousel or grid, and its
   own card style), and any trust badges or shipping-info blocks.
3. Record exact design values via `getComputedStyle` — gallery dimensions, price typography (including the sale
   strikethrough's own color/style), the variant-selector's sizing and selected-state styling, the add-to-cart
   control's style (cross-reference the design's general button system, or the Analyze: Shop report's own add-to-
   cart styling if one exists), the tabs' active/inactive styling, and the related-products card style (cross-
   reference the Analyze: Shop report's card anatomy if it exists, to keep the two consistent). **Before calling any
   color or font a new one-off, check the site's actual *current* Kit** — `wp eval` reading the active Kit's
   `_elementor_page_settings` (`system_colors`/`custom_colors`/`system_typography`/`custom_typography`), not just
   the static `{{plan}}` text above. A value that matches an existing swatch/font by hex or exact spec isn't new —
   name the existing one to link to instead of reporting it as a fresh discovery.
4. **Flag which parts of the page are genuinely fixed chrome vs. per-product dynamic content that must never be
   hardcoded.** Every field describing the specific product shown (its title, price, images, description, stock
   status, SKU, reviews) has to come from the real product being viewed at build time, not be copied verbatim from
   whichever single example product the reference design happens to show — this template will render every product
   in the catalog, not just this one. Call out anything genuinely constant across every product (a shared trust-
   badge row, a shared shipping blurb) separately from the per-product dynamic fields.
5. Note anything a straightforward rebuild might miss: an image-zoom-on-hover interaction, a sticky add-to-cart bar
   that appears on scroll (mobile especially), an inline size-guide link/modal, stock-countdown urgency messaging,
   or a variation-dependent price/image swap.
6. Read-only inventory of the **current** WordPress site's product pages, for context on what a later Create pass
   would be coexisting with — don't change anything: is there already an Elementor Pro Theme Builder "Single
   Product" template (`wp post list --post_type=elementor_library` — look for `_elementor_template_type` = `product`
   in that post's meta), and if not, what currently renders a live product page (the active theme's own WooCommerce
   template files, or an Elementor Pro default skin). If an earlier report claims specific custom logic (a purchase
   switcher, a meta box, a hook) lives in a particular theme or plugin file, don't cite that claim as-is — grep the
   *current* active theme's `functions.php` and every active plugin yourself. Custom code routinely gets moved
   between theme and plugin across sessions (e.g. to survive a theme switch), and an old report's file location goes
   stale silently — the same staleness risk as the Kit colors/fonts check that a whole-site or Shop Analyze applies.

If you started {{siteUrl}}'s dev server yourself, stop it again once you're done.

Finish with a report posted in chat covering the page's structure, exact design values, the static-vs-dynamic
content flag (step 4), anything easy to miss (step 5), and the current-WordPress inventory (step 6). Also save this
same complete report to {{wpSiteDir}}/reports/analyze-product-report.md (create the folder if needed; overwrite any
previous version) — the whole report exactly as posted in chat, not a summary, so it exists independent of chat
history.
