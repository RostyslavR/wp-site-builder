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

Here is the most recently produced scoped analysis — from **Analyze: {{scope}}** — read it to see what to build:

{{analysisReport}}

If the block above literally says "(no analysis found — run Analyze: Page/Header/Footer/Menu/Shop/Product/Global
Styles first and wait for a response)", stop here and report that back rather than investigating the design
yourself — that's what the Analyze step is for, and re-deriving it inline risks diverging from what actually got
written to disk. Otherwise, the
analysis above is self-sufficient: Analyze: {{scope}} already folded in whatever whole-site design-system tokens
existed at the time it ran, so there's no separate global plan to also inject and re-read here.

**This build is additive and non-destructive by design — it must never change anything already live on
{{wpSiteUrl}}.** The site above is a working site, not a blank build target: whatever this pass creates is a new,
separate artifact that sits alongside the live site until a human reviews and promotes it — never a replacement
applied in place. That constraint is spelled out per scope below; follow it exactly regardless of how tempting a
shortcut looks. **There are two exceptions: the "Global Styles" scope below** — by its nature it sets the site's
actual shared Kit values rather than creating a separate artifact, and its own section spells out the safety check
that makes that okay to do — **and the WooCommerce-system-page special case inside "Page" scope below** (matching a
design for the Cart/Checkout/My Account page), for a different reason spelled out in that section: a theme template
override file has no draft/publish state to sit inertly in, so building one takes effect immediately by
construction.

WordPress credentials: never reset, change, or create user accounts or passwords, under any circumstances. Check
whether a `wpcli` container already exists (`docker ps`, or a `wpcli` service in {{wpSiteDir}}/compose.yml) — if so,
use it directly: `docker exec wpcli wp <command> --path=/var/www/html --allow-root`. If none exists, install WP-CLI
some other way rather than falling back to a credential change. Any one-off PHP scripts belong in
{{wpSiteDir}}/scripts/, never inside `public-html/`.

**Don't install, activate, or update any plugin.** If matching the design genuinely needs one that isn't already
active on {{wpSiteUrl}}, stop and report exactly what's missing so the user can install it and re-run.

Before executing, make sure {{wpSiteUrl}} is reachable — start it the way the project expects (e.g.
`docker compose up`) if it isn't already running. Only start {{siteUrl}}'s own dev server if the analysis above
needs re-checking against it directly and it isn't already running; stop it again afterward if you do.

Track your progress through the steps below with the TodoWrite tool as you go, so progress is visible in the
dashboard.

---

## If {{scope}} is "Global Styles"

Unlike every other scope here, this one sets values on the site's **actual, shared** Elementor Kit — the Global
Colors/Fonts/Layout definitions any widget can link to. There's no separate "draft" version of a Kit to build in
isolation, and that's fine: a global slot's whole purpose is to be linked to and to carry the site's real value, so
anything already linked to one *should* pick up the real value once it's set — that's the intended effect of linking
to it, not a side effect to avoid. The safety net here is disclosure, not refusal: report exactly what's affected
(below), then proceed.

**Never set the Kit's Theme Style defaults (the H1–H6/body/button/link/form tabs under Site Settings → Theme
Style) — leave every one of them exactly as found, whatever that is.** This is a different risk profile from
Global Colors/Fonts below, not just a stricter version of the same rule: a Global Color/Font slot only affects a
widget that explicitly links to it (`__globals__`), so step 1's search for that literal string finds every single
thing that's exposed to a change there — genuinely additive, genuinely safe to disclose-and-proceed on. Theme Style
is the opposite: it's the *implicit fallback* for any heading/text/button that has **no** typography override of
its own, which has no link to search for and often isn't even the whole control — a heading customizing only
font-family and weight still silently inherits the Kit's font-size for its own tag from Theme Style, so a widget
that looks fully self-styled can still have a live, invisible dependency on it. Changing Theme Style therefore
risks visibly changing *every* existing heading/paragraph/button sitewide that was never touched by this build and
never linked to anything — discovered exactly this way once, on this project: a Global Styles pass changed the
Kit's H2 default size for a brand-new page's benefit, and an old, completely unrelated page's card titles — which
had only ever customized their own font-family and color — silently inherited the new, much larger size and broke,
with nothing in the disclosure step catching it because there was no link to find.
1. **Check for existing usage before writing, so nothing here is a surprise later.** Search every post's
   `_elementor_data` and `_elementor_page_settings` for the literal string `__globals__` (e.g. `wp db query "SELECT
   post_id FROM wp_postmeta WHERE meta_key IN ('_elementor_data','_elementor_page_settings') AND meta_value LIKE
   '%__globals__%'"`). For anything found, note which post/widget, which slot it links to, and its current resolved
   value vs. what this step is about to set that slot to — that list goes in the final report. Proceed regardless of
   what this finds; it's a disclosure step, not a gate.
2. Find the active Kit's post ID (`wp option get elementor_active_kit`) and read its `_elementor_page_settings`
   postmeta — this is a single associative array; every step below **merges into it** (read, modify only the
   specific keys involved, write back the whole array), never overwrites it wholesale, since it also holds every
   other Kit setting not part of this task.
3. **Global Colors:** set the four system-color slots (`system_colors`, matched by `_id` primary/secondary/text/
   accent) to the analysis's four mapped colors — always, regardless of step 1's findings; that's precisely what
   those four slots are for. Add every other color from the analysis as a **custom** swatch (`custom_colors`) with
   the given name — if a custom swatch with that same name already exists, update its value to match rather than
   adding a duplicate.
4. **Global Fonts:** same idea for `system_typography` (the four slots, always updated) and, if the analysis names
   any additional reusable text style, `custom_typography` (update-by-name-if-it-exists, same as colors). This is
   where a design's H1/H2/H3/body typography actually belongs — as a named, reusable Global Font each heading
   widget explicitly links to (Global Fonts are exactly as additive/opt-in-safe as Global Colors) — never as a
   Theme Style default.
