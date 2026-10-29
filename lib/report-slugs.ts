/**
 * Slugs readable off disk as {wpSiteDir}/reports/{slug}-report.md: the review
 * family (feeds Change), analyze/analyze-page/analyze-header/analyze-footer/
 * analyze-menu/analyze-global-styles (feed Build and Create). Deliberately
 * excludes build/rebuild-page/create/custom-prompt — those aren't inputs to
 * any later step — and change-report.md itself (which would otherwise let a
 * second Change run feed on the output of the first).
 *
 * review-images is included: its candidate list is exactly a findings-to-fix
 * report, and the conversion it feeds is a normal Change pass like any other
 * review's (change.md has a branch for it). Leaving it out is what silently
 * broke the Images -> Change handoff — the fetch 400s and Change falls back to
 * the chat transcript, which looks like it worked right up until it doesn't.
 *
 * Doubles as path-traversal protection — a slug reaches path.join() (in the
 * report-fetch API route, and in chat-sessions' auto-resume) only if it
 * matched one of these exactly. Shared between both for that reason: they'd
 * otherwise need to be kept in sync by hand.
 */
export const READABLE_REPORT_SLUGS = new Set([
  "analyze",
  "analyze-page",
  "analyze-header",
  "analyze-footer",
  "analyze-menu",
  "analyze-global-styles",
  "review-images",
  "review-ui",
  "review-page",
  "review-header-footer",
  "review-accessibility",
  "review-performance",
  "review-best-practices",
  "review-seo",
  "review-cache",
  "review-important",
  "review-theme",
  "review-pre-migration",
]);
