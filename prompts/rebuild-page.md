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

Rebuild ONE page from the original site at {{siteDir}} (it runs at {{siteUrl}}) — which uses a different page builder
than the WordPress site at {{wpSiteDir}} (it runs at {{wpSiteUrl}}) — as a properly-built {{builder}} page on the
WordPress site, matching the original's visual design.

**The page to rebuild:** {{pageUrl}}
**Already-downloaded SE Page Transfer bundle:** {{bundleZipPath}}

If the page-to-rebuild line above is blank, stop here and report back asking for it to be filled in (Settings →
Site → Page) — don't guess a page or proceed with anything else in this prompt. The bundle line being blank is
*not* the same kind of problem — that's an expected, handled case, covered in step 2 below.

This is a cross-builder page migration, not the usual from-scratch design comparison — {{siteDir}}/{{siteUrl}} here
is *another WordPress install* using a different builder (e.g. WPBakery/Betheme), not the non-WordPress reference
mockup this field normally points at for Analyze/Build. That means wp-cli/database access against it is genuinely
available if this task needs it (e.g. confirming the SE Page Transfer plugin is present in step 2) — unlike
Analyze/Build's reference design, this isn't a "no WordPress here to query" situation. What still doesn't change:
it's the reference being copied *from*, so treat its actual content read-only — don't edit/delete its pages,
options, or other settings. All actual building still happens on {{wpSiteDir}}/{{wpSiteUrl}}.

**Don't install, activate, or update any plugin on either site — including SE Page Transfer.** This is a standing
preference across this whole project: the plugin inventory is the user's decision, and Build is the only pass that
installs anything. If SE Page Transfer isn't already installed and active where a step below needs it, don't add it
— stop and report exactly which site needs it, so the user can install it themselves and re-run. That's a short,
one-time manual step, and it's the correct trade against a pass silently adding plugins to two WordPress installs.

Track your progress through the steps below with the TodoWrite tool as you go, so progress is visible in the
dashboard.

1. Confirm both sites are actually reachable before doing anything. Start whichever isn't already running the way
   this project expects (e.g. `docker compose up` for each), and confirm images/assets actually render on both, not
   just that the page returns 200 — a base-path mismatch can leave assets broken while the page still loads fine.
2. **Bring over what's builder-agnostic first, using the "SE Page Transfer" plugin.** How this step starts depends
   on whether a bundle was already provided:
   - **If {{bundleZipPath}} is a real path**: skip straight to uploading it — confirm SE Page Transfer is installed
     and active on {{wpSiteDir}} (if it isn't, stop and ask the user to install it — don't add it yourself), then use its Upload form
     (Tools → Page Transfer in wp-admin) to upload that exact file.
   - **If the bundle line above is blank**: don't try to log into {{siteUrl}}'s wp-admin and drive its
     Download form yourself — that's a real click-through-a-form action better done by a human once than automated
     unreliably here. Instead: confirm whether SE Page Transfer is installed and active on {{siteDir}} (if it isn't,
     say so in the same report below — don't add it yourself), then **stop this step and report back** asking the user to open Tools → Page
     Transfer on {{siteUrl}}, download the bundle for {{pageUrl}}, and re-run this prompt with that file's path
     filled into Settings → Site → Bundle. Don't guess at a path or proceed with the rebuild using no bundle at all.

   Either way, once the bundle is uploaded: this creates a draft page on {{wpSiteUrl}} at the **same slug** as the
   source page (deduplicated with a numeric suffix if that slug is already taken there), with its media already
   re-hosted in the target's own library as real attachments (not just copied files), any Contact Form 7 form it
   uses already recreated and republished, and any nav menu item pointing at it already added to a same-named menu
   on the target, correctly placed at the end. Read the import's own success notice carefully — anything it reports
   it couldn't do automatically (an unmatched menu name, a site-wide header-button reference it found but didn't
   touch) needs manual follow-up later in this same task, and belongs in the final report either way. (SE Page
   Transfer v1.4.1+ is required for all of the above — slug preservation, proper attachment creation instead of a
   silently-broken media reference, and correct end-of-menu placement were all real bugs fixed across v1.3.1–1.4.1;
   if the installed copy predates that, **don't update it yourself** — stop and report the installed version and
   that v1.4.1+ is needed, so the user can update it. Don't work around the known bugs either: the import would
   silently produce broken media references or a misplaced menu item, which is worse than pausing for a one-time
   manual update.)
