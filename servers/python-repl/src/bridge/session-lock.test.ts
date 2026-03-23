import { describe, it, expect, afterEach } from "vitest";
import { existsSync } from "node:fs";
import { writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { acquire, release, isLocked, breakStaleLock } from "./session-lock.js";
import { ensureSessionDir, getSessionDir, cleanup } from "./paths.js";

const TEST_SESSION = `test-lock-${Date.now()}`;

afterEach(async () => {
  try {
    await cleanup(TEST_SESSION);
  } catch {
    // ignore
  }
});

describe("acquire / release", () => {
  it("creates a lock file on acquire", async () => {
    await acquire(TEST_SESSION);
    const lockPath = join(getSessionDir(TEST_SESSION), "session.lock");
    expect(existsSync(lockPath)).toBe(true);
  });

  it("lock file contains current PID, timestamp, and processStartTime", async () => {
    await acquire(TEST_SESSION);
    const lockPath = join(getSessionDir(TEST_SESSION), "session.lock");
    const content = JSON.parse(await readFile(lockPath, "utf-8"));
    expect(content.pid).toBe(process.pid);
    expect(typeof content.timestamp).toBe("number");
    expect(content.timestamp).toBeLessThanOrEqual(Date.now());
    expect(typeof content.processStartTime).toBe("number");
    expect(content.processStartTime).toBeLessThanOrEqual(Date.now());
  });

  it("release removes the lock file", async () => {
    await acquire(TEST_SESSION);
    await release(TEST_SESSION);
    const lockPath = join(getSessionDir(TEST_SESSION), "session.lock");
    expect(existsSync(lockPath)).toBe(false);
  });

  it("release is idempotent (no error if no lock)", async () => {
    await expect(release(TEST_SESSION)).resolves.not.toThrow();
  });

  it("throws when acquiring a lock held by this process", async () => {
    await acquire(TEST_SESSION);
    // Same PID is alive, so should throw
    await expect(acquire(TEST_SESSION)).rejects.toThrow(/locked by PID/);
  });
});

describe("stale lock detection", () => {
  it("acquires over a stale lock from a dead process", async () => {
    // Write a lock file with a PID that doesn't exist
    await ensureSessionDir(TEST_SESSION);
    const lockPath = join(getSessionDir(TEST_SESSION), "session.lock");
    const staleLock = JSON.stringify({ pid: 999999, timestamp: Date.now() - 60000, processStartTime: Date.now() - 120000 });
    await writeFile(lockPath, staleLock);

    // Should succeed because PID 999999 is not alive
    await expect(acquire(TEST_SESSION)).resolves.not.toThrow();
  });
});

describe("isLocked", () => {
  it("returns false when no lock exists", async () => {
    expect(await isLocked(TEST_SESSION)).toBe(false);
  });

  it("returns true when locked by this process", async () => {
    await acquire(TEST_SESSION);
    expect(await isLocked(TEST_SESSION)).toBe(true);
  });

  it("returns false after release", async () => {
    await acquire(TEST_SESSION);
    await release(TEST_SESSION);
    expect(await isLocked(TEST_SESSION)).toBe(false);
  });

  it("returns false for stale lock from dead process", async () => {
    await ensureSessionDir(TEST_SESSION);
    const lockPath = join(getSessionDir(TEST_SESSION), "session.lock");
    await writeFile(lockPath, JSON.stringify({ pid: 999999, timestamp: Date.now(), processStartTime: Date.now() - 60000 }));
    expect(await isLocked(TEST_SESSION)).toBe(false);
  });
});

describe("breakStaleLock", () => {
  it("returns false when no lock exists", async () => {
    expect(await breakStaleLock(TEST_SESSION, 1000)).toBe(false);
  });

  it("returns false when lock is younger than maxAge", async () => {
    await acquire(TEST_SESSION);
    // Lock was just created, 1 hour maxAge — should not break
    expect(await breakStaleLock(TEST_SESSION, 3600_000)).toBe(false);
    await release(TEST_SESSION);
  });

  it("breaks a lock older than maxAge", async () => {
    await ensureSessionDir(TEST_SESSION);
    const lockPath = join(getSessionDir(TEST_SESSION), "session.lock");
    // Write a lock file with a very old timestamp
    const oldLock = JSON.stringify({ pid: process.pid, timestamp: Date.now() - 10000, processStartTime: Date.now() - 10000 });
    await writeFile(lockPath, oldLock);

    expect(await breakStaleLock(TEST_SESSION, 5000)).toBe(true);
    expect(existsSync(lockPath)).toBe(false);
  });
});
