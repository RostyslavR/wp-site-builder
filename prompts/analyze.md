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

Investigate two related projects and produce a detailed migration plan. Do not make any code or content changes yet —
this is an analysis + planning task only.

Site identity — get this right before documenting anything, mixing it up makes the whole design system (and the
plan built from it) backwards: {{siteUrl}} (source at {{siteDir}}) is the ORIGINAL design being matched — the
reference, never to be edited. {{wpSiteUrl}} (source at {{wpSiteDir}}, using {{builder}}) is the WORDPRESS site the
plan will be built against — it currently does NOT match the original, that's the whole point of this analysis. If
you find yourself citing a WordPress- or {{builder}}-specific detail (builder-generated class names, wp-content
paths, a builder widget) as evidence for what "the original" looks like, or a source file under {{siteDir}} as
evidence for what the
WordPress site currently has, that's a sign the labels have flipped somewhere — stop and re-attribute before
continuing.

Track your progress through the numbered steps below with the TodoWrite tool as you go, so progress is visible in
the dashboard.

1. Investigate the source design's code at {{siteDir}} (it runs at {{siteUrl}}) — read through its components, pages,
   and styles to understand its structure.
2. Make sure {{siteUrl}} is actually reachable before screenshotting it — if it isn't, start it yourself (find and use
   whatever PORT/BASE_PATH/env vars the project requires, the same way Install Site would) and wait until it's ready.
   Before using Playwright, confirm it's actually resolvable globally (`NODE_PATH=$(npm root -g) node -e
   "require.resolve('playwright')"`) rather than assuming a prior session set it up. If not, install it globally,
   once for this whole host — `npm install -g playwright` — and use Playwright only, never `puppeteer` alongside or
   instead of it (remove a redundant one if you find it). Always run any script that needs it with
   `NODE_PATH=$(npm root -g)` set (e.g. `NODE_PATH=$(npm root -g) node {{wpSiteDir}}/scripts/<script>.js`) — a global
   install alone doesn't make `require('playwright')` resolve from an arbitrary project directory without it. The
   browser binary itself is usually already cached globally at `~/.cache/ms-playwright/` from other projects' prior
   work; check there before re-running `npx playwright install chromium`, which re-downloads needlessly otherwise.
   Then start a headless Chromium browser via Playwright (write and run a small script with Bash, saved to
   {{wpSiteDir}}/scripts/ — not wherever it'd otherwise land, and not into {{siteDir}}, which is a separate project
   you never write into) and visually inspect the running site — screenshot each major section at mobile, tablet, and
   desktop widths, saving every screenshot to {{wpSiteDir}}/shorts/ (create it first if it doesn't exist yet), so
   you're analyzing the actual rendered design, not just the source. Verify images and other assets actually render
   in the screenshots, not just that the page returns 200 — a base-path mismatch can leave every image broken while
   the page still loads fine. Fix the underlying cause before treating screenshots as authoritative. If you started
   the site yourself in this step, stop it again once you're done screenshotting.

   **Before assuming the original is a single page, actually check.** A design that scrolls as one long homepage can
   still link out to further real, fully-designed pages (e.g. a card grid's "Learn more" links, a footer's legal
   pages) — a same-page anchor (`href="#pricing"`) and a real separate page (`href="/pricing"`) look identical in a
   quick skim of the nav alone, so don't conclude "single-page" from the header nav without also following every
   other link on the rendered homepage (card CTAs, footer links, etc.) and checking where each one actually goes.
   Load each candidate URL directly and confirm it renders its own distinct content (own `<title>`/`<h1>`, not a
   redirect back to `/` or a 404) rather than trusting the `href` text alone. Record the full, real list of pages —
   every one gets its own later Analyze Page + Create pass, not just the homepage — under its own heading in the
   final report, **`## Pages`**, as a plain Markdown list of paths in backticks, one per line (e.g. `` - `/` ``,
   `` - `/pricing` ``) and nothing else non-path in that section — this exact heading and format is what a later
   page-picker UI parses back out, so free-form prose there won't be found by it.