5. **Layout:** set the Kit's content width to the analysis's measured value.
6. **Reusable button/text-link variants, via the Kit's own Custom CSS field — not a Global Class.** Elementor's
   "Global Classes" feature only applies to its newer Atomic widget set (`atomic-button`, `atomic-heading`, …) —
   {{builder}} builds here use the classic widgets (Heading, Button, Icon List, Accordion, Star Rating, …), which
   have no way to consume a Global Class at all, so don't attempt to create one. Instead, for every named button/
   text-link variant the analysis lists (e.g. a primary pill, a cream pill, an outline pill, an underlined text
   link), write one plain CSS rule per variant into the Kit's own **Custom CSS** setting (`custom_css`
   in the same `_elementor_page_settings` array — Site Settings → Custom CSS in the editor; a native Elementor field,
   not a code widget or a hand-written stylesheet file). Give each rule a clear class selector matching the
   variant's name (e.g. `.btn-cream`, `.btn-outline-teal`, `.text-link-underline`) and reference the Global Colors
   already set above by their generated CSS custom property (`var(--e-global-color-secondary)`, etc.) rather than
   repeating the literal hex — that keeps the rule tracking any future Global Color change automatically. **Every
   selector must be a brand-new class name, never Elementor's own built-in classes** (`.elementor-button`,
   `.elementor-widget-container`, or similar) — those already exist on every matching widget site-wide, old and
   new alike, so a rule against one of them changes already-live content the instant it's saved, with nothing in
   step 1's disclosure check (which only looks for `__globals__` links) to catch it. This applies to a shared
   micro-interaction too (e.g. a hover lift for the primary button) — give it its own opt-in class (e.g. `.btn-lift`)
   rather than hanging it off `.elementor-button:hover`, so nothing changes until a future build deliberately adds
   that class to a widget. Append to whatever Custom CSS already exists there rather than overwriting it; check for
   a rule with the same selector first so re-running this updates it in place instead of duplicating it. Document
   every class name and what it's for in the final report — later Header/Footer/Page Creates apply it via the
   widget's own native **Advanced →
   CSS Classes** field (a plain field every classic widget/container has) instead of re-styling the same variant
   from scratch on each occurrence.
7. **Verify it actually took effect** — a wrong control name saves silently with no visible error. After saving,
   confirm `{{wpSiteDir}}/public-html/wp-content/uploads/elementor/css/post-<kit-id>.css` actually contains the new
   values (the color variables, the content-width rule, and the step 6 custom CSS rules). Regenerate this file if
   it's stale (`wp elementor flush_css` if available, or clear `_elementor_css`/relevant Elementor cache options and
   reload the front end once to force regeneration) rather than trusting the saved postmeta alone. Purge any
   object/page cache (e.g. LiteSpeed) afterward so the change is actually visible. Also confirm the Kit's *Theme
   Style* values are still whatever they were before this step ran — nothing above should have touched them.

From this point on, later Header/Footer/Page Creates should **link every heading/text/button widget's color and
font-family to these Kit slots** (via {{builder}}'s Global Colors/Fonts picker) wherever the analysis says a value
repeats — that part is exactly as safe and reusable as before. But because Theme Style is deliberately never set,
**every such widget also needs its own explicit font-size, weight, and line-height — never leave those unset
expecting a Kit default to supply them**, since none will (Elementor's own built-in fallback, or whatever the
theme's own base styling happens to be, applies instead — not this design's intended size). This also means a page
built this way no longer depends on the Kit's Theme Style at all, which is what makes it safe to export via SE Page
Transfer without needing the destination's Kit to match.

## If {{scope}} is "Page"

**New page title:** {{newPageName}}
**Design page matched (path on {{siteUrl}}):** {{designPagePath}}
**New page slug (optional — overrides WordPress's auto-slug from the title):** {{newPageSlug}}

If either of the first two lines above is blank, stop and report back asking for it to be filled in (Settings →
Site → Page for the design path, Settings → WP site → Page for the title) rather than guessing. The slug line being
blank is expected and fine — just let WordPress derive it from the title as usual.

### Check this first: is {{designPagePath}} actually a WooCommerce system page (Cart / Checkout / My Account)?

Compare the matched design page's identity (title, URL, content — "your cart is empty," a checkout form, an
account dashboard) against this site's real system pages: `wp option get woocommerce_cart_page_id` /
`woocommerce_checkout_page_id` / `woocommerce_myaccount_page_id`, then `wp post list --post__in=<that ID>
--field=post_name`. **If it matches, stop — do not follow the rest of this "Page" scope section.** Building a
standalone draft page for it (the normal flow below) produces a disconnected preview that never reaches a real
visitor: WooCommerce's cart/checkout/account pages are driven by live functional templates (line items, quantity
updates, coupon codes, payment forms, account data), not static content a draft page could hold. Follow this
section instead.

**This is a deliberate, documented exception to this file's own non-destructive-by-default rule** (see the intro
above) — the same kind of exception "Global Styles" already is, and for the same underlying reason: some things
genuinely can't be built as an inert, separately-promoted artifact, because the platform gives them no "draft"
concept. A theme template override file is either present (and immediately live for every real visitor) or absent
— there's no post-style draft/publish status for it. Because this takes effect immediately for real visitors, do it
with real care, and say so plainly in the final report (name exactly what changed, and that it is already live) —
never describe it as a preview.

Two genuinely different sub-cases here, handled differently:

