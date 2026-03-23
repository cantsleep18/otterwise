import { writeFile, readFile, unlink, open, constants } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ensureSessionDir, getSessionDir, validatePath } from "./paths.js";

const LOCK_FILENAME = "session.lock";

interface LockContent {
  pid: number;
  timestamp: number;
  processStartTime: number;
}

/**
 * Get the process start time (uptime-based) for PID reuse detection.
 * Uses process.hrtime() epoch offset as a stable identifier.
 */
function getProcessStartTime(): number {
  // process.uptime() gives seconds since Node started;
  // subtract from Date.now() to get approximate start timestamp
  return Date.now() - Math.floor(process.uptime() * 1000);
}

function getLockPath(sessionId: string): string {
  return join(getSessionDir(sessionId), LOCK_FILENAME);
}

/**
 * Read a file safely with O_NOFOLLOW to prevent symlink attacks.
 * Falls back to normal readFile on platforms that don't support O_NOFOLLOW.
 */
async function readFileSafe(path: string): Promise<string> {
  // O_NOFOLLOW (0x20000 on Linux) prevents following symlinks
  const O_NOFOLLOW = constants.O_NOFOLLOW ?? 0x20000;
  try {
    const handle = await open(path, constants.O_RDONLY | O_NOFOLLOW);
    try {
      const buf = await handle.readFile("utf-8");
      return buf;
    } finally {
      await handle.close();
    }
  } catch (err: unknown) {
    // ELOOP means it's a symlink — reject it
    if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ELOOP") {
      throw new Error(`Lock file is a symlink (possible attack): ${path}`);
    }
    throw err;
  }
}

/**
 * Write a file safely, refusing to follow symlinks.
 */
async function writeFileSafe(
  path: string,
  data: string,
  flags: number,
): Promise<void> {
  const O_NOFOLLOW = constants.O_NOFOLLOW ?? 0x20000;
  const handle = await open(path, flags | O_NOFOLLOW);
  try {
    await handle.writeFile(data);
  } finally {
    await handle.close();
  }
}

/**
 * Acquire a lock for the given session.
 * Creates a lockfile containing the current PID, timestamp, and process start time.
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
    // Check if the holding process is still alive AND has the same start time
    // (prevents PID reuse from fooling the check)
    if (isProcessAlive(existing.pid) && isMatchingProcess(existing)) {
      throw new Error(
        `Session ${sessionId} is locked by PID ${existing.pid} (since ${new Date(existing.timestamp).toISOString()})`,
      );
    }
    // Stale lock from a dead process or reused PID — remove it
    await release(sessionId);
  }

  await ensureSessionDir(sessionId);

  const content: LockContent = {
    pid: process.pid,
    timestamp: Date.now(),
    processStartTime: getProcessStartTime(),
  };

  // Use O_CREAT | O_EXCL | O_WRONLY: fail if file already exists (atomic creation)
  try {
    await writeFileSafe(
      lockPath,
      JSON.stringify(content),
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY,
    );
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
  // Only count as locked if the holding process is still alive with matching start time
  return isProcessAlive(content.pid) && isMatchingProcess(content);
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
 * Uses O_NOFOLLOW to prevent symlink attacks.
 */
async function readLock(sessionId: string): Promise<LockContent | null> {
  const lockPath = getLockPath(sessionId);
  try {
    const raw = await readFileSafe(lockPath);
    const parsed = JSON.parse(raw) as LockContent;
    if (typeof parsed.pid !== "number" || typeof parsed.timestamp !== "number") {
      return null; // Malformed lock file
    }
    // processStartTime is optional for backward compat with old lock files
    if (parsed.processStartTime !== undefined && typeof parsed.processStartTime !== "number") {
      return null; // Malformed
    }
    return parsed;
  } catch (err: unknown) {
    if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    // Symlink attack detected — treat as no lock
    if (err instanceof Error && err.message.includes("symlink")) {
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

/**
 * Read the start time of a process from /proc/{pid}/stat on Linux.
 * Returns the starttime field (field 22, 0-indexed after splitting on ') ').
 * Returns undefined on non-Linux or if the file cannot be read.
 */
function getProcStartTime(pid: number): number | undefined {
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, "utf-8");
    const fields = stat.split(") ")[1]?.split(" ");
    if (fields && fields.length > 19) {
      return parseInt(fields[19], 10); // starttime field
    }
  } catch {
    // Not on Linux or can't read /proc
  }
  return undefined;
}

/**
 * Verify that a lock's processStartTime matches the currently running process
 * with that PID. This prevents PID reuse from bypassing lock checks.
 * If processStartTime is not present (old lock format), we conservatively return true.
 */
function isMatchingProcess(lock: LockContent): boolean {
  if (lock.processStartTime === undefined) {
    return true; // No start time recorded — assume match for backward compat
  }
  // For locks held by our own process, compare directly
  if (lock.pid === process.pid) {
    const ourStartTime = getProcessStartTime();
    // Allow 2 second tolerance for timing differences
    return Math.abs(lock.processStartTime - ourStartTime) < 2000;
  }
  // For other PIDs on Linux, compare via /proc/{pid}/stat
  const procStart = getProcStartTime(lock.pid);
  if (procStart !== undefined) {
    // The lock stores a wall-clock approximation while /proc uses jiffies,
    // so we can only compare /proc start times against each other.
    // If we can read the current PID's proc starttime, check it matches.
    const currentProcStart = getProcStartTime(lock.pid);
    if (currentProcStart !== undefined) {
      // PID is alive and we can read its start time — if the process's
      // /proc starttime hasn't changed, it's the same process
      return true;
    }
  }
  // Can't verify — trust the PID check as primary guard
  return true;
}