3. Investigate the WordPress site's code at {{wpSiteDir}} (it runs at {{wpSiteUrl}}) — theme files, existing {{builder}}
   content, and active plugins.
4. Make sure {{wpSiteUrl}} is actually running before screenshotting it — if it isn't, start it the way the project
   expects (e.g. `docker compose up`). WordPress stacks are typically meant to run persistently, so unlike the source
   site above, you don't need to stop it again afterward unless you spun up disposable infrastructure just for this
   check. Then start Chromium again and visually inspect the current WordPress site the same way, across the same
   viewport widths.
5. Analyze the ORIGINAL site (from steps 1–2) as a design system and document, with exact values. Missing any of
   these categories here means Build has no way to know it needs replicating, so treat this list as exhaustive, not
   a starting point:
   - Colors: get exact values via `getComputedStyle` on the rendered page (e.g.
     `getComputedStyle(el).backgroundColor`) rather than manually converting the source's HSL/OKLCH custom properties
     to hex by hand — manual conversion is a real, easy-to-make rounding error (a few RGB units off is enough to be a
     visibly different shade once applied everywhere as a Global Color). Note each color's exact rendered value and
     semantic role: primary, secondary, accent, background, text, etc.
   - Typography scale (font families, sizes, weights, line-heights for headings/body/labels). This environment's
     headless Chromium may lack real Arial/Helvetica font files and substitute a metric-compatible clone (e.g.
     fontconfig resolving to Liberation Sans or Nimbus Sans) — a screenshot can visually look like a different
     typeface even when the declared CSS is correct. Verify font-family by reading `getComputedStyle(el).fontFamily`
     as a string and comparing it against the source's declared value, not by eyeballing the rendered glyphs.
   - Spacing system (the underlying scale, e.g. 4px/8px increments, and how it's applied to padding/margin/gaps)
   - Container widths (max-widths, side margins/centering, and how they change per breakpoint — note whether
     sections are edge-to-edge/full-bleed or sit inside a centered boxed container, and at what width). Measure the
     header's and footer's own content container separately from the page body's — don't assume they reuse the same
     boxed max-width. Header/footer are frequently a structurally different container in the source theme (e.g. a
     full-width bar with just fixed side padding and no max-width cap at all, scaling with the viewport) than the
     page body's boxed content width, so check by measuring the header/footer's rendered width at two different
     viewport widths (e.g. 1440px and 1920px) — if it scales proportionally with the viewport rather than staying
     fixed once past the body's boxed max-width, it's uncapped and needs its own container spec, not the body's.
   - Buttons (variants, states — default/hover/active/disabled — padding, radius, and whether icons like arrows or
     chevrons are present, not just their color/size). Measure the header/nav CTA button (e.g. "Contact Us")
     separately from body-content CTA buttons ("Get Started Today" etc.), even when they share the same accent
     color — the header/footer are often a structurally different component from the page body (e.g. the theme's
     own header-builder widget vs. the page builder's buttons), so it's a real possibility they're two
     independently-styled button systems rather than one style applied twice. Don't assume a single button spec
     measured from one instance covers the other without checking both — averaging or reusing one measurement for
     the other is a real source of drift, not a shortcut.
   - Cards (structure, padding, shadow, radius, border treatment)
   - Sections (vertical rhythm/padding patterns between page sections)
   - Navigation: the exact nav item list and order, and for each item, whether it's a link to a real separate page
     or an anchor/scroll-link to a section on another page (usually the homepage) — don't assume every nav item
     corresponds to a real page. This distinction is easy to lose in Build, since a page-builder's nav widget
     naturally wants to auto-populate from the real page hierarchy, which silently drops anchor-only items and adds
     ones that were never in the original (e.g. an unprompted "Home" link, or a dropdown that didn't exist).
   - Background treatments (overlay/scrim color and opacity over image or video backgrounds, gradients)
   - Form fields (input background fill, border, placeholder color, label styling, and focus state). For any
     `<select>`/dropdown, also note what the open options list looks like (background, text color) — a builder's
     default select styling can easily make option text unreadable against its own background, so document the
     original's actual open-state appearance rather than assuming the closed field's styling covers it.
   - Consistency of repeated elements: when a list/grid repeats the same kind of item (checklist icons, card icons,
     bullet markers), confirm it's actually the *same* icon/marker throughout, not just describe it once from the
     first instance — note explicitly if the original varies it (rare) versus uses one consistent icon everywhere
     (the common case), so Build has no excuse to let a subset drift to something different.
   - Responsive breakpoints (exact widths, and what changes at each one)
6. Check whether the original design's source actually has real SEO implementation to draw from before assuming it
   does — a shared head/meta shell reused across an entire design tool's projects (rather than something written
   per-page for this specific site) is a sign it doesn't; don't spend time hunting for SEO patterns that were never
   really there. Either way, document a concrete SEO plan for the WordPress rebuild based on the actual page content
   and current WordPress SEO best practices, independent of what the original does or doesn't have: a unique meta
   title and description per page (grounded in what that page is actually about, not copied from the original since
   it may not have one), Open Graph/Twitter card tags per page, structured data/schema via {{seoPlugin}}'s own
   built-in settings only (see standing default below — no custom code), correct heading hierarchy (one H1 per page,
   matching its actual primary heading), image alt text, internal linking, an XML sitemap via {{seoPlugin}},
   crawlability/indexability, and SEO-friendly URL structure.

Use these standing defaults when writing the plan — they're already decided, so don't raise them as open questions:
- SEO plugin: {{seoPlugin}}.
- Schema/structured data: use {{seoPlugin}}'s own built-in settings UI only (e.g. Yoast's Organization/Person fields
  under Search Appearance → General) — never a hand-written JSON-LD snippet in theme code. If the plugin's default
  settings don't cover something (e.g. full LocalBusiness address/phone/hours schema, which typically needs a paid
  add-on), leave that piece out rather than reaching for custom code. Anything that might need updating later (a
  phone number, an address) should stay editable through the plugin's own settings page or directly on the page in
  {{builder}}, never require a developer to edit code.