1. **A state with no dynamic content at all.** WooCommerce's empty-cart message is the clearest example — when the
   cart has zero items there's no line-item data or user-specific state to preserve, just a static message. These
   are safe to **fully override** with a real theme template file (e.g. `<child-theme>/woocommerce/cart/
   cart-empty.php` — copy the installed WooCommerce version's own template as the starting point, `wp plugin list
   --name=woocommerce --field=version` then copy from that plugin's own `templates/` directory, rather than
   guessing at the hook structure) reproducing the matched design's copy/layout/typography with this site's Global
   Colors/Fonts — same native-first philosophy as the rest of this file, just in plain PHP/HTML since there's no
   Elementor page to build in here.

2. **A state with real, live, user-specific or interactive content** — a populated cart's line items and quantity
   inputs, checkout's payment form, an account dashboard's order history. **Never replace WooCommerce's own
   template wholesale for these.** The real functional markup (AJAX-wired quantity inputs, remove links, coupon
   form, payment-gateway fields, nonce-protected forms) has to keep working exactly as WooCommerce built it —
   rebuilding it as static content to match a screenshot would look right and be functionally broken (no real cart
   updates, no real checkout). Instead **restyle the real rendered output**, the same way this project's own
   Shop-card, quantity-stepper, and single-product buy-box were built: keep WooCommerce's stock template/hooks
   doing the real work, and add CSS — plus, only where a hook genuinely can't expose something CSS alone can't
   reach, a light template override that still calls through to WooCommerce's real functions/hooks rather than
   hardcoding output — that makes the real markup match the design. This CSS is **site-wide, not page-scoped**: add
   it via the Kit's Custom CSS (if broadly reusable) or this project's own designated site-specific-code plugin
   (check `project-common.md` for which plugin that is on this install) rather than a per-page Elementor setting,
   since there's no Elementor page here to attach per-element Custom CSS to. Verify by actually reaching that live
   state — add a real product to the cart, change a quantity, remove an item, submit whatever form exists — and
   confirming it now matches the design **and still functions**, not just that an empty/default screenshot looks
   right.

Report exactly which files were added or changed and confirm each is already live (not a draft) — this is the one
"Page" scope case where "leave it as a draft" (the generic instruction later in this section) does not apply,
because no draft state exists for a template file.

### Otherwise — a genuine standalone/custom page, not a WooCommerce system page

- **Template:** {{pageTemplateInstruction}}
- **Don't rebuild the header or footer's *content* on this page either, even if the analysis lists them as part of
  the page's own top-to-bottom structure.** A single-page reference design has no separate concept of "site chrome"
  vs. "page content" — its header and footer are just the first and last blocks of one continuous page — but on a
  real multi-page WordPress site they become the separate, reusable Header/Footer artifacts (their own Analyze/
  Create scopes), shown across every page once assigned. Duplicating that same content here would render it twice
  once a real Header/Footer template exists. Start the page at whatever section comes right after the header (the
  hero, typically) and end it at the last real content section (before the footer starts) — skip the header/footer
  blocks themselves entirely, not just the surrounding theme template.
- **Check for an existing draft with this exact title first** (`wp post list --post_type=page --title="{{newPageName}}" --field=ID`). If one exists, **update it in place, not delete-and-recreate** — replace its `_elementor_data` wholesale (it's one JSON blob for the whole element tree, so overwriting it already gives a genuinely clean rebuild, not a partial patch) rather than creating a second page with the same or a deduplicated-suffix title. Deleting and recreating instead would orphan any media already uploaded as a child of the old page, and leaves nothing recoverable if the rebuild fails partway — updating in place keeps the old content until the new content fully replaces it. Also clear/reset any *other* Elementor postmeta the first build left on that page (e.g. `_elementor_page_settings` per-page overrides) that the new build doesn't itself set, so nothing stray from the previous version lingers. This matters most when re-running Create after a "Global Styles" pass: the point is for the *same* page to pick up the new Kit links/Custom CSS classes, not to leave the old, literal-values version sitting alongside a new duplicate. Only create a genuinely new page if no matching draft exists yet.
- Build/rebuild the page on {{wpSiteUrl}} titled {{newPageName}}, matching the analysis exactly — layout, spacing,
  colors, copy, and any interactive elements (forms, sliders, accordions) styled to match this site's existing
  conventions for that widget type.
- **If a slug was given above, set it explicitly** (`wp post update <ID> --post_name=<slug>`) rather than leaving
  WordPress's title-derived one in place — this is what lets Review Page and other page-scoped passes find the page
  by a known URL later. Leave it alone (don't touch `post_name`) if the slug line was blank.
- **One Elementor Section/Container per design section**, matching the page's own visual segmentation — not one
  flat section holding everything.
- **Build with native {{builder}} elements, not code.** Every piece of content goes into a real widget — never an
  HTML/Custom-Code widget or a raw pasted `<style>` block. {{selfStylesInstruction}} Use the Media Library (upload
  whatever the analysis lists) through the widget's own image/background control. {{webpInstruction}} Reach for a
  per-element Custom CSS
  field only for a value genuinely not exposed by any native control, and say which value and why in the final
  report. **Never use a `>` child combinator in a Custom CSS field (Kit-level or per-element) — it gets HTML-entity-
  encoded to `&gt;` somewhere in Elementor's output pipeline, silently turning the whole rule into invalid CSS the
  browser ignores.** This is easy to miss because nothing errors — the rule just never applies, and the affected
  element quietly falls back to its unstyled/native size (a background-and-radius control that targets a widget's
  inner `.elementor-widget-container` div, for instance, ends up with no explicit width, sized to its own content
  instead of the outer wrapper — a 42×42 circle rendering as a narrow tall oval is exactly this failure). Use a
  plain descendant selector (a space) instead of `>` wherever the child relationship doesn't need to be that
  strict — it survives the encoding untouched, and Elementor scopes `selector` narrowly enough that a space usually
  matches just as precisely as a true child combinator would.
- If the page's own content includes a logo (only relevant when it stands alone with no theme header, i.e. Canvas
  is on), make sure it links to the homepage ("/").
- **Don't change the site's front-page setting or main navigation.** Leave Settings → Reading's front-page choice
  and every nav menu exactly as they are — promoting a staging page (or linking it into nav) is the user's call.
- Leave the page as a **draft**.
- Verify: screenshot the page at mobile/tablet/desktop and compare side-by-side against the analysis's screenshots.
  Submit any form for real to confirm it functions.
- When comparing typography specifically, don't rely on eyeballing glyphs in the screenshot — this environment's
  headless Chromium may substitute a metric-compatible clone for Arial/Helvetica (e.g. Liberation Sans, Nimbus Sans)
  if the real fonts aren't installed, so a correct `font-family` declaration can still render visually differently
  from the reference. Confirm with `getComputedStyle(el).fontFamily` against the intended value instead.

## If {{scope}} is "Header"

- If {{builder}} is Elementor: create a **new** Theme Builder header template (`elementor_library` post,
  `_elementor_template_type` = `header`) — `wp post create --post_type=elementor_library --post_title="Header — Design Preview" --post_status=draft`, then build its content to match the analysis (logo, nav with the exact link types
  listed, CTA button) using native widgets, not code. {{selfStylesInstruction}} {{webpInstruction}}
- **Never assign it a Display Condition, and never publish it as active.** Leave it as an unpublished/draft
  template with no conditions set — the live site's current header must render completely unaffected, on every
  page, exactly as it does now. This is the whole point of building it here rather than editing the active header
  directly.
- If {{builder}} is Gutenberg and the active theme is a block theme, create a new, unused header template part
  instead (not the one assigned to any template) — same non-assignment rule applies. If the theme has no header
  template-part concept, stop and report that rather than editing the live header.
- Verify by opening the new template directly in Elementor's own preview/edit view (its `post=<id>&action=elementor`
  edit URL) — not the live site — and confirm it matches the analysis's screenshots there.

## If {{scope}} is "Footer"

Same approach as Header, for the footer: a new, unassigned/unpublished Theme Builder footer template
(`_elementor_template_type` = `footer`, title "Footer — Design Preview"), built to match the analysis, never given
a Display Condition or published as active, verified in its own edit view rather than on the live site.
{{selfStylesInstruction}} {{webpInstruction}}

## If {{scope}} is "Menu"

- Create (or, if it already exists from a prior run, update in place rather than duplicating) a WordPress menu
  named **"Design Preview — Menu"** (`wp menu create` / `wp menu item add-*` commands), populated with the design's
  nav items and link types exactly as the analysis lists them.
- **Never assign it to a theme location** (`wp menu location assign`) — it must not affect what renders anywhere on
  the live site. It exists purely for review: open Appearance → Menus in wp-admin to see it.
- Don't touch any existing live menu (adding, removing, or reordering its items) even where the analysis notes a
  divergence — that reconciliation is the open question the analysis flagged for the user, not something to resolve
  here.

## If {{scope}} is "Shop"

**First, determine the design's actual shape from the analysis, since the right native building block depends on
it — don't default to one without checking:**

- **A single flat, filterable/paginated grid** (the standard "shop archive" shape): use Elementor Pro's **Archive
  Products** widget (query source "Current Query", so it's driven by whatever category/search actually loaded the
  archive), built as a Theme Builder "Products Archive" template (`elementor_library` post,
  `_elementor_template_type` = `product-archive` — `wp post create --post_type=elementor_library --post_title="Products Archive — Design Preview" --post_status=draft`, then set that meta). This is the reusable form — it
  applies to every category/tag/search archive URL, not just one curated page.
- **A curated, category-grouped landing composition** (repeating sections, each with its own heading/description
  and its own product grid for one category — confirmed on this project via Analyze: Shop, §0/§7): this is
  **not** what a "Products Archive" Theme Builder template is for — that template type applies uniformly to every
  possible archive URL, and can't natively express "N independently-styled sections stacked on one specific page."
  Build it instead as regular Elementor content directly on the site's existing WooCommerce Shop page (find its ID
  via `wp option get woocommerce_shop_page_id`; if that page's own content is genuinely empty, as a "Design
  Preview" copy of it left as a **draft**, never overwriting the live page's content in place) or a new draft Page,
  using Elementor Pro's **Loop Grid widget in its Taxonomy query mode** (the "Product Taxonomy" source, backed by
  `product_cat`) for the repeating category sections — **not** a hand-placed widget per category. Set its "Filter
  By" to "Show All" so every current and future WooCommerce product category is included automatically with no
  further editing (or "Manual Selection" only if the analysis/user explicitly wants a curated, ordered subset
  rather than every category) — this is what makes the section list actually maintainable as categories are added
  or removed later, instead of a fixed set of hardcoded sections. Build the section heading/description/number-
  badge inside the Loop Item template (a separate Elementor sub-document this widget generates/uses — same editing
  model as a Loop Grid over posts, just sourced from terms instead) using that term's own dynamic
  data (name, description, count). For the nested per-category product grid inside that same Loop Item: check
  whether a second widget's (Archive Products/Products) taxonomy-filter control accepts a Dynamic Tag, and whether
  one is available there that resolves to "the current loop's term" — if so, bind it that way so each section's
  grid is genuinely driven by its own loop iteration; if no such dynamic tag is exposed in this Elementor Pro
  version, report that gap explicitly rather than silently faking it with a hardcoded per-section category filter
  (which would reintroduce the exact maintenance problem this approach exists to avoid).
  {{selfStylesInstruction}} {{webpInstruction}}

**Regardless of which shape applies:**

- **Never build a product grid from static or manually-picked content.** Every card shown has to come from the
  real catalog via the widget's own query — a fixed set of hand-picked products (or literal text/images copied
  from the reference design's example cards) would show the same handful of items regardless of which category or
  search a shopper actually loaded, defeating the entire point of a dynamic listing.
- Match the analysis's card anatomy (image, badge, title, price, rating, add-to-cart) through the widget's own
  per-card style controls, not by rebuilding a custom card in a Container around dynamic tags — these widgets
  already support per-card styling natively and come with a real, sortable/paginated query for free. Reach for
  per-element Custom CSS only for a value genuinely not exposed by any native control.
- If the analysis found no empty/no-results state in the reference, design a reasonable one consistent with the
  rest of the page's style (WooCommerce's own "No products were found" notice, restyled to match) rather than
  leaving the widget's unstyled default in place — note this explicitly in the final report as a gap the design
  itself didn't specify.
- **Never assign a Display Condition to a new Theme Builder template, and never publish it as active; never modify
  the live Shop page's own content in place if building on a copy of it instead.** The live Shop page must keep
  rendering completely unaffected, exactly as it does now. This is the whole point of building here rather than
  editing whatever's currently live.
- If {{builder}} is Gutenberg: the WooCommerce Blocks equivalents (`Product Collection`/`All Products`, one per
  category for the curated-landing shape) are the building blocks to use; same non-assignment/non-destructive rule
  applies. If neither the theme nor WooCommerce Blocks makes the design's actual shape achievable, stop and report
  that rather than approximating it with hardcoded content.
- Verify by opening the new template/page's own edit view (its `post=<id>&action=elementor` edit URL) — not the
  live site. Confirm the preview actually shows real catalog products across however many categories currently
  exist (correct counts, real prices/images), not an empty or placeholder grid, before comparing it against the
  analysis's screenshots. For the Taxonomy Loop Grid shape specifically, also verify by adding or removing a test
  product category in WooCommerce and reloading the preview — a genuinely dynamic build shows the change with no
  further editing; if it doesn't, the "Show All"/dynamic-term wiring above didn't actually take.

## If {{scope}} is "Product"

- If {{builder}} is Elementor: create a **new** Theme Builder "Single Product" template (`elementor_library` post,
  `_elementor_template_type` = `product`) — `wp post create --post_type=elementor_library --post_title="Single Product — Design Preview" --post_status=draft`, then set that meta, then build its content to match the analysis
  using Elementor Pro's native WooCommerce widget category: **Product Images** (gallery), **Product Title**,
  **Product Price**, **Product Rating**, **Short Description**, **Add To Cart** (or **Custom Add To Cart** for
  further styling), **Product Meta** (SKU/categories), **Product Data Tabs**, and **Product Related** (or
  **Upsells**) for the bottom carousel/grid — matched to whichever of these the analysis actually documents, not
  every one by default. {{selfStylesInstruction}} {{webpInstruction}}
- **Never hardcode any product's own data** (its title, price, images, description, stock, SKU, reviews). Every one
  of these widgets renders dynamically from whichever product is actually being viewed — typing a value in
  literally would show the exact same text/image on every product this template applies to, defeating the point of
  a shared single-product template. The only content that should genuinely be fixed here is shared chrome the
  analysis calls out as constant across every product (a trust-badge row, a shared shipping-info blurb) — everything
  else comes from the dynamic widgets.
- Match the analysis's variant/attribute-selector styling through the Add To Cart widget's own style controls where
  possible; a swatch-style selector (colors/images instead of a plain dropdown) may need Custom CSS layered on top
  of WooCommerce's own generated markup — check what the widget's controls already expose before reaching for
  Custom CSS.
- **Never assign it a Display Condition, and never publish it as active.** Leave it unpublished/draft with no
  conditions — the live product pages must keep rendering completely unaffected, exactly as they do now.
- If {{builder}} is Gutenberg: the WooCommerce Single Product block (and its inner Product Image
  Gallery/Title/Price/Add to Cart/Product Details blocks) is the equivalent; same non-assignment rule applies. If
  unavailable, stop and report rather than approximating with hardcoded content.
- Verify by opening the new template's own edit view — not the live site. Elementor Pro lets you pick a specific
  real product to preview a Single Product template against (its own product-selector control in the editor, not a
  random/blank one); pick a real product from the catalog and confirm the dynamic fields actually populate (real
  title, real price, real gallery images) rather than placeholder/blank output, before comparing against the
  analysis's screenshots.

---

## Baseline quality bar (Page/Header/Footer/Shop/Product scopes)

- **Build mobile-first: set and verify each element's mobile appearance as part of building that element, not as a
  separate check bolted on after the whole page is done at desktop width.** This doesn't change how Elementor's
  responsive controls actually work — a control's base "Desktop" value still cascades down to every width via
  `max-width` media queries unless a Tablet/Mobile override exists; that's the platform's own mechanism, not
  something to fight or route around with hand-written CSS. What changes is the order of attention and what a
  missing override means: confirm each section against the reference's mobile screenshot/computed styles *first*,
  then add whatever Tablet/Desktop overrides the wider widths genuinely need — so a heading built with no Mobile
  override is a deliberately verified match at that width, not an unchecked gap nobody looked at yet. Under the
  opposite order (build desktop fully, then skim mobile at the end), that same unset override is ambiguous, and in
  practice tends to mean "nobody checked" far more often than "genuinely identical."
- **Multi-column rows are the highest-risk spot regardless of order.** A build that looks
  right at desktop width can still have real, structural problems that only show up narrow: a decorative background
  element sized for desktop (e.g. a large blurred blob) causing horizontal page overflow because nothing clips it
  (the reference likely sets `overflow: hidden` on that section — check for it rather than assuming), a multi-column
  row that was given a mobile width override of `100%` (collapsing it to one column) when the reference actually
  keeps 2 or 3 columns even on mobile just at a narrower per-column width, or a heading/hero element with no mobile
  typography override at all so it renders at its full desktop size (overflowing or failing to wrap the way the
  reference's — deliberately smaller — mobile font-size does). None of these show up by eyeballing desktop
  screenshots. Load the page at a real mobile viewport width (e.g. 390px) and check: (1) `document.documentElement.
  scrollWidth` equals the viewport width (no horizontal overflow), (2) every multi-column row that should stay
  multi-column on mobile actually renders that way (`getBoundingClientRect()` on its children — same `top` for
  items meant to share a row is the tell that they collapsed to one column instead), (3) large headings actually
  use the reference's mobile font-size, not the desktop one scaled by nothing. If a specific row's items collapse to
  one-per-line despite `flex-wrap: wrap` and correctly-computed percentage widths that clearly fit (verify this with
  the browser's actual computed styles, not just the saved settings) and forcing every relevant flex property via
  `!important` still doesn't fix it, that's a sign of a genuine layout anomaly rather than a simple setting mistake
  — switching that specific row to `display: grid` with explicit `grid-template-columns` is a reliable, deterministic
  workaround that doesn't require first understanding why flex misbehaved there.
- **Heading hierarchy is sound** on whatever was built: no skipped levels, and for a full Page, exactly one `<h1>`.
- **Images have appropriate `alt`**: meaningful text on content images, `alt=""` on decorative ones.
- **Every form input has a programmatic label** (Page scope, if the page has a form) — a real `<label>`, not just a
  `placeholder`.
- **No content lives only in a code widget or hand-written stylesheet** — spot-check the saved data (e.g.
  `_elementor_data`) for any HTML/Custom-Code widget and justify each one found.
- **Every `<p>` tag inside a text-editor widget has its margin reset** (`style="margin:0"`, or wrap the content in a
  non-`<p>` element instead). The browser's own default `<p>` margin (~1em top/bottom) is easy to leave in place
  since nothing here resets it automatically, and it silently stacks with whatever spacing was actually intended
  between elements — inflating every section's real height without any single value looking wrong on its own. This
  is a page-wide check, not per-widget: spot-check the saved `_elementor_data` for every `text-editor` widget's
  `editor` HTML, not just the one you're currently working on.
- **A flex row's column widths must leave room for its own gap.** In a real flexbox layout (which Elementor
  Containers use), `gap` is *additional* space on top of each item's width — it is not automatically subtracted
  from percentage widths the way it would be in CSS Grid. Two columns set to widths that sum to 100% (or close to
  it) plus any nonzero `gap` will overflow the row by that gap's amount — with `flex-wrap: wrap` set (Elementor's
  own default on most rows, for responsive stacking), this silently wraps the second column onto its own line
  instead of erroring, so it can look correct in the saved settings and still render broken. When converting a
  design's measured pixel column widths to percentages, divide each by the *row's total width*, not by
  `(total width − gap)` — e.g. for a 1180px row with a 70px gap and measured columns of 516px/594px, the correct
  widths are `516/1180 = 43.7%` and `594/1180 = 50.3%` (leaving the remaining ≈5.9% for the gap), not `516/1110`
  and `594/1110` (which would sum to 100% before the gap is even added, guaranteeing an overflow). Even that
  correct-on-paper split (summing with the gap to *exactly* 100.0%) can still wrap — sub-pixel rounding when the
  browser converts percentages to real pixels can push the computed total fractionally over the container's actual
  width, which is enough to trigger the wrap despite the math looking exact. Leave a genuine safety margin (target
  the two columns' combined percentage a point or so under what the gap math implies, keeping their ratio to each
  other the same), not a value that only works if rounding happens to go your way. Verify by checking the
  actually-rendered layout stays side-by-side at desktop width, not just that the saved percentages
  look individually plausible.
- **A Container's "Content Width: Boxed" setting does nothing on its own — it needs an explicit `boxed_width`
  value too.** Setting `content_width: "boxed"` alone (the default when a container is created) generates no
  max-width CSS at all: Elementor's boxed-width CSS variable (`--content-width`, consumed by the container's
  `.e-con-inner` child) is emitted only from the container's own `boxed_width` control
  (`{{WRAPPER}} → --content-width: {{SIZE}}{{UNIT}}`), and that control has no real default — the Kit's global
  Container Width value (e.g. 1180px) only appears as a greyed-out *placeholder* in the Elementor editor UI, it is
  never actually applied unless `boxed_width` is explicitly set on that element. Skip it and the container silently
  renders at the *full* width of its parent instead of the intended boxed column — every other measurement (column
  splits, gaps, paddings) can be exactly right and it will still look wrong, because the whole row is simply wider
  than it should be. Whenever a container is set to `content_width: "boxed"`, always also set
  `boxed_width: {"unit": "px", "size": <kit's container width, e.g. 1180>}` on that same element. Verify by
  measuring the rendered `.e-con-inner` child's `getBoundingClientRect()` (not the outer `.elementor-element`,
  which stays full-width by design) against the reference's equivalent boxed wrapper at the same viewport width —
  not just checking that `boxed_width` looks set in the saved settings.
- **A Container with no `padding` setting at all is not the same as one with zero padding.** Elementor gives every
  new container a default padding (commonly `10px` on all sides) whenever the `padding` key is simply absent —
  there's no "unset = 0" behavior. Whenever a container is meant to have no padding, set it explicitly
  (`{"unit":"px","top":"0","right":"0","bottom":"0","left":"0","isLinked":true}`) rather than omitting the key.
  Verify with `getComputedStyle(el).padding` on the actual element.
- **Margin (the `_margin` Advanced-tab control) applies to `.elementor-widget-container`, not the outer
  `.elementor-element` wrapper or the widget's own inner tag** (e.g. not directly to an `<h3>`/`<p>` inside a
  heading/text widget) — same pattern as the background/border-radius gotcha above. Querying `getComputedStyle()`
  on the inner tag itself will show no margin even when it's set and working correctly; check the
  `.elementor-widget-container` div, or just measure the visual gap between elements, before concluding a margin
  setting failed.
