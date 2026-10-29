import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile } from "fs/promises";
import path from "path";
import { dockerCompose } from "@/lib/docker-compose";

// The exact block WordPress itself writes into .htaccess for pretty
// permalinks (single-site, mod_rewrite) — see wp-admin/includes/misc.php's
// save_mod_rewrite_rules(). Deterministic and unchanging, so this route
// writes it directly rather than asking an agent to reason about it.
const BEGIN_MARKER = "# BEGIN WordPress";
const END_MARKER = "# END WordPress";
const STANDARD_BLOCK = `${BEGIN_MARKER}
# The directives (lines) between "BEGIN WordPress" and "END WordPress" are
# dynamically generated, and should only be modified via WordPress filters.
# Any changes to the directives between these markers will be overwritten.

<IfModule mod_rewrite.c>
RewriteEngine On
RewriteRule .* - [E=HTTP_AUTHORIZATION:%{HTTP:Authorization}]
RewriteBase /
RewriteRule ^index\\.php$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.php [L]
</IfModule>

${END_MARKER}
`;

function hasHealthyBlock(content: string): boolean {
  const begin = content.indexOf(BEGIN_MARKER);
  const end = content.indexOf(END_MARKER);
  if (begin === -1 || end === -1 || end < begin) return false;
  const region = content.slice(begin, end);
  return region.includes("RewriteEngine On") && /RewriteRule\s+\.\s+\/index\.php/.test(region);
}

/**
 * Reads/writes .htaccess through the site's own `docker compose exec` (service name
 * "wordpress", matching every project's compose file in this workspace) instead of the host
 * filesystem. The WordPress container's public-html is bind-mounted from wpSiteDir but owned
 * by www-data inside the container — on a native (non-drvfs) filesystem that's enforced for
 * real, so the host-side Node process (running as a different user) gets EACCES writing it
 * directly. Running the read/write *inside* the container sidesteps that, since it's the same
 * user that already owns the file. `docker compose` (not raw `docker exec <container-name>`)
 * is used specifically so this doesn't need to guess or hardcode the container's actual name —
 * run with the project's own directory as cwd, it resolves the right compose file/container
 * itself, the same way a human would.
 */
function dockerReadHtaccess(wpSiteDir: string): Promise<string> {
  return dockerCompose(["exec", "-T", "wordpress", "cat", "/var/www/html/.htaccess"], wpSiteDir);
}

function dockerWriteHtaccess(wpSiteDir: string, content: string): Promise<string> {
  return dockerCompose(["exec", "-T", "wordpress", "sh", "-c", "cat > /var/www/html/.htaccess"], wpSiteDir, content);
}

export async function POST(request: NextRequest) {
  const { wpSiteDir } = await request.json();
  if (!wpSiteDir || typeof wpSiteDir !== "string") {
    return NextResponse.json({ error: "wpSiteDir is required" }, { status: 400 });
  }

  const htaccessPath = path.join(wpSiteDir, "public-html", ".htaccess");
  const dockerLabel = "/var/www/html/.htaccess (in the wordpress container)";

  // Try the host filesystem first — fine for a non-Docker setup, or one where permissions
  // just happen to allow it. Only fall back to going through Docker if that fails, and only
  // report an error if *both* paths fail.
  let existing = "";
  let viaDocker = false;
  try {
    existing = await readFile(htaccessPath, "utf-8");
  } catch (hostErr) {
    try {
      existing = await dockerReadHtaccess(wpSiteDir);
      viaDocker = true;
    } catch {
      // Neither found a file — genuinely missing either way, not an error (same as the
      // original ENOENT handling): fixHealthyBlock("") is false, so we fall through to
      // creating one below. If the host error wasn't ENOENT (e.g. EACCES) but Docker also
      // couldn't read anything, we still proceed treating it as "no file yet" rather than
      // failing outright — the write step below will surface the real error if writing
      // fails too.
      void hostErr;
    }
  }

  if (hasHealthyBlock(existing)) {
    return NextResponse.json({
      changed: false,
      message: `${viaDocker ? dockerLabel : htaccessPath} already has a working WordPress rewrite block — nothing to fix.`,
    });
  }

  const begin = existing.indexOf(BEGIN_MARKER);
  const end = existing.indexOf(END_MARKER);
  let updated: string;
  if (begin !== -1 && end !== -1 && end > begin) {
    // Markers present but the rules inside are missing/corrupted — replace
    // just that region, leaving anything outside it untouched.
    const endOfEndMarker = end + END_MARKER.length;
    updated = existing.slice(0, begin) + STANDARD_BLOCK + existing.slice(endOfEndMarker).replace(/^\n/, "");
  } else {
    // No markers at all (or a missing file) — WordPress itself inserts the
    // block at the very top of .htaccess.
    updated = STANDARD_BLOCK + (existing ? `\n${existing}` : "");
  }

  let wroteViaDocker = viaDocker;
  try {
    if (viaDocker) {
      await dockerWriteHtaccess(wpSiteDir, updated);
    } else {
      await writeFile(htaccessPath, updated, "utf-8");
    }
  } catch (firstErr) {
    // Direct write failed (typically EACCES) — fall back to Docker, even if the read
    // itself came from the host successfully.
    try {
      await dockerWriteHtaccess(wpSiteDir, updated);
      wroteViaDocker = true;
    } catch (dockerErr) {
      return NextResponse.json(
        {
          error: `Failed to write ${htaccessPath} directly (${firstErr instanceof Error ? firstErr.message : String(firstErr)}), and writing it via docker compose also failed: ${dockerErr instanceof Error ? dockerErr.message : String(dockerErr)}`,
        },
        { status: 500 }
      );
    }
  }

  const finalPath = wroteViaDocker ? dockerLabel : htaccessPath;
  return NextResponse.json({
    changed: true,
    message: `Regenerated the WordPress rewrite block in ${finalPath}. Reload a non-home page (e.g. a published post/page URL) to confirm pretty permalinks now work.`,
  });
}