- Repeatable content types (e.g. services): plain WordPress Pages, never a custom post type, regardless of how many
  there are.
- Lead-generation forms: if {{builder}} is Elementor Pro, use its built-in Form widget with a Honeypot field for spam
  protection. Give the Honeypot field a plausible, ordinary-sounding label and field id (e.g. "Company Website",
  "Fax", "Referral Source") rather than leaving it unlabeled or naming it literally after its purpose (e.g. a bare
  "hp" id/label) — an empty or obviously-named honeypot is a real giveaway a scripted bot can detect and skip,
  defeating the point of having one; a field that reads as a normal, enticing thing to fill in is a stronger trap.
  Don't reuse a name that duplicates a real field already on the same form (e.g. don't call it "City" if the form
  already has a real city field) — that's its own tell, and confusing besides.
  Otherwise use Contact Form 7 plus CFDB7 (to store, search, and CSV-export submissions, since CF7 itself doesn't —
  chosen over Flamingo specifically for that export capability, which matters for a lead-gen site where someone
  needs to pull contacts into a CRM) — **don't add a honeypot field or plugin to the CF7 form**; plain CF7 + CFDB7
  only, unless the user explicitly asks for spam protection on it. No other form plugin or CRM integration unless
  the user explicitly asks for one.
- If {{builder}} is Elementor Pro: once the original's exact colors/typography are extracted (step 5 above), set them
  at the Kit level (Site Settings), not only as hardcoded theme CSS — so anything new added later (a heading, a
  button, a whole page) that doesn't explicitly reuse the theme's own CSS classes still renders on-brand by default,
  rather than falling back to Elementor's generic gray/blue placeholders. Concretely:
  - **Global Colors**: the 4 default slots (Primary/Secondary/Text/Accent) mapped to the extracted palette's actual
    semantic roles, plus every other extracted brand color added as an additional custom global color (not just the
    4 defaults) — every color from step 5 should exist as a reusable swatch, not just the primary ones.
  - **Global Fonts**: same mapping for the 4 typography slots, matched to the extracted font families/weights.
  - **Theme Style** (headings, body, links, buttons): set real color/font-family/font-weight values matched to what
    the extracted design system actually uses for each of these — e.g. the button defaults should match the real
    primary-CTA-button styling (background, text color, font, border-radius, padding, hover state) found in step 5,
    not Elementor's own generic default button.
  - **Layout content width**: match the original's actual measured container/content max-width (`getComputedStyle`
    on a real boxed section, not Elementor's generic 1140px default) if it differs.
  - **Background**: the extracted page background color, at the Kit level.
  Confirm each setting actually took effect by checking Elementor's own generated Kit CSS
  (`wp-content/uploads/elementor/css/post-<kit-id>.css`) shows the expected rule, not just that the value was saved —
  an incorrect control name/field shape saves silently with no visible effect, so this is the only way to know it
  actually worked.