- **A Button widget's icon and its text can't be independently positioned within it** (e.g. label pinned left,
  icon pushed to the far right via `justify-content: space-between`) — Elementor renders both inside one shared
  inner span (or the icon as literal text next to the label), so flex/justify-content applied to the button has
  only one child to distribute and does nothing. When a design needs that "label ↔ icon" spread-apart pattern
  (common on card "Learn more" links), build it as a **Container** instead: `flex_direction: row`,
  `flex_justify_content: "space-between"`, two child widgets (label, icon/glyph), and the container's own `link`
  setting for the destination — **which also needs `html_tag: "a"` set explicitly**, since without it Elementor
  writes the `href`/`target` onto whatever tag `html_tag` defaults to (a plain `div`), producing an unclickable,
  non-semantic element instead of a real link. Verify the rendered tag is actually `<a href="...">`. Three more
  things that same Container needs, each independently easy to miss:
  - **Its CSS-Classes setting is `css_classes` (no leading underscore) — not `_css_classes`, the convention every
    *widget* uses.** Setting the widget-style key on a Container saves without error but is silently never read;
    the class never reaches the rendered element (verify by checking the actual `class=""` attribute in the served
    HTML, not just that the setting saved).
  - **A Container's width, left unset, is not "hug its content" the way it might look from the editor — every
    Container inherits `width: 100%` from Elementor's own base `.e-con` class by default**, so a button-shaped
    Container meant to size to its own label+icon (not stretch to fill its row) needs an explicit
    `width: fit-content` Custom CSS, since the width *control* itself has no "auto"/"fit-content" unit option to pick
    from the slider. Write it plain first (`selector{width:fit-content;}`), without `!important` — the compiled
    per-element selector (`.elementor-<kit-id> .elementor-element.elementor-element-<id>`) is already more specific
    than Elementor's own `.e-con{width:var(--width)}` base rule, so it normally wins on its own. Add `!important`
    only if checking `getComputedStyle()` afterward shows the base rule still won (see the general note after this
    sub-list, which covers this same pattern). Confirmed the hard way: leaving width unset rendered a "Start your
    evaluation →" pill over 500px wide (its row's full available width) instead of hugging its ~230px of content.
  - **A heading widget dropped inside with no explicit color still isn't "inherit the parent link's color"** — a
    fresh Heading widget carries its own default `title_color` link (observed pointing at the Kit's `primary`
    Global Color), which sits more specific than simple inheritance from the surrounding `<a>` and silently wins
    even when the link itself has the intended color set correctly. Set `title_color` (or a `__globals__` link)
    explicitly on every child heading in this pattern — don't rely on it picking up the parent's color.
