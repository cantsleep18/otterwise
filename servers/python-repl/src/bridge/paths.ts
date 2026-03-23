import { createHash } from "node:crypto";
import { join, resolve, basename } from "node:path";
import { homedir, platform } from "node:os";
import { mkdir, rm } from "node:fs/promises";

const SOCKET_FILENAME = "bridge.sock";
const META_FILENAME = "bridge_meta.json";

// Reserved names on Windows that are invalid as file/directory names
const WINDOWS_RESERVED = new Set([
  "CON", "PRN", "AUX", "NUL",
  "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
  "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
]);

/**
 * Hash a raw session ID to a 12-char hex string using SHA-256.
 * Keeps socket paths well under the ~108-char Unix limit.
 */
export function hashSessionId(raw: string): string {
  return createHash("sha256").update(raw).digest("hex").slice(0, 12);
}

/**
 * Validate a raw session ID before use.
 * Rejects null bytes, path separators, traversal sequences, and reserved names.
 */
export function validateSessionId(sessionId: string): boolean {
  // Must be non-empty
  if (!sessionId || sessionId.length === 0) return false;

  // Reject null bytes
  if (sessionId.includes("\0")) return false;

  // Reject path separators and traversal
  if (/[/\\]/.test(sessionId)) return false;
  if (sessionId === "." || sessionId === "..") return false;
  if (sessionId.includes("..")) return false;

  // Reject Windows reserved names (case-insensitive, with or without extension)
  const nameWithoutExt = sessionId.split(".")[0].toUpperCase();
  if (WINDOWS_RESERVED.has(nameWithoutExt)) return false;

  // Reject control characters (0x00-0x1F, 0x7F)
  if (/[\x00-\x1f\x7f]/.test(sessionId)) return false;

  return true;
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
 * Also rejects null bytes and reserved names in the final component.
 */
export function validatePath(path: string): boolean {
  // Reject null bytes anywhere in the path
  if (path.includes("\0")) return false;

  // Reject excessively long paths
  if (path.length > 255) return false;

  const base = getBaseDir();
  const resolved = resolve(path);

  // Must be within base directory
  if (!(resolved.startsWith(base + "/") || resolved.startsWith(base + "\\") || resolved === base)) {
    return false;
  }

  // Check final path component for reserved names
  const name = basename(resolved).split(".")[0].toUpperCase();
  if (WINDOWS_RESERVED.has(name)) return false;

  return true;
}

/**
 * Ensure the session directory exists, creating it if necessary.
 */
export async function ensureSessionDir(sessionId: string): Promise<string> {
  if (!validateSessionId(sessionId)) {
    throw new Error(`Invalid session ID: ${sessionId}`);
  }
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
