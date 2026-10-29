Scan the WordPress media library at {{wpSiteDir}} (site: {{wpSiteUrl}}) for images worth converting to WebP, and
present a candidate list for review — **do not convert or change anything yet**, this step is listing only.

Track your steps with the TodoWrite tool as you go.

1. List every media attachment via wp-cli (`wp media list --field=ID --path=/var/www/html --allow-root` via the
   `wpcli` container — see credentials note below), then for each one check its actual file: current format, file
   size, and pixel dimensions. Skip anything already `.webp`, `.svg`, or an animated `.gif` (WebP animation support is
   inconsistent enough not to touch blindly, and SVG is already vector/tiny) — only JPEG/PNG originals (and their
   generated size variants — `-150x150`, `-300x232`, etc.) are candidates.
2. For each surviving candidate, also check where it's actually used and at what rendered size — grep every page's
   `_elementor_data` postmeta and any `widget_block`/theme-option content referencing that attachment's filename, and
   note the file/page it appears on. An image that's unused anywhere (an orphaned upload) is still worth flagging,
   just note it as "unused" rather than skipping it.
3. Sort candidates by file size, largest first. Build a numbered list, each entry showing: filename, current
   format/size/dimensions, where it's used (page + rendered display size, or "unused"), and the size of every
   generated variant that would also need converting alongside the original.

Present the numbered candidate list here in the chat, plus a rough total-bytes-saved estimate (WebP at quality ~80
typically saves 25-35% over PNG/JPEG at equivalent visual quality — say so as an estimate, not a promise).
**Do not convert anything in this run** — this step lists, the following Change run converts, the same way every
other review hands its report to Change.

Because Change converts whatever the saved list contains, the list *is* the decision: don't end by asking which
entries to convert. Instead, leave in the list only what should actually be converted, and put anything you're
deliberately not converting under a separate **Excluded** heading with a one-line reason (a logo that needs to stay
PNG for transparency-sensitive use, an image whose only variants are already tiny, an unused orphan not worth
touching). Change reads the candidate list and ignores the Excluded section, so an image's presence in the list is
what authorises converting it — which means don't pad the list with entries you're unsure about, and say plainly in
the chat summary what you excluded so the user can push back before running Change.

WordPress credentials: never reset, change, or create user accounts or passwords, under any circumstances. Use the
existing `wpcli` container if one exists (`docker ps`, or check {{wpSiteDir}}/compose.yml for a `wpcli` service) —
`docker exec wpcli wp <command> --path=/var/www/html --allow-root`. If none exists, add one (official `wordpress:cli`
image, sharing the WordPress container's volume/DB, entrypoint overridden to stay running) rather than falling back
to a credential change.

Also save the complete candidate list to {{wpSiteDir}}/reports/review-images-report.md (create the folder if needed;
overwrite any previous version) — the whole list exactly as posted in the chat, including the Excluded section, so it
exists independent of chat history even before anything gets converted. This file is what the next Change run reads,
so it has to stand on its own: an entry that only makes sense alongside something said in the chat won't survive.
