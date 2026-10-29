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

Review the WordPress theme's own source code at {{wpSiteDir}} (it runs at {{wpSiteUrl}}) for code-quality and
security issues — the active theme's PHP files, its own CSS architecture, and (if {{builder}} is Elementor Pro)
whether the Elementor Kit's global settings actually stay consistent with that CSS — not rendered-output concerns
already covered elsewhere (visual parity is Review UI's job, WCAG is Accessibility's, Core Web Vitals is
Performance's, `!important` overuse specifically is its own review — don't duplicate any of those here). Do not make
any code or content changes yet — this is a comparison + reporting task only, same as the other review prompts.

This review is scoped to the active theme's own source at {{wpSiteDir}} only — always the local codebase, regardless
of the Live checkbox, since it reads PHP/CSS source files directly, and there's no credential-based filesystem access
to a live server from here (unlike the other review buttons, this one has no live-URL equivalent to check instead).
Also not a parity check against {{siteUrl}}/{{siteDir}} — the original mockup's own code quality isn't the standard
here. Don't re-check hardcoded absolute URLs or placeholder email addresses either — both are
`review-pre-migration`'s job specifically.

Track your progress through the steps below with the TodoWrite tool as you go, so progress is visible in the
dashboard.

1. Identify the active theme (`wp theme list` via wp-cli) and its full file list under
   {{wpSiteDir}}/public-html/wp-content/themes/<active theme>/ — this review covers every PHP and CSS file there (and
   the parent theme's too, if this is a child theme), not the whole WordPress install.
2. **PHP: output escaping.** For every place a PHP file echoes/prints a dynamic value into HTML (post/option/meta
   data, a `$_GET`/`$_POST`/`$_REQUEST` value, anything not a hardcoded string), confirm it's passed through the
   escaping function matching its context — `esc_html()` for text content, `esc_attr()` for an HTML attribute,
   `esc_url()` for a URL, `wp_kses_post()`/`wp_kses()` for content allowed some HTML. Flag any dynamic value printed
   raw with no escaping at all — a real XSS risk if that value could ever contain attacker-influenced content (a post
   title, a URL query param, a form field), not just a style nitpick.
3. **PHP: input handling.** For every place a file reads `$_GET`/`$_POST`/`$_REQUEST`/`$_COOKIE` directly, confirm
   it's sanitized (`sanitize_text_field()`, `absint()`, `sanitize_email()`, etc., matching the expected shape) before
   use, and that any state-changing action triggered this way (a form submission, a settings change) is
   nonce-verified (`check_admin_referer()`/`wp_verify_nonce()`) and capability-checked (`current_user_can()`) if it's
   meant to be admin-only — the exact pattern this project's own `se-url-fixer`/`se-cache-fixer` plugins already use
   correctly, so there's a working local example of "done right" if anything in the theme falls short of it.
4. **PHP: direct SQL.** Search for any raw `$wpdb->query()`/`$wpdb->get_results()`/etc. call built with string
   concatenation or interpolation instead of `$wpdb->prepare()` — a SQL-injection risk if any interpolated value could
   ever be user-influenced, even indirectly.
5. **PHP: deprecated/unsafe functions and hygiene.** Check for deprecated or discouraged WordPress/PHP APIs
   (`create_function()`, `extract()`, deprecated hook names WordPress itself warns about), suppressed errors (`@`
   hiding a real failure instead of handling it), and confirm every PHP file starts with a direct-file-access guard
   (`if ( ! defined( 'ABSPATH' ) ) { exit; }` or equivalent) the same way both `se-` plugins already do.
6. **PHP: asset enqueuing.** Check every `wp_enqueue_style()`/`wp_enqueue_script()` call in the theme for a correct
   dependency array (a missing real dependency — a handle that relies on the builder's frontend script or on jQuery
   without declaring it, say — causes exactly the kind of load-order bug these reviews surface) and a real version
   argument (a
   static version or `filemtime()`-based one, not `false`/omitted, so cache-busting actually works on deploy).
7. **PHP: behavioural correctness of output filters and conditional loading.** Separate from the escaping/SQL/input
   checks above, which ask whether code is *unsafe* — this asks whether it is *right*. Themes in this project
   accumulate functions that rewrite rendered markup or decide what to load, typically added by earlier performance
   or accessibility fix passes: `render_content`/`the_content` filters that regex over HTML, `style_loader_tag`/
   `script_loader_tag` filters that rewrite tags, conditional `wp_dequeue_style()`/`wp_dequeue_script()`, and
   `wp_scripts()` group manipulation. Read each one and work out what it does on inputs other than the page you
   happen to be looking at. Specifically:
   - **Does the condition see everything it needs to?** A dequeue keyed on `get_queried_object_id()`'s own
     `_elementor_data` misses widgets living in the header/footer/section templates that page also renders — so the
     asset gets dropped while something that needs it is on screen. Enumerate the builder's template posts (not just
     the page posts) and check the condition against those too, then say in the finding whether it is wrong *now* or
     merely fragile if content changes later; both are worth reporting, but they are not the same severity.
   - **Does a regex over markup handle the cases it doesn't currently meet?** An attribute-injecting filter that
     guards on one attribute but writes two produces a duplicate when only the other is present. Rendered markup is
     not a stable contract — a plugin update changes it.
   - **Does moving or deferring an asset break anything that depended on the old order?** If scripts were moved out
     of the head, confirm nothing remaining there (including inline script) needs them.
   - **Is the behaviour actually reaching the page?** Builder output is often served from a render cache
     (`_elementor_element_cache`), so a filter can look correct in code and do nothing live. Verify against rendered
     HTML, not the source.
   Report what you verified, not just that the code looks reasonable — "correct today, fragile if X" is a legitimate
   and useful finding here, and is the one this category exists to surface.