- **Default to writing per-element Custom CSS layout properties (`width`, `flex`, `position`, `display`,
  `text-align`, `margin`) without `!important`, then verify — don't add it reflexively.** A per-element Custom CSS
  rule compiles to `.elementor-<kit-id> .elementor-element.elementor-element-<id>{...}`, specificity `(0,4,0)`,
  which already beats Elementor's own layout-variable base rules (`.e-con{width:var(--width)}`,
  `.elementor-element{flex-grow:var(--flex-grow)}`, `.e-con{display:var(--display)}`, etc., all specificity
  `(0,1,0)`–`(0,3,0)`) without needing `!important` at all. A dedicated site-wide `!important` review (CDP-verified
  against the actual matched CSSOM rules, not a guess) found dozens of these exact declarations across a header,
  footer, homepage, and shop archive built during earlier passes — every one reflexive, none actually necessary; the
  plain selector was already winning in every single case checked. Write the property plain, load the page, confirm
  `getComputedStyle()` shows the intended value; only reach for `!important` if it doesn't. This default doesn't
  apply to the other, genuinely-necessary `!important` cases documented elsewhere in this file (the Nav Menu item,
  Heading-widget-anchor, and Button-widget gotchas below) — those beat Elementor's own *per-item generated*
  typography/color CSS, which really can out-specify a plain rule, unlike the shared low-specificity layout base
  rules this note is about.
