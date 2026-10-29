Review the WordPress site at {{wpSiteDir}} (it runs at {{wpSiteUrl}}) for overuse of CSS `!important` — a specificity
smell that makes styles harder to override and maintain, not a visual defect in itself. Do not make any code or
content changes yet — this is a comparison + reporting task only, same as the other review prompts.

This review is scoped to {{wpSiteUrl}}/{{wpSiteDir}} only — it isn't a parity check against {{siteUrl}}/{{siteDir}},
since `!important` usage is a property of this codebase's own CSS, not something the original mockup has an
equivalent of.

{{liveReviewNote}}

Track your progress through the steps below with the TodoWrite tool as you go, so progress is visible in the
dashboard.

1. Check that {{wpSiteUrl}} is actually reachable before reviewing it — it should already be running from earlier
   steps. Do not start it yourself: if it isn't reachable, stop here and report that back instead of spending time
   bringing it up.
2. Scope this to CSS actually authored for this project, not vendor/framework code — {{builder}} (and any bundled
   plugin) ships its own CSS that uses `!important` extensively by design, and that's not this project's code to fix:
   - **In scope:** the active theme's own stylesheet(s) under {{wpSiteDir}}/public-html/wp-content/themes/<active
     theme>/ (check `wp theme list` via wp-cli for the active one if unsure), any Additional CSS entered in the
     Customizer (`wp option get custom_css_post` or the `custom_css` post type, if wp-cli/server access exists), and
     any per-page/per-section/per-widget Custom CSS entered through {{builder}}'s own custom-CSS feature (stored in
     post meta — check via wp-cli if access exists, or by opening each page's builder editor if it doesn't).
   - **Out of scope:** {{builder}}'s own generated/framework CSS (e.g. Elementor's frontend.min.css, widget default
     styles, its auto-generated per-page CSS files under `wp-content/uploads/elementor/css/`), and any third-party
     plugin's own bundled stylesheet. Do not flag `!important` found in these — it isn't this project's code, and
     "fixing" it would mean patching a vendor file that gets overwritten on the next update.
   - If server/wp-cli access doesn't exist (e.g. reviewing a live URL with none), do what's still possible from the
     rendered page alone: view-source or fetch each page's HTML, identify which stylesheet URLs come from the active
     theme (by path) vs. {{builder}}/plugins, and only fetch+scan the theme ones plus any inline `<style>` blocks
     WordPress prints for Additional CSS/Custom CSS (both are typically rendered as page-specific inline `<style>`
     tags, not just enqueued files) — note what couldn't be checked this way rather than guessing.
3. Within the in-scope CSS from step 2, find every `!important` declaration and record: which file (or "Additional
   CSS"/"Custom CSS on <page>" if not a file), the selector and property it's attached to, and a short excerpt of
   surrounding context.
4. For each one found, judge whether it's actually justified or a specificity smell:
   - **Likely justified:** overriding a hardcoded inline `style=""` attribute the markup itself generates (common
     with some builder widgets and can't be beaten by selector specificity alone), or overriding a vendor/framework
     rule that itself uses `!important` (the only way to win against another `!important` is another one).
   - **Likely a smell:** overriding this project's *own* other CSS (nothing vendor-controlled involved) — this
     usually means the selector doing the overriding just needs to be written with higher natural specificity, or
     placed later in source order, instead of reaching for `!important`. Also flag any duplicate/redundant
     `!important` on a property that's only set once to begin with (no real specificity conflict exists at all).
   - **Verify every conclusion empirically before finalizing it — not only the ones that already look doubtful.** Check
     the actual computed/matched CSSOM styles for that selector in a real browser (e.g. a Playwright/devtools-protocol
     `getMatchedStylesForNode` check — confirm `playwright` is actually resolvable globally first
     (`NODE_PATH=$(npm root -g) node -e "require.resolve('playwright')"`); if not, `npm install -g playwright` once
     for this whole host, never alongside a second library like `puppeteer`, and run the script with
     `NODE_PATH=$(npm root -g)` set), for every single finding, including ones heading toward "no competing rule
     exists at all." A confident-looking read of the CSS text is exactly how a real conflict gets missed: {{builder}}
     ships more than one layer of its own CSS that can compete — not just its per-page/per-widget auto-generated
     files (`wp-content/uploads/elementor/css/post-*.css` for Elementor), but also its own global/base widget
     defaults (e.g. Elementor Pro's own `.elementor-widget-form .elementor-field-group > label` styling shared across
     every form instance) — checking only the per-page generated file and concluding "no conflict" without also
     checking the base widget CSS is a real, previously-observed way to reach a wrong "smell" verdict that a
     follow-up Change pass then has to catch and fix.

If no `!important` is found outside of {{builder}}/vendor code, say so clearly and treat this as a page with no
material issues — don't invent a nitpick.

Then write a concrete, numbered findings report — one entry per `!important` judged to be a smell (skip the justified
ones, but mention the justified count briefly so the report isn't silent about what was reviewed), each stating:
file/location, selector, property, why it's a smell, and a concrete fix (the higher-specificity selector or reordering
that would let it be removed). This is a maintainability finding, not a compliance or user-facing standard, so
severity is generally Low unless a specific instance is actually causing a visible bug (e.g. blocking a legitimate
override elsewhere, causing an observed visual regression) — in that case, mark it High and describe the visible
symptom.

Present the finished report here in the chat — don't start fixing anything yet.

Also save the complete, final report to {{wpSiteDir}}/reports/review-important-report.md (create the folder if
needed; overwrite any previous version) — the whole report exactly as presented in the chat, not a summary, so it
exists independent of chat history.