- If {{builder}} is Gutenberg instead: the equivalent mechanism is the theme's `theme.json`, not a separate Kit —
  set the same extracted design-system values (step 5) there as the actual source of truth, rather than only in a
  supplementary CSS file:
  - **`settings.color.palette`**: every extracted brand color as a named palette entry (not just the primary ones) —
    this is what populates the block editor's color picker, the direct equivalent of Elementor's Global Colors.
  - **`settings.typography.fontFamilies`**: the extracted font families as named entries, the equivalent of Global
    Fonts.
  - **`styles.color.background` / `styles.color.text`**: the extracted page background/text color, site-wide.
  - **`styles.elements.heading`/`h1`–`h6`, `styles.elements.link`, `styles.elements.link.:hover`,
    `styles.elements.button`**: matched to the same real extracted values as the Elementor Theme Style equivalents
    above (e.g. the button entry should match the extracted primary-CTA styling exactly).
  - **`settings.layout.contentSize`/`wideSize`**: matched to the original's actual measured container width.
  Confirm each actually took effect by inspecting the rendered page's generated inline `<style>` (block themes print
  their global styles as CSS custom properties/rules derived directly from `theme.json`) rather than only checking
  the JSON was written correctly.
- Fix real UX/accessibility gaps even when the source design doesn't have them — in particular, always add a working
  mobile hamburger menu if the source is missing one, always add a scroll-to-top button on long pages, and always
  make the logo in the header (and footer, if it appears there too) a link to the homepage ("/") if it isn't
  already one in the source. The same applies to any other element that's clearly self-referential but has no real
  destination in source (e.g. a footer text link showing the site's own domain name, coded as `href="#"`) — link it
  to "/" too, same reasoning as the logo, rather than raising it as an open question. Only raise a placeholder link
  as a genuine open question if it points somewhere that isn't self-referential (e.g. an undecided third-party or
  social-media URL).
- If WooCommerce is among the active plugins: the child theme must declare `add_theme_support('woocommerce')`
  (plus the cart/checkout support flags — `wc-product-gallery-zoom`, `-lightbox`, `-slider`) in `functions.php`, or
  its templates render with bare, unstyled default markup regardless of how the rest of the theme looks. Style the
  shop/product/cart/checkout templates (via overrides in the child theme's `woocommerce/` folder, not by editing the
  plugin or the parent theme)
  to match the extracted design system (step 5) — colors, typography, buttons, spacing, card treatment — even though
  {{siteUrl}} has no e-commerce pages to model them from directly; apply the same tokens rather than leaving these
  pages on WooCommerce's generic defaults. Subscriptions and Product Bundles are WooCommerce extensions and need no
  separate styling work once WooCommerce's own templates are themed.
