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

Here is the approved implementation plan for matching the WordPress site to the original design:

{{plan}}

WordPress credentials: never reset, change, or create user accounts or passwords on the WordPress site, under any
circumstances — including as a workaround for a login you don't have. Everything needed to build this site is
achievable without ever touching wp-admin's login: check whether a `wpcli` container already exists (`docker ps`, or
look for a `wpcli` service in {{wpSiteDir}}/compose.yml) — if so, use it directly:
`docker exec wpcli wp <command> --path=/var/www/html --allow-root`. If none exists, install WP-CLI some other way
(e.g. add a `wpcli` service using the official `wordpress:cli` image to the compose file, sharing the WordPress
container's volume and DB, with its entrypoint overridden to stay running instead of exiting after one command)
rather than falling back to a credential change. `wp eval-file` runs anything programmatic — creating posts/pages,
uploading media, setting options — directly against the database/filesystem, no login required. If you genuinely
can't find a credential-free path to something, stop and report what you need instead of resetting a password.

Any one-off PHP scripts you write for `wp eval-file` (or other build tooling) belong in {{wpSiteDir}}/scripts/, not
inside `public-html/` (e.g. not in `wp-content/`) — {{wpSiteDir}} is the project's root, so `scripts/` here lands
next to `public-html/` rather than inside it, making it structurally unreachable over HTTP with no `.htaccess` or
other protection needed, unlike anything placed inside the served webroot.

Before executing, make sure both sites are actually reachable — you'll be comparing against the original throughout
this work, and building directly on the WordPress site:
- {{siteUrl}}: if it isn't already running, start it yourself (find and use whatever PORT/BASE_PATH/env vars the
  project requires, the same way Install Site would), and verify images and other assets actually render, not just
  that the page returns 200 — a base-path mismatch can leave every image broken while the page still loads fine,
  which would corrupt any comparison against it.
- {{wpSiteUrl}}: if it isn't already running, start it the way the project expects (e.g. `docker compose up`).

Now execute this plan. Before building each page or reusable component, re-read the relevant part of the plan above
(exact colors, spacing, container widths, overlay treatment, form styling, etc.) rather than working from memory of
it — this matters most if this session has been interrupted and resumed (e.g. a rate-limit pause), since a long
session's context can get summarized in a way that keeps the general shape of a plan while losing its precise numeric
detail. A page that's recognizably similar but drifts on every exact value (wrong colors, wrong fonts, wrong
placement, no overlay) is usually a sign of building from a fuzzy recollection instead of the plan text itself, not a
sign the plan was wrong. Break the plan above and the steps below into concrete todo items with the TodoWrite tool
and track your progress through them as you go, so progress is visible in the dashboard.
- Upload the necessary media to the WordPress media library at {{wpSiteDir}} (it runs at {{wpSiteUrl}}).
- Create or update a child theme of the site's installed base theme (e.g. Hello Elementor) to match the original
  design system, and activate it. Never edit the parent theme's files — every change goes in the child theme, so a
  parent update can't overwrite it. Its `style.css` header needs `Template:` set to the parent's folder name (e.g.
  `hello-elementor`); enqueue the parent's stylesheet from the child's `functions.php` rather than `@import`. Include
  a screenshot.png thumbnail (1200x900px, child theme root) if it doesn't already have one, so it displays correctly
  under Appearance > Themes instead of a blank placeholder. When enqueuing the child theme's own CSS/JS (`wp_enqueue_style`/`wp_enqueue_script`), version them
  with `filemtime()` on the actual file (e.g. `filemtime( get_stylesheet_directory() . '/assets/css/theme.css' )`),
  not a hardcoded static version string/constant — a static version never changes across later edits, so a browser
  that already cached the file keeps serving the stale copy indefinitely even after a real fix ships, which silently
  undoes every later styling fix for anyone with a warm cache and is genuinely hard to notice since the site "looks
  fine" to whoever's testing with a fresh/empty cache at the time.
- Install the plugins named in the stack context above (the page builder, SEO plugin, forms plugin, and any others
  listed) — and only those. This build is the one and only point where plugins get installed; every later pass is
  forbidden from adding, activating, updating, or removing any. So if the plan calls for a plugin that isn't in that
  list, don't quietly install it: say so in the final report as something needing the user's decision, since they
  chose the stack deliberately and adding to it is their call, not a build detail.
