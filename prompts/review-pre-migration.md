Review the WordPress codebase at {{wpSiteDir}} (it runs at {{wpSiteUrl}}) for the specific class of bug that causes
problems when this site is migrated to a live host — hardcoded URLs and exposed backup files. Do
not make any code or content changes yet — this is a comparison + reporting task only, same as the other review
prompts.

This review is scoped to {{wpSiteDir}}/{{wpSiteUrl}} only, checking the *local* codebase's readiness before a
migration happens — not the live deployed site (there's a separate Migration Guide runbook for what to do during and
after the actual migration; this review is the "before you start" check). Don't compare against {{siteUrl}}/{{siteDir}}
at all — this has nothing to do with matching the original design.

Track your progress through the steps below with the TodoWrite tool as you go, so progress is visible in the
dashboard.

1. Check that {{wpSiteUrl}} is actually reachable before reviewing it — it should already be running from earlier
   steps. Do not start it yourself: if it isn't reachable, stop here and report that back instead of spending time
   bringing it up.
2. **Hardcoded URLs in code**: search every theme file and every script in {{wpSiteDir}}/scripts/ for a literal,
   hardcoded absolute URL (the site's own current address — {{wpSiteUrl}} — or any other literal
   domain/IP) used where `home_url()`/`site_url()`/a relative path should be instead — a nav link, a logo link, a
   footer link, anything meant to point at "this site" rather than a genuinely external destination. A hardcoded
   reference to a real third-party URL (a social profile, an external API) is fine and not a finding; a hardcoded
   reference to *this site's own current address* is the actual problem, since it won't update when the site moves.
3. **`wp-config.php` constants**: check whether `WP_HOME`/`WP_SITEURL` (or `DB_HOST`/`DB_NAME`/etc.) are hardcoded as
   PHP constants there. This isn't necessarily a bug — but note it as a reminder either way, since `wp-config.php` is
   typically *not* included in a migration export (it contains environment-specific values on purpose), so any
   constants defined there need to be set correctly by hand on the destination, independent of whatever the
   migration tool does to the database.
4. **Database-wide sanity check**: run `wp search-replace '<site-url>' 'PLACEHOLDER_CHECK' --dry-run
   --all-tables --precise`, where `<site-url>` is {{wpSiteUrl}} with any trailing slash stripped — the unslashed
   form matches both `{{wpSiteUrl}}wp-content/...` and a bare occurrence of the address, while the slashed form
   silently misses the latter. Use that address and nothing else: never substitute a port you remember from another
   project or saw in an example, since a search for a URL this site was never served on returns zero matches and
   reads exactly like a clean result.

   **Zero or near-zero matches is a red flag, not a pass.** On a real site this address appears in hundreds of rows,
   concentrated in `wp_postmeta`, because page builders store absolute URLs throughout their saved content. If the
   count comes back near zero, verify {{wpSiteUrl}} really is the address the site is served on before concluding
   anything — and if it still comes back near zero after that, report it as a finding rather than a pass: it means
   the migration tool's own destination find-replace will have nothing to key on either.

   **Then run the same dry-run a second time against the backslash-escaped form of the address** — search
   `http:\/\/<host:port>` (the `\/` typed literally) instead of `http://<host:port>`, and report its count as a
   separate number alongside the first. Page builders that store their layout as JSON escape forward slashes via
   `json_encode`, so Elementor's `_elementor_data` postmeta physically contains `http:\/\/localhost:PORT\/wp-content\/...`.
   That text does not match a plain `http://` search — different bytes — and `--precise`/`--recurse-objects` don't
   help, since this is JSON string escaping inside a value rather than PHP serialization. A migration tool's own
   destination find-replace has the same blind spot. Report both counts explicitly: **a large plain-form count is
   not evidence the escaped form is clean**, and a non-zero escaped count is a finding in its own right — it's
   precisely the URLs that will survive migration and produce broken builder backgrounds and dead widget links on
   the live site. Say in the report how migration should cover each half: the builder's own URL tool for its data —
   when {{builder}} is Elementor that's **Tools → Replace URL** (CLI: `wp elementor replace-urls <from> <to>`), which
   escapes the slashes itself and clears the compiled-CSS cache in the same call, so it beats hand-typing `\/`
   strings into a search-replace plugin; check for the equivalent tool if the builder is a different one — plus an
   ordinary plain-URL pass for everything the builder tool doesn't own (menu-item
   URLs, plugin options, post content, `siteurl`/`home`). Note that neither pass substitutes for the other. Name
   the affected `meta_key`s
   (`wp db query "SELECT meta_key, COUNT(*) FROM wp_postmeta WHERE meta_value LIKE '%<host:port>%' GROUP BY meta_key"`)
   so it's clear which builder data is at risk.

   Review the results — not just the replacement
   count, but what's actually being matched. Expected/fine: image and attachment URLs, standard post/page content
   generated through normal WordPress/Elementor mechanisms. Worth flagging as a finding: any match inside a place
   that suggests a raw, hand-typed absolute URL got saved somewhere unexpected (a widget setting, an option value)
   rather than being generated dynamically — since those specifically won't get corrected by a migration tool's own
   destination-address find-replace unless this exact database-level check happens to already catch them. Don't
   assume any particular migration tool is in use, here or anywhere else in this review: which one (if any) the user
   migrates with is their choice and may change between runs, so describe what the destination needs in terms of the
   passes that have to happen, not the buttons of one plugin. Report whichever tool you actually observe installed
   rather than the one you expected.
