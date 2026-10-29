/**
 * Prepended to every prompt template fetched below — one standing pointer at
 * a per-project notes file, rather than copy-pasted into all ~23 prompt
 * files individually (and inevitably drifting once one gets edited and the
 * rest don't). prompts/*.md is the *shared*, generic prompt library, reused
 * across whatever project this dashboard happens to be pointed at; a real
 * project accumulates its own one-off facts along the way (a decision this
 * project made where the shared prompts don't prescribe one, an environment
 * quirk specific to this WP/builder version) that don't belong upstream in
 * the shared library but still need to survive past this one conversation.
 * project-common.md is deliberately optional and lives with the project
 * itself (not in this app's own prompts/ directory) — {{wpSiteDir}} is
 * filled in by substituteTemplate() same as every other placeholder in the
 * template this gets prepended to.
 */
const PROJECT_NOTES_PREAMBLE = `**Project-specific notes:** check whether `
  + "\`{{wpSiteDir}}/project-common.md\`"
  + ` exists — if so, read it first. It holds this project's own standing
decisions and known quirks (an environment/builder-version quirk, a call made on an open question the shared
prompts below don't resolve one way) — not the kind of thing that belongs in the shared prompt library since it's
specific to this one project, but still something later work here needs to keep respecting rather than re-deciding
from scratch each time. Treat whatever it says as authoritative for this project, taking precedence over a generic
default anywhere below if the two ever conflict. If the file doesn't exist, there's nothing project-specific
recorded yet — proceed normally, and if this task surfaces a new standing project-specific decision or quirk worth
remembering, add it there (create the file, using its own existing block structure as the template, if it doesn't
exist yet) rather than only mentioning it in this response.

---

`;

/**
 * Fetches the current contents of prompts/{name}.md fresh, with no
 * client-side caching — editing the file on disk is reflected on the very
 * next click, not just after a page reload. Every template gets
 * PROJECT_NOTES_PREAMBLE prepended (see above) — including a future prompt
 * added to prompts/ later, with no extra wiring needed for it to pick this
 * up too.
 */
export async function fetchPromptTemplate(name: string): Promise<string> {
  try {
    const res = await fetch(`/api/prompts/${name}`);
    const data = await res.json();
    const template = typeof data.template === "string" ? data.template : "";
    return template ? PROJECT_NOTES_PREAMBLE + template : "";
  } catch {
    return "";
  }
}

/** Fills {{placeholder}} tokens in a template with the given values. */
export function substituteTemplate(template: string, replacements: Record<string, string>): string {
  return template.replace(/{{(\w+)}}/g, (match, key) => replacements[key] ?? match);
}