- **When a reference's internal spacing between a widget's children is irregular** (e.g. 46px above a title, 18px
  below it, 18px above the next element — not one repeating value), it's being done with per-element margins, not
  a single `flex_gap` on the parent. A uniform `flex_gap` can only reproduce uniform spacing; forcing irregular
  reference spacing into one gap value gets every gap slightly wrong. Set the parent's `flex_gap` to `0` and give
  each child its own explicit `_margin` matching the reference's actual measured values instead.
- **Don't assume which technique a reference uses for a visual effect — checking the reference's own generated CSS
  rules directly (via the browser's stylesheet objects, not just one element's computed style) is fast and
  removes the guesswork.** Different designs achieve the same-looking result (grid dividers, hover states, spacing
  rhythms, etc.) via different underlying mechanisms — the same visual pattern could just as easily be a `gap` with
  a background color as it could be per-cell borders — so match what the reference's own CSS actually declares
  rather than picking a plausible-looking default.
- **An Icon List widget's icon (`selected_icon`) lives on each repeater item, not the widget's own settings.**
  Setting it once at the top level (`settings.selected_icon`) saves without error and looks identical to the
  correct shape in a settings dump, but is silently never read at render time — every item keeps rendering
  Elementor's own default icon (a checkmark) regardless. The fix has to be applied inside each entry of
  `settings.icon_list[]` individually (`icon_list[i].selected_icon`). Verify by looking at the actual rendered
  glyph, not the saved setting.