5. **Non-deliverable email sender domains**: placeholder From/sender addresses on a domain that doesn't accept mail
   — `@localhost`, `@example.com`, `@example.org`, `@test`, or the local dev host — survive a migration silently and
   cause form notifications to be rejected or spam-filtered on the live host. Step 4 will not catch these: they have
   no scheme or port, so they don't match a `http://<host>` search-replace. Check each of:
   - The active form plugin's mail settings. For Contact Form 7 that's the `_mail` and `_mail_2` postmeta on every
     `wpcf7_contact_form` post (read them with `wp db query`), specifically the `sender` and `recipient` keys —
     equivalent settings for whatever form plugin is actually active. Report each mail template's `active` flag
     alongside the finding: an inactive template (`active` = 0) never sends, so it's a low-severity cleanup, while an
     active one is a genuine break.
   - `admin_email` in `wp_options`, plus any plugin option storing a From address (an SMTP plugin, WooCommerce,
     a newsletter plugin).
   - Theme files, for literal placeholder addresses in `mailto:` links or `wp_mail()` calls.
   Report these as **fix-at-migration-time**, not as something to correct now: the destination domain generally
   isn't known while the site is still local, and no value that can be written today is both non-local and correct
   later. Say explicitly that the fix is to keep the existing local part and swap only the domain once it's known
   (`hello@localhost` becomes `hello@<the real domain>`) — do not invent a domain, do not write a literal
   placeholder like `hello@domain` or `hello@example.com` (that's the same bug wearing a different hat), and do not
   substitute a generic `noreply@`, since the existing local part is usually a deliberate choice. Note alongside it
   that the resulting mailbox should exist or alias to a real one, so bounces and any reply ignoring `Reply-To`
   aren't lost, and that a host sending through authenticated SMTP may require the From address to match the
   authenticated account — in which case that account wins over the local part.
   For each finding, also note whether a `Reply-To` header is already set, since a
   correct Reply-To means a wrong From affects deliverability only, not whether replies reach anyone. Add a reminder
   that whichever domain is chosen needs SPF (and ideally DKIM) covering the server that sends the mail — a From
   address on a domain with no SPF record gets spam-filtered about as reliably as `@localhost` did.
6. **Exposed backup/export folders**: check for any directory a migration/backup plugin writes to inside the served
   webroot (e.g. `wp-content/ai1wm-backups/`, or equivalent for whatever migration tool is active) — confirm it has
   its own protection against directory listing (an `.htaccess` disabling `Indexes`, or a blank `index.php` stub) and
   isn't just relying on an unguessable filename alone. Also check whether any actual backup file is currently sitting
   there — if so, note it as a finding regardless of whether the folder itself is protected, since a completed backup
   left in the webroot indefinitely is still a real exposure risk if the filename ever leaks.

Then write a concrete, numbered findings report — one entry per issue, each stating: what's wrong, where (file/path/
plugin name), why it matters for a future migration specifically, and severity. If a category has no issues, say so
briefly rather than padding the report. Order it with anything that would actively break URLs on migration first,
then anything that would break email delivery on the live host, then backup-exposure findings.

Present the finished report here in the chat — don't start fixing anything yet.

Also save the complete, final report to {{wpSiteDir}}/reports/review-pre-migration-report.md (create the folder
if needed; overwrite any previous version) — the whole report exactly as presented in the chat, not a summary, so it
exists independent of chat history.
