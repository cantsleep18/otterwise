import { writeFile, readFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { ensureSessionDir, getSessionDir, validatePath } from "./paths.js";

const LOCK_FILENAME = "session.lock";

interface LockContent {
  pid: number;
  timestamp: number;
}

function getLockPath(sessionId: string): string {
  return join(getSessionDir(sessionId), LOCK_FILENAME);
}

/**
 * Acquire a lock for the given session.
 * Creates a lockfile containing the current PID and timestamp.
 * Throws if the session is already locked by another live process.
 */
export async function acquire(sessionId: string): Promise<void> {
  const lockPath = getLockPath(sessionId);
  if (!validatePath(lockPath)) {
    throw new Error(`Lock path failed validation: ${lockPath}`);
  }

  // Check for existing lock
  const existing = await readLock(sessionId);
  if (existing !== null) {
    // Check if the holding process is still alive
    if (isProcessAlive(existing.pid)) {
      throw new Error(
        `Session ${sessionId} is locked by PID ${existing.pid} (since ${new Date(existing.timestamp).toISOString()})`,
      );
    }
    // Stale lock from a dead process — remove it
    await release(sessionId);
  }

  await ensureSessionDir(sessionId);

  const content: LockContent = {
    pid: process.pid,
    timestamp: Date.now(),
  };

  // Use wx flag: fail if file already exists (atomic creation)
  try {
    await writeFile(lockPath, JSON.stringify(content), { flag: "wx" });
  } catch (err: unknown) {
    if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "EEXIST") {
      throw new Error(`Session ${sessionId} lock was acquired by another process during acquire`);
    }
    throw err;
  }
}

/**
 * Release the lock for the given session.
 * Silently succeeds if no lock exists.
 */
export async function release(sessionId: string): Promise<void> {
  const lockPath = getLockPath(sessionId);
  if (!validatePath(lockPath)) {
    throw new Error(`Lock path failed validation: ${lockPath}`);
  }

  try {
    await unlink(lockPath);
  } catch (err: unknown) {
    if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
      return; // Already unlocked
    }
    throw err;
  }
}

/**
 * Check whether a session is currently locked.
 */
export async function isLocked(sessionId: string): Promise<boolean> {
  const content = await readLock(sessionId);
  if (content === null) return false;
  // Only count as locked if the holding process is still alive
  return isProcessAlive(content.pid);
}

/**
 * Force-break a lock older than maxAge milliseconds.
 * Returns true if a lock was broken, false if no stale lock found.
 */
export async function breakStaleLock(
  sessionId: string,
  maxAge: number,
): Promise<boolean> {
  const content = await readLock(sessionId);
  if (content === null) return false;

  const age = Date.now() - content.timestamp;
  if (age < maxAge) return false;

  await release(sessionId);
  return true;
}

/**
 * Read and parse the lock file content. Returns null if no lock exists.
 */
async function readLock(sessionId: string): Promise<LockContent | null> {
  const lockPath = getLockPath(sessionId);
  try {
    const raw = await readFile(lockPath, "utf-8");
    const parsed = JSON.parse(raw) as LockContent;
    if (typeof parsed.pid !== "number" || typeof parsed.timestamp !== "number") {
      return null; // Malformed lock file
    }
    return parsed;
  } catch (err: unknown) {
    if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw err;
  }
}

/**
 * Check if a process with the given PID is still running.
 */
function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0); // Signal 0: check existence without killing
    return true;
  } catch {
    return false;
  }
}
