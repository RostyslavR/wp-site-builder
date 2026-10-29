# WordPress Migration Runbook

Run "Pre-Migration" in the dashboard first (checks the local codebase, not the live site).

## 1. Import

- [ ] Export locally, import on the destination, let it fully finish. Don't worry about getting Settings → General
      right beforehand — step 2 fixes whatever URL it ends up with, unconditionally.

## 2. Run Better Search Replace — the actual assurance step

- [ ] Install **Better Search Replace** on the destination (wp-admin → Plugins → Add New → search for it) if it
      isn't already there. Free, no SSH needed.
- [ ] Look up the old URL before searching for anything — the local site's own address, copied exactly from
      Settings → General on the **local** install (or the dashboard's WP site → URL field). The port is
      per-project, not a constant: don't assume `:8080` or reuse the port from a previous migration. Getting this
      wrong is the single most common way this whole step silently does nothing.
- [ ] Tools → Better Search Replace. Search for that URL — plus the bare IP too, if the destination was ever set up
      on one first — and replace with the real final domain.
- [ ] Run it against **all tables**, with "Run as dry run first" checked. **A dry run reporting zero or near-zero
      matches means you searched for the wrong URL — it does not mean the site is clean.** A real migration matches
      hundreds of rows, concentrated in `wp_postmeta`, since page builders store absolute URLs throughout their
      saved content. Confirm the count is large and plausible, then run it for real.
- [ ] Update Settings → General to the real domain too (belt and suspenders — the plugin fixes content, this
      confirms the site's own setting matches).
- [ ] Regenerate the page builder's cached CSS. Builders compile stylesheets to disk
      (Elementor: `wp-content/uploads/elementor/css/post-*.css`), and Better Search Replace only rewrites the
      database — those files keep serving the old URLs until they're rebuilt. Elementor → Tools → **Regenerate
      Files & Data**; other builders have an equivalent, and a builder with no CSS cache needs nothing here. Skip
      this and images stay broken even though the database is now correct.
- [ ] Fix email sender addresses by hand — Better Search Replace won't catch them, since a bare `@localhost` has no
      scheme or port and doesn't match the URL you searched for. Keep the existing local part, swap only the domain
      (`hello@localhost` → `hello@<real domain>`). Check the form plugin's mail settings (Contact Form 7: Contact →
      Contact Forms → each form → Mail tab, including Mail (2) if enabled), Settings → General's admin email, and
      any SMTP plugin's From address. Pre-Migration's report lists the exact ones it found.

## 3. Verify

- [ ] Nav/footer/logo links point at the real domain, not the IP or `localhost`.
- [ ] Images load.
- [ ] Open DevTools → Network on a few pages (including one heavy page-builder layout) and confirm nothing requests
      `localhost` or a private IP. Sort by Status and look for requests stuck at `Pending` — that's the tell. A
      browser prompt asking to "access other apps and services on this device" is this exact failure, and it means
      step 2's URL was wrong or the builder's CSS was never regenerated.
- [ ] `/robots.txt` and the sitemap reference the real domain.
- [ ] Submit the contact form once and confirm the notification actually arrives — check spam, and confirm the
      From address is on the real domain. If it lands in spam, the sending domain likely needs SPF/DKIM records.
- [ ] If anything's still wrong, re-run Better Search Replace rather than hand-patching individual pages.

## 4. Go-live

- [ ] Settings → Reading → uncheck "Discourage search engines."
- [ ] Confirm HTTPS is enforced.
- [ ] Decide on any locally-bypassed plugin license before shipping it live.

## 5. Bare-IP / firewall (separate problem — web-server level, not WordPress)

Origin must reject requests that aren't for the real domain, or a CDN in front of it (Cloudflare etc.) can be
bypassed entirely by hitting the IP directly.

- [ ] Web server only serves the real `Host` header — bare IP gets nothing.
      - SSH available → default/catch-all vhost with no `ServerName` (Apache) or `return 444;` (Nginx).
      - Not available → check the hosting panel handles this per-domain; ask support if unsure.
- [ ] If using Cloudflare: allowlist its IP ranges at the origin (or Authenticated Origin Pulls).
      - SSH available → `ufw`/`iptables` directly.
      - Not available → hosting panel firewall screen, or support.
- [ ] Re-check after any server rebuild — this can silently reopen.