- **A gradient simplified from the reference's real stop count (e.g. 3 stops down to 2, dropping a neutral middle
  stop) is not "close enough" without checking — it changes the visible color balance more than it looks like it
  should on paper.** A straight 2-color blend puts noticeably more of the second color's influence across the
  middle of the element than a 3-stop gradient with a light/neutral stop at 50% does (the middle stop holds each
  end's color concentrated near its own edge instead of blending immediately) — confirmed the hard way: a
  warm-to-mint hero simplified to 2 stops rendered as a nearly uniform mint wash, with the intended warm zone
  reduced to a thin strip at the very edge, even though the two endpoint colors matched the reference exactly.
  Elementor's native gradient control only supports 2 stops; matching a reference's real 3+-stop gradient needs a
  literal `background` override in Custom CSS (gradients can't be Global-Color-linked either way). Compare a
  rendered screenshot against the reference at the same crop/scale before accepting a stop-count simplification as
  visually equivalent — don't just compare the two endpoint hex values.
- **A decorative, CSS-only background shape (a translucent ring, blob, or orb with no text and no real content) is
  cheap to reproduce and easy to wrongly write off as "low impact, skip it."** It's usually just a couple of
  `::before`/`::after` pseudo-elements (or one extra empty Container) with a border or low-alpha fill — a few
  minutes of work, not a redesign — and, being large and often positioned behind the hero's headline, its absence
  is visually obvious even though it carries no content. Reproduce it rather than noting it as a gap by default;
  measure its real position/size/colors directly off the reference (`getComputedStyle` on the element *and* its
  `::before`/`::after`, not just the element itself) rather than approximating by eye, and give its containing
  section `overflow: hidden` if the shape intentionally bleeds past its own edge (check the reference for this
  rather than assuming) so it doesn't cause horizontal page overflow.
- **A pattern cloned from an already-built sibling page (a faster starting point than building from scratch) can
  silently carry that sibling's own unfixed mistakes forward** — cloning copies whatever the source actually has,
  correct or not, and a visual match to the sibling is not the same as a match to the reference. When reusing a
  sibling's widget tree for a shared component (a repeated card pattern, a hero layout), re-verify that shared
  part against the reference directly at least once (colors via `getComputedStyle`, not eyeballing two similar dark
  tones apart), rather than trusting that because it already shipped once, it must have been checked thoroughly
  enough the first time.
- **A Heading widget's Custom CSS needs `selector .elementor-heading-title{...}`, not bare `selector{...}`, for any
  text-level property (font, color, etc.).** The widget's actual text sits inside a nested `.elementor-heading-title`
  element that carries its own explicit font-family (and other) declarations from the widget's native typography
  controls — that inner element's own direct rule wins for itself regardless of `!important` on the outer wrapper,
  since `!important` on an ancestor doesn't propagate as `!important` into a child's own separately-declared rule for
  the same property; inheritance only applies when nothing targets the child directly. Confirmed the hard way: a
  `selector{font-family:...!important}` override on a Heading widget saved and generated real CSS, but silently
  never rendered — the inner `.elementor-heading-title` element's own (non-important, more specific) font-family
  rule kept winning. Verify with `getComputedStyle()` on the actual rendered text node, not just that the rule
  appears in the generated CSS.
- **Elementor Pro's Nav Menu widget doesn't render a WordPress menu item's own CSS Classes onto the `<a>` it
  generates** — it rebuilds the anchor's `class` attribute from scratch (its own `handle_link_classes()` filter
  only ever adds `elementor-item` plus a couple of state classes), so a custom class added to make one nav item
  look different from the rest (e.g. a colored pill for a commerce link sitting among plain text links) silently
  has no visible effect even though it saves correctly and does appear — on the `<li>` wrapper, not the link
  itself. Target it as a descendant selector instead (`.your-class a{...}`), not a bare rule
  (`.your-class{...}`) — and give every property `!important`, since Elementor's own generated per-item
  typography/color rules are otherwise more specific. Verify with `getComputedStyle()` on the actual `<a>`, not
  just that the class appears in the rendered HTML at all (it will, on the `<li>`, even when nothing changed
  visually).
- **A Button widget's `_css_classes` (Advanced → CSS Classes) lands on the outer `.elementor-element` wrapper
  `<div>`, not the inner `.elementor-button` link that's actually visible** — the same "which element really gets
  it" trap as the Heading widget (`.elementor-heading-title`) and the Nav Menu widget (`<li>` vs `<a>`) gotchas
  above, just for a third widget type. A Kit Custom CSS class meant to restyle a button (background, padding,
  radius, etc.) needs to target `.your-class .elementor-button` (descendant), not bare `.your-class{...}` — the
  bare form saves without error, the class genuinely appears in the rendered HTML (on the wrapper), and still
  visibly does nothing, since the wrapper carries no visual styling of its own. If a class needs to work in more
  than one place (a menu item today, a Button widget tomorrow), write all the relevant descendant forms into the
  same rule (comma-separated) rather than assuming the render mechanics are the same everywhere it might get
  reused.
- **A Kit/Global CSS class meant for a Button widget's inner link needs to be written tag-qualified or as a
  descendant selector, never bare.** `_css_classes` lands on the *outer* `.elementor-element` wrapper `<div>` (see
  the gotcha above); a bare `.your-class{padding:...}` rule matches that wrapper too, not just the inner
  `.elementor-button` reached via `.your-class .elementor-button{...}`, so the wrapper ends up with its own copy
  of the same padding/radius/font stacked on top of the already-correctly-sized inner button — the widget visibly
  renders right, but its actual clickable/hoverable footprint is much larger than what's drawn (confirmed the hard
  way: a 38px-tall pill sitting inside a 56px-tall wrapper, 18px of invisible excess on each axis). Two safe forms:
  qualify by tag (`a.your-class{...}`, matches only if the class is actually on an `<a>`) or use a descendant
  selector (`.your-class .elementor-button{...}`) — never a bare `.your-class{...}` for a class that might land on
  a wrapper element. Verify by measuring the *wrapper's* `getBoundingClientRect()`, not just the visible inner
  button's — a bug like this is invisible in a screenshot and only shows up by measuring the actual click target.
