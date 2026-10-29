Review whether the WordPress site at {{wpSiteDir}} (it runs at {{wpSiteUrl}}) has browser caching configured for its
static assets. Do not make any code or content changes yet — this is a comparison + reporting task only, same as the
other review prompts.

This review is scoped to {{wpSiteUrl}}/{{wpSiteDir}} only, and to caching specifically — page-weight/image/font
findings belong to the Performance review, not here.

{{liveReviewNote}}

Track your progress through the steps below with the TodoWrite tool as you go, so progress is visible in the
dashboard.

1. Check that {{wpSiteUrl}} is actually reachable before reviewing it — it should already be running from earlier
   steps. Do not start it yourself: if it isn't reachable, stop here and report that back instead of spending time
   bringing it up.
2. Identify which web server is actually serving {{wpSiteUrl}} before assuming how a fix would even be applied —
   Apache and Nginx use completely different mechanisms, and a fix aimed at the wrong one would silently do nothing.
   Check the `Server` response header first (`curl -I {{wpSiteUrl}}`) — this works even with no server access at all,
   which matters most when reviewing a live deployed URL (see any live-review note above). If server access exists
   (local Docker/wp-cli), confirm directly rather than trusting the header alone, since it's sometimes deliberately
   hidden or overridden: check for a running `apache2`/`httpd` or `nginx` process/binary, or check the project's own
   `compose.yml`/Dockerfile for which image is in use. If the server can't be identified at all (e.g. a live URL with
   a suppressed/generic `Server` header and no other access), say so explicitly and give fix guidance for both
   possibilities in the report rather than guessing one.

   **If a CDN/proxy is in front, the `Server` header is the CDN's, not the origin's — and so is every cache header
   you can see.** `Server: cloudflare` (or `cf-ray`/`cf-cache-status`/`via`/`x-cache` present) means a live review
   cannot determine the origin's web server *or* its caching config at all: you are measuring the edge. Don't report
   the CDN's `cache-control` as the site's, and don't prescribe an Apache or Nginx fix you can't confirm applies.
   Say plainly in the report that a proxy was detected, that the live figures describe the CDN layer, and that the
   origin's own configuration has to be reviewed against the local environment instead — that is where the real
   server, its config files, and the project's own compose/Dockerfile are visible. Two things are still worth
   reporting from the live side even then: whether the edge supplies text compression (`content-encoding`), and
   whether HTML is cached at all (`cf-cache-status: DYNAMIC` means it isn't) — noting for both that they are the
   CDN's behaviour and would disappear if the site ever moved to DNS-only.
3. Check whether a caching plugin is already active (`wp plugin list` via wp-cli, if server access exists — if
   reviewing a live URL with no wp-cli access, skip this specific check and note it as unverified rather than
   guessing).
4. Check whether `WP_CACHE` is defined in `wp-config.php` (same access caveat as above).
5. Confirm empirically whether caching headers are actually present, regardless of what steps 3-4 suggest — a plugin
   being active doesn't guarantee it's adding headers, and a directive can exist with no plugin at all: `curl -I` a
   handful of static assets (a theme CSS file, an enqueued JS file, an uploaded image) on {{wpSiteUrl}} and check for
   a `Cache-Control` or `Expires` response header, noting the actual `max-age`/`Expires` value found on each. If a
   caching plugin **is** active (step 3) but headers still aren't present, name that specific plugin in the finding
   and note it needs its own settings configured — that's a configuration gap in an existing plugin, not a case for
   installing a different one.

If real, working caching is already found in step 5, say so clearly and treat this as a page with no material
issues — don't invent a nitpick (e.g. "the max-age could be longer") unless the value found is genuinely
unreasonably short for the asset type.

If no caching headers are present and no plugin needs reconfiguring instead, write this up as a finding: state that
no browser caching is configured for static assets, and give fix guidance matched to the web server identified in
step 2 — **never installing a new caching plugin either way**, since this project's standing preference is to
configure caching directly at the server level:
- **Apache:** a distinct block in `.htaccess` using `mod_expires`/`mod_headers` (commonly already available without
  a plugin) — confirm both modules are actually loaded before relying on them, and note if neither is.
- **Nginx:** `.htaccess` is not read by Nginx at all and must not be suggested as the fix here — the equivalent is an
  `expires`/`add_header Cache-Control` directive inside a `location` block matching static file extensions, in the
  site's actual server-block config file (commonly under `/etc/nginx/sites-available/` or wherever this deployment
  keeps it) — and unlike Apache's `.htaccess`, changing it requires an explicit Nginx reload (`nginx -s reload` or
  equivalent) to take effect, which is worth calling out since it's easy to edit the config and then wonder why
  nothing changed.
- **Server unidentified:** report both fix directions above (labeled clearly, e.g. "if Apache, do X; if Nginx, do Y")
  rather than picking one to guess with, and note that confirming the actual server (e.g. by asking whoever manages
  the deployment) is a prerequisite before this can be fixed.

Either way, long cache lifetimes (e.g. 1 year) are safe for images/fonts and for any CSS/JS WordPress version-stamps
via a `?ver=` query string on enqueue, since the URL itself changes whenever the underlying file does.

Then write a concrete report — either "caching is already configured" with the confirmed header values, a
plugin-reconfiguration finding naming the specific plugin, or a single finding describing what's missing with the
server-matched fix direction above, with severity (this is generally a real, sitewide, low-risk, high-value fix when
missing — High severity).

Present the finished report here in the chat — don't start fixing anything yet.

Also save the complete, final report to {{wpSiteDir}}/reports/review-cache-report.md (create the folder if needed;
overwrite any previous version) — the whole report exactly as presented in the chat, not a summary, so it exists
independent of chat history.