- Create pages and posts using {{builder}} that match the original site at {{siteDir}} (it runs at {{siteUrl}}) exactly.
- **Build mobile-first, section by section**: confirm each section's mobile appearance against the original's mobile
  screenshot/computed styles as you build it, then add whatever Tablet/Desktop overrides the wider widths need —
  don't build the whole page at desktop width first and treat mobile as a final pass at the end (that's still where
  the last cross-check below happens, but it should be confirming work already verified per-section, not discovering
  mobile issues for the first time). This doesn't change how {{builder}}'s responsive controls actually work — a
  control's base "Desktop" value still cascades down to every width via `max-width` media queries unless a
  Tablet/Mobile override exists, that's the platform's own mechanism — it changes what a missing override means: a
  deliberately verified match at that width, not an unchecked gap.
- Make sure the logo in the header (and footer, if it appears there too) is a link to the homepage ("/"), even if the
  plan above doesn't call this out explicitly.
- Build the header nav to match the plan's documented item list and order exactly — don't let a page-builder's Nav
  Menu widget auto-populate itself from the real WP page hierarchy instead. That default behavior silently drops any
  item that's an anchor/scroll-link rather than a real page, and adds items (an unprompted "Home" link, a dropdown
  for a section that has sub-pages) that were never in the original. If the plan says an item is an anchor link, wire
  it as one, even on pages other than the one it scrolls to (link to `/#section-id` from elsewhere).
- If pretty permalinks are needed, set them through WordPress's own mechanism (save the Permalinks settings page, or
  `flush_rewrite_rules()`/`wp rewrite flush`) — never hand-edit `.htaccess` directly. That file is meant to be
  generated by WordPress itself; hand-editing it (even temporarily, e.g. to test something while debugging) risks
  clobbering rules WordPress already generated, and leaves it out of sync the next time permalinks actually change.
- When theme code has to reference something {{builder}} generated — an element id, a compiled per-post stylesheet,
  an upload URL — look it up at runtime from the builder's stored page data (for Elementor, the post's
  `_elementor_data`) instead of
  hardcoding the literal value. Those identifiers are regenerated whenever a section is rebuilt in the editor, so a
  hardcoded copy goes stale silently: the code keeps running without error and keeps pointing at an element or file
  that no longer determines anything, which is far harder to notice later than an outright failure would be. Deriving
  the value also keeps the code correct across pages that each have their own version of it. Where a literal genuinely
  can't be avoided, note in a comment what it refers to and what would invalidate it.

Work through this step by step, and check your work against the original site as you go — screenshot both sites at
the same breakpoints and compare them directly, not just a visual skim. Verify uploaded media actually renders on the
WordPress pages too, not just that the upload itself succeeded. Two specific things a static screenshot alone won't
catch: when a list/grid repeats the same icon or marker across items, check that you actually built *every* instance
the same way rather than assuming the first one you got right sets the pattern for the rest (a subset silently ending
up different is an easy, real mistake); for any `<select>`/dropdown, actually open it and confirm the option text
is legible against its background, not just that the closed field looks right — a builder's default select styling
can leave option text unreadable even when everything else matches; and for long-form body copy (paragraphs/lists in
a text-editor-type widget), actually measure line-height and paragraph/list margins with `getComputedStyle` against
the original rather than eyeballing a screenshot — a several-px line-height or margin gap compounds invisibly over a
long page (reads as "slightly different vertical rhythm" at a glance, not an obvious defect) but adds up to a real
page-height mismatch. Setting the value once in the builder's global Theme Style/Kit typography isn't sufficient
proof it's actually applied: builder-provided per-widget CSS (e.g. Elementor's own paragraph/list defaults inside a
text-editor widget) can carry higher specificity than the Kit's body-level rule and silently win over it, so confirm
the *rendered* computed value on real widget content, not just that the Kit's generated CSS file contains the number
you set. If a gap is found, fix it with a rule scoped to the actual widget class site-wide (not per-page) so it
doesn't need rediscovering page-by-page later; and don't assume the header/footer container uses the same boxed
max-width as the page body just because the plan's one "Container widths" value covers the body — measure the
header's and footer's own rendered width directly (e.g. at 1440px and 1920px viewports) and compare to the plan.
A theme header/footer built outside the page builder is a separate container from the builder's boxed body content,
and the source often makes it genuinely wider (a full-width bar with fixed side padding and no max-width cap,
scaling with the viewport) rather than reusing the body's cap — reusing the body's boxed width by default strands
the header's own content in a centered box with dead background space on both sides at any viewport wider than the
body's max-width.