- **Only a *boxed* Container gets an `.e-con-inner` child — a full-width Container doesn't have one at all.**
  Custom CSS written for a full-width Container's own CSS Grid/Flex layout (e.g. `selector .e-con-inner{display:
  grid;...}`) silently matches nothing there, so the columns just stack in document order with no visible error.
  Target `selector` itself (the `.e-con`) for a full-width container's own layout; `.e-con-inner` only exists to
  target when that specific container is `content_width: boxed`.
- **A Heading widget set to link out (its own Link control, not a wrapping Container) still gets Elementor's base
  `a{font:...}` default on the anchor it renders — even though the heading's own text sits in `.elementor-heading-
  title` with the widget's real typography correctly applied.** The visible text can be right (Arial 11px, say)
  while the actual clickable anchor area around/under it is a completely different font — because the anchor tag
  itself is a separate element from `.elementor-heading-title`. Same family of issue as the `.elementor-heading-
  title` custom-CSS gotcha above, one level deeper: fix with `selector .elementor-heading-title a{font-family:...
  !important;font-size:...!important;...}`, not just `selector .elementor-heading-title{...}` — with the values
  taken from the Global Font's own variables (`var(--e-global-typography-<id>-font-family)` …), not typed in.
- **A widget's own `.elementor-widget-container` can inherit the theme's (much larger) body `line-height`,
  inflating every widget's real footprint even when the widget's own text has correctly-set, smaller typography.**
  Classic CSS "line-height strut" behavior: `.elementor-widget-container` is a plain block `<div>` with no
  line-height of its own, so it inherits whatever the theme sets on `body` (Astra: `line-height:26.4px` at 16px
  base) — and an inline child (a `header_size: "span"` Heading widget's `.elementor-heading-title`, correctly
  sized smaller, e.g. 11px/16.5px line-height) does NOT shrink its containing block's line-box below that
  inherited value; the container's own inherited line-height still governs. The visible text renders at the right
  size, but every widget's real vertical footprint is ~10px taller than intended — invisible in a screenshot,
  only found by measuring: a footer column measured **177.97px tall** with individually-correct 11px/1.5em links,
  vs. **138.41px** (matching hand-calculated expected height) once fixed — a **~30%** inflation compounding across
  every stacked text widget in a tight-typography design (a footer, a small-print band). Reproduces on *any*
  small-type text widget using `header_size: "span"`/`"div"` (not a real h1–h6) sitting in a container that
  doesn't itself set `line-height`. Fix: add `line-height:0` to `.elementor-widget-container` via the containing
  Container's own Custom CSS (`selector .elementor-widget-container{line-height:0;}`) — safe because every text
  widget here already sets its own explicit `line-height`, so this only removes the wrapper's own phantom strut,
  not any real text spacing. **Whenever a design uses small/tight type (footers, fine print, dense nav) sitting
  inside anything other than a real heading tag, measure the actual widget-container height against a hand
  calculation (line-height + margins) rather than trusting a screenshot — this bug is real, common, and completely
  invisible to the eye until it's compounded across several stacked items.** That compounding is the actual risk
  signal, not "small text exists somewhere": a swept audit of 52 small-text widgets across three built pages found
  it visually real and worth fixing only in one narrow, tightly-stacked vertical column (a footer's link list) —
  a handful of others measured a similar few-px discrepancy but sit in a *row* next to much taller sibling content,
  where the row's own rendered height is governed by that sibling regardless, making the extra invisible pixels
  genuinely moot. Confirm actual visual consequence (does it compound across stacked items with nothing taller to
  absorb it) before spending time chasing every instance where the bug is technically present but invisible.
- **A child widget's own `_margin` for spacing inside a flex Container can silently stop rendering correctly if
  that Container's own display context later changes** (e.g. it gets wrapped in a link via `html_tag: "a"`, or
  otherwise starts participating differently in its own parent's layout) — margin-collapsing rules depend on the
  exact formatting context involved, and a margin that rendered correctly one way can measure ~1x its own value
  taller once that context shifts, with no error and nothing visibly wrong in the *saved settings* to point at.
  Confirmed the hard way: a heading's `_margin: {top: 14}` rendered fine standalone, then silently added a full
  extra 14px to its own widget's measured height (line-height correct, margin correct, yet the total came out
  wrong) purely from being wrapped in an anchor tag elsewhere in the same edit. **Prefer the parent Container's own
  `flex_gap` over a child widget's `_margin` for spacing between stacked/inline children whenever the parent is
  already a flex Container** — gap-based spacing has no collapsing ambiguity to break, regardless of what the
  container's own tag or display context does later. Reserve `_margin` for spacing relative to a container's own
  edge (first/last-child asymmetry a uniform gap can't express), not for the general "space between these
  children" case.
- **`width` (and therefore `align`) has no effect on a `header_size: "span"`/`"div"`-as-inline Heading widget — it
  renders `display: inline`, and CSS ignores an explicit `width` on inline elements entirely, regardless of what
  the control panel shows or what the saved setting says.** A design detail like "align this small label to the
  right edge of a wider sibling" (a tagline under a logo, say) needs one of: (a) the *parent* being `width:
  fit-content` with `flex_align_items: flex-end`, so the shorter child naturally lands at the parent's own right
  edge — but only works when the parent is genuinely fit-content, not stretched to fill a grid cell or row; or (b)
  an explicit `width` set directly on the widget *plus* `display: inline-block` (or `block`) forced via Custom CSS
  (`selector .elementor-heading-title{display:inline-block !important;width:...!important;}`) — the native
  `width`/`align` controls silently no-op without that display change. Confirmed the hard way: setting both
  `width` and `align: "right"` through the normal controls produced no visible change at all until the Custom CSS
  display override was added.
- **Spacing between a vertical Nav Menu widget's own items can resist a plain `margin-bottom !important` Custom
  CSS fix for reasons that don't show up in the CSS itself.** Confirmed the hard way: a rule targeting
  `.elementor-item` was the *only* margin declaration matching the element (verified directly via CSSOM
  enumeration — correct selector, correctly scoped to the widget, correctly `!important`), yet the live element's
  `getComputedStyle` margin still read `0px`. Don't sink time re-verifying the same rule is "really" there and
  "really" `!important` if it already checked out once — switch approaches instead: target `gap` on the `<ul
  class="elementor-nav-menu">` itself (`selector .elementor-nav-menu{display:flex !important;flex-direction:column
  !important;gap:...!important}`, with the item's own margin reset to `0`). This worked immediately where the
  margin approach didn't, and matches the broader "prefer `flex_gap`/`gap` over a child's own `margin`" pattern
  already established elsewhere in this file for exactly this class of problem.
- If any fix was made by editing postmeta directly (via wp-cli/eval) rather than through {{builder}}'s own editor
  UI, verify against the actually-*served*/rendered data, not just what was saved — Elementor caches rendered
  widget output in `_elementor_element_cache` postmeta, which a direct edit won't invalidate; delete it after any
  such edit. The same applies to a lingering revision post. On Elementor 4.x, also check
  `wp option list --search="elementor_atomic_cache_validity*"` if a change still isn't rendering.

Finish with a report posted in chat covering:
- **Global Styles scope:** the step 1 impact list (anything already linked to a slot that just changed, with its old
  vs. new value — or that nothing was found), exactly which colors/fonts/Layout values were set, confirmation Theme
  Style was left untouched, every Custom CSS class added or updated (step 6) with its selector and what it's for,
  and the step 7 verification (the generated Kit CSS actually contains the new values).
- **Every other scope:** what was built (the new page/header/footer/menu/products-archive/single-product template),
  a direct URL or edit link to review it, explicit confirmation of the non-destructive constraint (the live site's
  current header/footer/menu/front-page/shop/product pages are unchanged — say so plainly, don't just imply it),
  the baseline quality bar above (each item met, or the exception
  and why), results of the visual/functional comparison against the analysis and anything that's still a known gap,
  and a reminder that this is a preview artifact — promoting it to live (a Display Condition, a theme location,
  publishing the page, or setting it as the front page) is a separate, manual decision.

Also save this same complete report to {{wpSiteDir}}/reports/create-report.md (create the folder if needed;
overwrite any previous version) — the whole report exactly as posted in the chat, not a summary.
