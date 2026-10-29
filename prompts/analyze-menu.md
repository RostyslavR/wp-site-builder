Investigate the navigation structure of the reference design at {{siteDir}} (it runs at {{siteUrl}}) and write a
build-ready plan for it. **Analysis only — make no changes to either site**, including the live WordPress site's
own current menus.

This is about the nav's **content and structure** — labels, order, and where each item actually goes — as distinct
from the header/footer's visual styling (see Analyze: Header / Analyze: Footer for that).

Before executing, make sure {{siteUrl}} is actually reachable — if it isn't already running, start it yourself
(find and use whatever PORT/BASE_PATH/env vars the project requires, the same way Install Site would).

1. Document every nav item on the design (header and footer both, if they differ) in order, with its exact label
   and **link type**: a real page, a same-page anchor (`#section`), or an external URL — and the literal target for
   each (the anchor id, or the external URL). Getting this distinction right matters: a nav widget that
   auto-populates from a page tree will silently drop anchors and inject items that were never in the design.
2. Read-only inventory of the WordPress site's **current** live menu structure — don't change anything:
   `wp menu list` for every registered menu, then `wp menu item list <menu>` for each, noting which theme location
   (if any) each is assigned to.
3. Note where the design's nav and the current live nav plainly diverge (different item count, items with no
   counterpart on either side) — document the difference, don't decide how to reconcile it. That's a real content
   decision for the user, not something to resolve here or silently default on.

Finish with a report posted in chat covering the design's nav structure (step 1), the current live menu inventory
(step 2), and the divergences noted in step 3. Also save this same complete report to
{{wpSiteDir}}/reports/analyze-menu-report.md (create the folder if needed; overwrite any previous version) — the
whole report exactly as posted in chat, not a summary, so it exists independent of chat history.