Once everything is built, do a final pass comparing the WordPress site against the original at mobile, tablet, and
desktop widths, and fix any remaining discrepancies before considering the migration complete. As part of this pass,
actually request every real page URL you created (not just the homepage) and confirm each returns 200, not 404 — a
correct-looking permalink setting in the database doesn't guarantee the rewrite rules were actually generated.

If you started {{siteUrl}}'s dev server yourself, stop it again once you're done. Leave {{wpSiteUrl}} running —
WordPress stacks are typically meant to run persistently, unlike the disposable source dev server.

**Baseline quality bar — check each of these before reporting the build done.** Every item below is something this
project has shipped wrong at least once and then spent a full review-and-fix cycle correcting, so they're cheap here
and expensive later. Report each as met, or as a stated exception with the reason — don't quietly skip one.

- **No sample content left published.** Delete (or trash) the default "Hello world!" post, its sample comment, and
  the "Uncategorized" category if unused. Left in place they're publicly reachable and land in the sitemap.
- **Site icon set** if any logo/mark asset exists, so `/favicon.ico` resolves and the tab isn't a default glyph.
  A missing one fires a failed request on *every* page load, not just an ugly tab.
- **Every form input has a programmatic label** — a real `<label>` associated via `for`/`id` or by wrapping.
  A `placeholder` is not a label: it disappears the moment the user types, and automated tooling won't flag it,
  because the accessible-name spec accepts placeholder as a fallback. Add `autocomplete` tokens while you're there.
- **Heading hierarchy is sound**: exactly one `<h1>` per page and no skipped levels. Check the *rendered* heading
  sequence, not the builder's settings — third-party addon widgets carry their own tag setting under names like
  `slider_title_tag`, or hardcode a level with no setting at all.
- **Images have appropriate `alt`**: meaningful text on content images, `alt=""` on genuinely decorative ones. The
  filename stem is not alt text.
- **Page content sits in a `<main>` landmark** with the skip link targeting it, not a generic `<div>`.
- **The theme's CSS beats builder globals by specificity, not `!important`.** Where a builder's global (an Elementor
  Kit rule, `theme.json`) has to be overridden, use a higher-specificity selector — the doubled-class pattern is the
  intended tool. Reserve `!important` for genuine vendor-behaviour overrides and the standard visually-hidden
  utility, and comment why at each use.
- **Dynamic output is escaped per context** (`esc_html`/`esc_attr`/`esc_url`), and date output uses `wp_date()`
  rather than bare `date()` so it follows the site's timezone.
- **Contact details in hand-written templates are editable without code.** *Only* where the header/footer are the
  theme's own PHP templates — if they're builder- or block-managed, they're already editable and this doesn't apply.
  Where it does, expose the contact address (and phone, if present) as Customizer settings whose defaults are the
  literals the template ships with, so an unset or emptied value renders exactly as before. Navigation belongs in
  registered nav menus for the same reason. **Keep this to a handful of fields.** Headings, taglines and button copy
  are design decisions that belong in the build — don't pre-emptively parameterise them, and don't build a settings
  panel for edits nobody has asked for. The bar is "changing this would otherwise require a developer and a file
  edit", not "this is a string".

Finish with a report posted in chat covering:
- What was actually built: theme changes, each page/post created, plugins installed, media uploaded.
- The baseline quality bar above: each item met, or the exception and why.
- Direct URLs (at {{wpSiteUrl}}) to view each rebuilt page.
- Results of the final comparison pass — anything that didn't match the original and was fixed, and anything that's
  still a known gap.
- A reminder of the go-live items intentionally deferred during this local build: domain/hosting/SSL, and flipping
  `blog_public` on before launch.

Also save this same complete report to {{wpSiteDir}}/reports/build-report.md (create the folder if needed; overwrite
any previous version) — the whole report exactly as posted in the chat, not a summary, so it exists independent of
chat history. If it took multiple messages to reach the final version, write the one complete, standalone report
here, not just whatever happened to be in your last message.