8. **PHP: global variables.** Check for two distinct problems, not just one:
   - **Custom globals the theme itself defines** (`global $some_theme_var;` backed by a variable this project invented,
     or a bare top-level `$variable` in `functions.php` read via `global` elsewhere) — these pollute the single shared
     global namespace every plugin and WordPress core itself also uses, risking a silent collision with an
     unrelated same-named global from another plugin, and make data flow hard to trace (a value can change from
     anywhere with no clear owner). Flag each one and note the safer alternative: a function parameter/return value,
     a class property, or (if it must persist across requests) an option/transient.
   - **Reliance on a WordPress core global where a proper accessor function already exists** — e.g. reading
     `global $post;` directly instead of calling `get_post()`/using the loop's own `get_the_ID()`/etc., or `global
     $wpdb;` where a higher-level API (`WP_Query`, `get_posts()`) would avoid raw SQL entirely (ties into the SQL
     check above). This isn't automatically wrong (some of these globals are WordPress's own standard, expected way
     of doing things inside `the_loop`), so only flag it where a cleaner built-in alternative genuinely exists and
     isn't being used, not every `global $post;` on principle.
9. **CSS: architecture, not `!important`** (that's `review-important`'s job — don't duplicate its findings here).
   Within the same in-scope CSS (the active theme's own stylesheet(s); exclude {{builder}}/vendor CSS, same
   distinction `review-important` uses):
   - **Dead/unused rules:** a selector matching nothing in any real page's rendered markup (check via
     `_elementor_data`/actual HTML, not just plausibility) — confirm with the same rigor that caught
     `.ah-offset-wrap` as dead CSS during the last Change pass, don't just guess from the selector name.
   - **Duplicate/redundant declarations:** the same selector (or an equivalent one) restating a property that's
     already set elsewhere with no different effect.
   - **Hardcoded values with an existing design-token equivalent:** a literal hex/rgb color or pixel value matching
     one of this theme's own CSS custom properties (`var(--ah-*)`) almost exactly, where using the existing token
     would be more maintainable and consistent instead.
   - **Content hidden via CSS instead of removed:** a rule setting `display:none`/`visibility:hidden` on a selector
     that targets genuinely redundant/leftover page content (a duplicate heading, an old section superseded by a
     newer one) rather than something legitimately meant to be conditionally shown (a closed mobile menu, an inactive
     tab). Check what the rule actually hides via the real rendered markup before concluding either way — hidden
     redundant content is still in the DOM for assistive tech/crawlers to encounter, and the real fix is removing the
     underlying element from the page content, not keeping the CSS rule that masks it.
10. **Global design settings, matched to whichever builder is actually active** — only one of the two branches below
   applies to any given site; skip the other entirely.
   - **If {{builder}} is Elementor Pro:** compare the Kit's stored settings (`_elementor_page_settings` postmeta on
     the Kit post — find it via `wp post list --post_type=elementor_library` if the id isn't already known) against
     the theme's own CSS custom properties in `:root`, and flag any drift between them:
     - **Global Colors** (`system_colors`/`custom_colors`): does every `--ah-*`-equivalent brand color from the
       theme's CSS actually exist as a global color swatch, at the matching value? A color that changed in the CSS
       but was never updated in the Kit (or was never set up at all) means editors keep picking a stale/wrong color
       from the swatch picker without realizing it.
     - **Theme Style** (headings/body/links/buttons): do these settings' colors/fonts actually match the real
       equivalent rule in the theme's CSS (e.g. does `button_background_color` match `.ah-cta-btn`'s actual
       `background-color`)? A mismatch here means any new button/heading that doesn't explicitly reuse the theme's
       own CSS classes will silently look off-brand.
     - **Layout content width / Background**: does `container_width` match the theme's real measured boxed-section
       width, and does the Kit's background color match the theme's actual page background?
     - Confirm every value by actually reading the Kit's generated CSS file
       (`wp-content/uploads/elementor/css/post-<kit-id>.css`), not just the stored settings — a setting can be saved
       with no visible effect if the wrong control key/shape was used, and only the generated CSS proves it's real.
     - If the Kit has no Global Colors/Theme Style set at all (still Elementor's defaults), that's itself a finding,
       not just an absence of drift — flag it as a gap to fill, the same way it was before this project's own Kit
       settings were first configured.
   - **If {{builder}} is Gutenberg instead:** there's no separate Kit — `theme.json` is itself the source of truth,
     so check it directly against the design values the original Analyze pass extracted (rather than against a
     separate theme CSS file, since a block theme typically has no equivalent `:root` custom-properties block to
     compare against):
     - **`settings.color.palette`/`settings.typography.fontFamilies`**: does every extracted brand color/font
       actually exist as a named entry, at the matching value, not just the primary ones?
     - **`styles.color.background`/`styles.color.text`, `styles.elements.heading`/`h1`–`h6`/`link`/`link.:hover`/
       `button`**: do these match the real extracted values (e.g. does the button entry match the extracted
       primary-CTA styling)?
     - **`settings.layout.contentSize`/`wideSize`**: does it match the original's actual measured container width?
     - Confirm every value by inspecting the rendered page's generated global-styles `<style>` block, not just that
       `theme.json` itself parses and contains the expected keys.
     - An entirely default/unset `theme.json` (no real palette/typography overrides at all) is itself a finding, the
       same reasoning as the Elementor branch above.

If a category has no issues, say so briefly rather than padding the report.

Then write a concrete, numbered findings report — one entry per issue, stating: file/location, category (Escaping /
Input handling / SQL / Deprecated API / Enqueue / Global variable / Dead CSS / Duplicate CSS / Hardcoded value /
Hidden-not-removed content / Global settings drift), what's wrong, and severity. Order it with real security risks
(unescaped output, unsanitized input, SQL injection, missing nonce/capability checks) first — High severity — then
hygiene/deprecated-API/global-variable issues and hidden-not-removed content — Medium (the latter is a real,
currently-live accessibility/SEO issue, not just a latent risk, since the redundant content is genuinely still
reachable by assistive tech/crawlers right now) — then the rest of CSS architecture and global-settings-drift
findings — Low, since those aren't currently causing a visible bug, same reasoning as `review-important` (a
Kit/`theme.json` setting that's merely unset/stale doesn't break the current page — it only risks the *next* piece of
content added).

Present the finished report here in the chat — don't start fixing anything yet.

Also save the complete, final report to {{wpSiteDir}}/reports/review-theme-report.md (create the folder if needed;
overwrite any previous version) — the whole report exactly as presented in the chat, not a summary, so it exists
independent of chat history.