3. **Don't reuse the imported page's `post_content` as-is.** It's the source builder's raw markup (WPBakery
   shortcodes, or whatever the source actually uses) — the target builder can't render it at all, and left in place
   it shows as literal bracket-text on the page, not a design. Screenshot the *source* page
   ({{siteUrl}}{{pageUrl}}) at mobile, tablet, and desktop widths, and use those screenshots — plus the media already
   uploaded to the target's library in step 2 — as the reference for rebuilding the page from scratch in {{builder}}
   on the imported draft. Match layout, spacing, colors, and copy as closely as the target builder allows, the same
   way Build matches an original design against a WordPress rebuild — just scoped to this one page instead of the
   whole site. Build mobile-first, same standing discipline as Build/Create: confirm each section's mobile
   appearance against the mobile screenshot before adding Tablet/Desktop overrides, rather than building the whole
   page at desktop width and checking mobile only as an afterthought.
4. Wire the form imported in step 2 into the rebuilt layout. How: {{formHandling}}
   - If the source form used a multi-column field layout and the target's CSS needs to approximate it, and the form
     uses Contact Form 7's Conditional Fields plugin (`wpcf7cf`), don't use float/`nth-of-type` pairing for the
     column CSS — `wpcf7cf` wraps every conditional group in its own `<div data-class="wpcf7cf_group">`, which is
     always present in the DOM (even when hidden), and this throws off odd/even sibling-index tricks. Use CSS Grid
     instead: `display:grid` on the form with `display:contents` on every `[data-class="wpcf7cf_group"]` wrapper, so
     grid auto-placement flows through them correctly regardless of which groups are shown or hidden. If a
     conditional field sits *between* two fields that should visually pair with each other (e.g. source order is
     A, [conditional B], C — and A+C should share a row, with B on its own row when visible), don't try to detect
     this with CSS alone (no reliable "next visible sibling" selector survives WordPress's CSS sanitization) — give
     the *conditional field itself* (B) an explicit marker class (e.g. `full-row`) matched to a plain
     `grid-column:1/-1` rule. A full-width item can't fit into a row that's already half-filled, so grid
     auto-placement pushes it to its own row and backfills the gap it left with whatever comes next — this pairs A
     and C automatically, whether B is visible or not, with zero JS and no field-specific selector.
   - Modern Contact Form 7 (5.1+) stores the actual form definition in the `_form` **postmeta** field, not
     `post_content` — editing `post_content` directly has no effect on what's rendered. If a form's field markup
     needs changing, edit `_form`.
   - Style the `<select>` element as its own separate rule, not lumped into the same rule as text inputs. The target
     theme (e.g. Astra) commonly ships its own default `select` styling that can win over an author rule targeting
     `input, select, textarea` together depending on load order/specificity, producing a visibly different
     padding/height on the one `<select>` in the form versus the text inputs beside it (e.g. a dropdown's text
     looking cramped or clipped while every text field looks fine). Write the select-only rule plain first and check
     `getComputedStyle()` on the actual `<select>` — a same-specificity separate rule usually already wins by source
     order alone (author CSS loads after the theme's), so `!important` often isn't needed at all; add it only if the
     computed style shows the theme's rule is still winning.
   - If testing conditional-field behavior surfaces a validation error on a field you didn't touch (e.g. selecting
     one dropdown shows "this field is required" under an unrelated, still-blank field), that's normal CF7 5.1+ live
     validation — it validates the whole form on any interaction, not just the touched field — not a bug introduced
     by the rebuild. No action needed unless the source form demonstrably behaves differently.
5. If step 2 reported an unmatched menu (a menu name on the source that doesn't exist on the target), add an
   equivalent nav entry to whichever menu on {{wpSiteUrl}} is the closest match, pointing at the rebuilt page — don't
   leave the page unreachable from navigation just because the exact source menu name didn't exist on the target.
6. If step 2 also reported a site-wide header reference (a theme header-builder button linking to this page on the
   source — e.g. Betheme's own header button system), don't try to reproduce that exact mechanism on {{wpSiteUrl}}
   (it's theme-specific and touching a site-wide option for one page's sake is more than this task should do).
   Instead, just add a regular nav menu item for the rebuilt page to whichever menu on {{wpSiteUrl}} is used as the
   site's main/primary navigation — same as step 5's mechanism, just triggered by a header reference instead of an
   unmatched menu name. The goal is simply that the page is reachable from the header somehow, not an exact visual
   match of the original button.

Verify the result directly rather than assuming it worked: screenshot the rebuilt page on {{wpSiteUrl}} at mobile,
tablet, and desktop widths and compare side-by-side against the original source screenshots from step 3 — confirm a
genuine visual match, not just "the content exists somewhere on the page." Submit the form for real (an actual test
submission) to confirm it functions, not just that it looks right. Confirm the nav entry (existing or newly added)
actually links to the rebuilt page.

If any fix along the way is made by editing postmeta directly (via wp-cli/eval) rather than through Elementor's own
editor UI, verify against the actually-*served* page, not just the saved data — a correct value in `_elementor_data`
doesn't guarantee it's what renders. Elementor caches rendered widget output in a separate `_elementor_element_cache`
postmeta key that a direct edit won't invalidate; delete it after any such edit so the page re-renders from the
current data. The same applies to any lingering revision post for the page — if one exists, Elementor's preview can
prefer its (older) data over the main post's. On Elementor 4.x specifically, there's a *third* layer on top of both:
site-wide `elementor_atomic_cache_validity__*` options (its newer atomic-widgets architecture) can also mask a direct
edit even after the two post-level caches above are cleared — if a change still isn't rendering with those cleared,
delete these options too (`wp option list --search="elementor_atomic_cache_validity*"` to find them) before assuming
something else is wrong.

This element cache isn't only on the page itself — it exists on *any* Elementor-managed post whose rendered output
your change affects, even indirectly. Adding a nav menu item (steps 5/6) changes what the site's header renders, and
if that header is an Elementor Theme Builder template (its own post, e.g. "Elementor Header"), *that* post can be
serving a stale cached render of the old nav order/content — showing up as a menu item appearing in the wrong
position or the page area rendering blank, even though the page's own data and the menu item's own `menu_order` are
both correct. `wp post list --post_type=elementor_library` finds these template posts; clear the same
`_elementor_element_cache` key on the relevant one (header/footer) after any change that touches site-wide
navigation, not just on the page being rebuilt.

Leave the rebuilt page as a **draft** — this is a first pass at a cross-builder rebuild, not something to publish
without a human review, matching the Page Transfer import's own default.

If you started either site's dev server yourself, stop it again once you're done. Leave whichever was already
running as you found it.

Finish with one report posted in chat covering:
- The page rebuilt, with direct URLs to view it on both {{siteUrl}} (original) and {{wpSiteUrl}} (rebuilt draft).
- What step 2's automatic transfer handled, what steps 5/6 added to navigation (which menu, and whether it was
  triggered by an unmatched menu name or a header reference), and what still needs manual follow-up — the one
  remaining case is a form shortcode flagged as unrecognized (SE Page Transfer only transfers Contact Form 7, so a
  Gravity Forms/WPForms/etc. embed needs recreating by hand) or anything else step 2 flagged.
- Results of the final visual/functional comparison — anything that didn't match and was fixed, and anything that's
  still a known gap.

Also save this same complete report to {{wpSiteDir}}/reports/rebuild-page-report.md (create the folder if needed;
overwrite any previous version) — the whole report exactly as posted in the chat, not a summary, so it exists
independent of chat history.
