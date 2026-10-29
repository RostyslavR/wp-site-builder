/**
 * Shared between chat-sessions' server-side auto-resume (reads report files
 * directly off disk) and the client's manual Continue button (reads them via
 * the report API route) — same wording either way, so a resumed task reads
 * identically whether it was triggered automatically or by clicking Continue.
 */
export interface ContextReportSection {
  slug: string;
  content: string;
}

export function formatContinueContextBlock(label: string, sections: ContextReportSection[]): string {
  if (sections.length === 0) return "";
  return (
    `\n\nThe report(s) this task (${label}) is working from — re-read them directly below rather than trusting ` +
    `whatever's still in context, since a long session's context can get compacted in a way that keeps the ` +
    `general shape of a plan while losing its precise numeric detail:\n\n` +
    sections.map((s) => `## ${s.slug}-report.md\n\n${s.content}`).join("\n\n---\n\n")
  );
}
