import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import { homedir, platform } from "node:os";
import { mkdir, rm } from "node:fs/promises";

const SOCKET_FILENAME = "bridge.sock";
const META_FILENAME = "bridge_meta.json";

/**
 * Hash a raw session ID to a 12-char hex string.
 * Keeps socket paths well under the ~108-char Unix limit.
 */
export function hashSessionId(raw: string): string {
  return createHash("sha256").update(raw).digest("hex").slice(0, 12);
}

/**
 * Platform-specific base directory for session runtime data.
 */
function getBaseDir(): string {
  switch (platform()) {
    case "darwin":
      return join(homedir(), "Library", "Caches", "otterwise", "runtime");
    case "win32":
      return join(
        process.env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local"),
        "otterwise",
        "runtime",
      );
    default:
      // Linux / other Unix
      return join(
        process.env.XDG_RUNTIME_DIR ?? "/tmp",
        "otterwise",
      );
  }
}

/**
 * Get the session directory for a given session ID.
 */
export function getSessionDir(sessionId: string): string {
  const hashed = hashSessionId(sessionId);
  return join(getBaseDir(), hashed);
}

/**
 * Get the path to the Unix domain socket for a session.
 */
export function getSocketPath(sessionId: string): string {
  return join(getSessionDir(sessionId), SOCKET_FILENAME);
}

/**
 * Get the path to the bridge metadata JSON file for a session.
 */
export function getMetaPath(sessionId: string): string {
  return join(getSessionDir(sessionId), META_FILENAME);
}

/**
 * Validate a path to prevent directory traversal attacks.
 * Ensures the resolved path stays within the expected base directory.
 */
export function validatePath(path: string): boolean {
  const base = getBaseDir();
  const resolved = resolve(path);
  return resolved.startsWith(base + "/") || resolved.startsWith(base + "\\") || resolved === base;
}

/**
 * Ensure the session directory exists, creating it if necessary.
 */
export async function ensureSessionDir(sessionId: string): Promise<string> {
  const dir = getSessionDir(sessionId);
  if (!validatePath(dir)) {
    throw new Error(`Session directory path failed validation: ${dir}`);
  }
  await mkdir(dir, { recursive: true });
  return dir;
}

/**
 * Remove the session directory and all its contents.
 */
export async function cleanup(sessionId: string): Promise<void> {
  const dir = getSessionDir(sessionId);
  if (!validatePath(dir)) {
    throw new Error(`Session directory path failed validation: ${dir}`);
  }
  await rm(dir, { recursive: true, force: true });
}