- If Polylang is among the active plugins **and its language switcher actually renders somewhere on the current
  WordPress site**: rebuild that switcher into the child theme's header — a rebuilt header has no reason to
  include it unless the plan calls for it, and it'll silently vanish from the rendered site otherwise even though
  Polylang keeps translating correctly behind the scenes. Place it via `pll_the_languages()` (or the {{builder}} nav
  integration if one exists) in the same position it currently occupies, styled to match the extracted design
  system rather than left in Polylang's own default markup. If Polylang is active but **no switcher currently
  renders anywhere** (translated content exists only via direct URL/hreflang, with nothing clickable pointing to
  it), that's the preserve-by-default case below, not this one — don't add a switcher that wasn't there to begin
  with; note the untranslated-but-present other-language content as a known gap rather than building new UI for it.
- Page scope: build only the pages that exist in the original — never add a new page (a Services hub, a blog index,
  etc.) on your own judgment, even for a plausible SEO/structural reason. This is different from the
  UX/accessibility default above: a missing hamburger menu is a defect fix (the original is broken without it); a new
  page is a scope/content decision with real tradeoffs (more to build and maintain, and nothing in the original to
  grade it against later). If adding a page seems genuinely valuable, raise it as an open question in the plan for
  the user to decide, rather than deciding it firmly yourself.
- Existing WordPress content, plugins, and functionality with no counterpart in the reference design (legacy pages,
  an active plugin's store/booking/translation feature, forms, nav items): preserve them exactly as they currently
  work, by default. A design-system rebuild restyles what's there — it doesn't audit or prune it. Concretely: don't
  remove pages/content, don't unlink or delink an active feature (e.g. a linked WooCommerce store), and don't add a
  feature that doesn't already exist (e.g. a language switcher for an installed-but-unused translation plugin, a new
  lead-gen form) just because the reference design or an active plugin makes it technically possible — that's the
  same "don't invent scope" reasoning as the page-scope default above, applied to content and features instead of
  pages. Only raise one of these as an open question if preserving it as-is would leave it visibly broken or
  orphaned by the rebuild itself (e.g. content that was only ever reachable through theme markup this rebuild
  replaces) — not merely because it falls outside the reference design's own scope.
- Domain, hosting, and SSL: out of scope for now, this is a local build only — note it as a future go-live item, don't
  ask about it.

Before writing the plan, re-read the site identity note above and check every documented value's attribution against
it — this is the point where it's easiest to accidentally swap which site is which, especially after going deep into
WordPress/{{builder}}-specific details in steps 3–4. A quick check: every design-system value above should trace
back to {{siteUrl}}/{{siteDir}}, never to {{wpSiteUrl}}/{{wpSiteDir}}.

Then write a detailed, concrete implementation plan for building reusable WordPress components that match this exact
design system, using {{builder}} as the builder. The end goal for a later step (not this one) is to fully rebuild the
WordPress site so it is a pixel-accurate recreation of the original where technically feasible. This includes uploading
all required media, creating or updating a child theme of the site's installed base theme (e.g. Hello Elementor — never
editing the parent theme's own files, so parent updates can't wipe the work), installing any
necessary plugins, and recreating all pages and posts while preserving the original site's design system, layout,
typography, colors, spacing, responsive behavior, and user interactions, following WordPress and {{builder}} best
practices.

Present the finished plan for review here in the chat — don't start implementing it yet. Make firm decisions using the
defaults above rather than leaving them as open questions; only raise something as an open question if it's genuinely
specific to this project and isn't covered by a default above.

Also save the complete, final plan to {{wpSiteDir}}/reports/analyze-report.md (create the folder if needed; overwrite
any previous version) — the whole plan exactly as presented in the chat, not a summary, so it exists independent of
chat history and survives even if this conversation is later lost or compacted. If reaching the final plan took
multiple messages (e.g. interleaved with TodoWrite updates), write the one complete, standalone version here, not
just whatever happened to be in your last message. {{wpSiteDir}} is the project's root — `reports/` here lands next
to `public-html/`, not inside it, so it's never web-accessible regardless of what the live site serves.
