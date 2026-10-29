Review how closely ONE page of the WordPress rebuild matches its original design — a narrower, faster sibling of
Review UI, not a replacement for it: Review UI screenshots every page and catches whatever's visibly different across
the whole site; this one is a deep, single-page audit, useful right after a Create: Page run without waiting for (or
re-running) a full-site pass. Do not make any code or content changes yet — this is a comparison + reporting task
only, same as the other review prompts.

**The page to compare:**
- **Design page (path on {{siteUrl}}):** {{designPagePath}}
- **WordPress page (slug on {{wpSiteUrl}}):** {{newPageSlug}}

If either line above is blank, stop here and report back asking for it to be filled in (Settings → Site → Page for
the design path, Settings → WP site → Slug for the WordPress slug) — don't guess either one, and don't fall back to
matching pages up by title or position. A wrong guess here makes every finding below compare the wrong two pages
without any obvious sign that happened.

Site identity — get this right before writing anything, mixing it up makes every finding backwards and actively
misleading: {{siteUrl}}{{designPagePath}} (source at {{siteDir}}) is the ORIGINAL design page being matched — the
reference, never to be edited. {{wpSiteUrl}}/{{newPageSlug}} (source at {{wpSiteDir}}, using {{builder}}) is the
WORDPRESS REBUILD being graded — the one whose fixes this report is for.

{{liveReviewNote}}

**Read the previous version of this report if one exists on disk, and honour its accepted divergences** — carry
forward any finding it marked as an **accepted divergence** (a deliberate difference from the original, asked for on
purpose) as a single line rather than re-arguing it, and never write it up again as a fresh parity mismatch. A
difference that looks deliberate but isn't recorded yet still gets reported normally, flagged as possibly
intentional and worth marking accepted — don't assume either way.

Track your progress through the steps below with the TodoWrite tool as you go.

1. Confirm both pages are actually reachable before comparing them — {{siteUrl}} and {{wpSiteUrl}} should already be
   running from earlier steps; don't start either yourself, and if one isn't reachable, stop and report that back
   instead. Verify images and other assets actually render on both, not just that each page returns 200 — a
   base-path mismatch can leave assets broken while the page still loads fine, which would corrupt this entire
   review.
2. Screenshot both pages at mobile, tablet, and desktop widths.
3. **Structure.** Walk both pages top to bottom, section by section, and compare what each section contains
   (heading, copy, imagery, CTAs, interactive elements) — a missing section, an extra one, or sections in the wrong
   order is a finding on its own, independent of how well-executed any individual section is.
4. **Exact design values**, section by section — colors, fonts/sizes/weights, spacing, container widths — read via
   `getComputedStyle` on both sides, not eyeballed. Note anywhere the rebuild diverges from the design page
   specifically, not from the site's shared design system in general (that's Review UI's job at the whole-site
   level).
5. **Media.** Every image/icon the design page uses should have a rebuild counterpart with matching content and
   alt-text role (content vs. decorative) — flag anything missing, swapped, or added that the design page doesn't
   have.
6. **Copy.** Compare actual text content, not just presence of a text block — a paraphrase, a dropped sentence, or a
   stale placeholder left in from scaffolding is a finding.
7. **Interactive elements.** For any form, accordion, slider, or similar widget, actually exercise it on both sides
   (submit a form, open an accordion panel, advance a slider) rather than assuming matching markup means matching
   behavior — field list, validation, and interaction behavior should match, styled to fit this site's own
   conventions per the standing form-handling rule Create/Rebuild Page already follow.
8. **Site-quality, on its own merits** — independent of the comparison above: does this one page hold up as good,
   consistent, modern UI? Inconsistent spacing between similar elements, a component that looks dated or unfinished,
   an awkward gap — worth flagging even where the original mockup has the same flaw, since the goal is a genuinely
   good page, not just a faithful copy of whatever the original happened to get right or wrong.

Then write a concrete report, numbered, ordered most-impactful first: for each finding, which section/element, what
the design has vs. what the rebuild has (exact values where relevant), and whether it's a **parity mismatch** (fix by
matching the original) or a **site-quality finding** (fix by improving past what's there, per step 8) — Change reads
this label to know which standard applies. If a category above has no issues, say so briefly rather than padding the
report.

**Anything you measured that differs belongs in the numbered findings** — don't demote a real measured difference to
a closing remark or a parenthetical aside; Change fixes the numbered list, so anything outside it never gets fixed.
If a difference is genuinely not worth fixing, it still gets a number, plus one line saying why it's being left.

Present the finished report here in the chat — don't start fixing anything yet.

Also save the complete, final report to {{wpSiteDir}}/reports/review-page-report.md (create the folder if needed;
overwrite any previous version) — the whole report exactly as presented in the chat, not a summary, so it exists
independent of chat history.
