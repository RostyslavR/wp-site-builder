import { spawn } from "child_process";
import { readdir } from "fs/promises";

/** Runs a command, resolving with stdout on exit 0 and rejecting with stderr otherwise. */
export function runCommand(cmd: string, args: string[], cwd: string, input?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr.trim() || `${cmd} ${args.join(" ")} exited with code ${code}`));
    });
    if (input !== undefined) child.stdin.write(input);
    child.stdin.end();
  });
}

const NO_CONFIG_FILE = /no configuration file provided/i;

/** The single *.y*ml file directly in `cwd`, if there's exactly one — nothing safe to guess otherwise. */
async function findComposeFile(cwd: string): Promise<string | null> {
  const entries = await readdir(cwd).catch(() => [] as string[]);
  const matches = entries.filter((e) => /\.ya?ml$/i.test(e));
  return matches.length === 1 ? matches[0] : null;
}

/**
 * Runs `docker compose <args>` in cwd. Compose only auto-discovers a
 * default-named file (compose.yml/compose.yaml/docker-compose.yml/
 * docker-compose.yaml) — a project whose compose file is named anything
 * else (e.g. "compose-2.yaml", seen in practice) fails the bare command
 * with "no configuration file provided" even though the containers it
 * describes are already up and running. When that specific failure happens,
 * retry once with `-f <file>` for whichever single *.y*ml file sits
 * directly in cwd, rather than surfacing a confusing error for something
 * docker itself could resolve given the right flag. Any other failure (the
 * service genuinely doesn't exist, the container isn't running, etc.)
 * passes through unchanged on the first attempt.
 */
export async function dockerCompose(args: string[], cwd: string, input?: string): Promise<string> {
  try {
    return await runCommand("docker", ["compose", ...args], cwd, input);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!NO_CONFIG_FILE.test(message)) throw err;
    const composeFile = await findComposeFile(cwd);
    if (!composeFile) throw err;
    return runCommand("docker", ["compose", "-f", composeFile, ...args], cwd, input);
  }
}
