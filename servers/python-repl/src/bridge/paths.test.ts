import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  hashSessionId,
  getSessionDir,
  getSocketPath,
  getMetaPath,
  validatePath,
  validateSessionId,
  ensureSessionDir,
  cleanup,
} from "./paths.js";

describe("hashSessionId", () => {
  it("returns a 12-character hex string", () => {
    const hash = hashSessionId("test-session");
    expect(hash).toMatch(/^[0-9a-f]{12}$/);
  });

  it("is deterministic", () => {
    expect(hashSessionId("abc")).toBe(hashSessionId("abc"));
  });

  it("produces different hashes for different inputs", () => {
    expect(hashSessionId("session-1")).not.toBe(hashSessionId("session-2"));
  });
});

describe("getSessionDir", () => {
  it("returns a path containing the hashed session ID", () => {
    const dir = getSessionDir("my-session");
    const hash = hashSessionId("my-session");
    expect(dir).toContain(hash);
  });

  it("returns a path under the platform runtime directory", () => {
    const dir = getSessionDir("test");
    // Should be an absolute path
    expect(dir).toMatch(/^[/\\]|^[A-Z]:\\/);
  });
});

describe("getSocketPath", () => {
  it("returns a path ending with bridge.sock", () => {
    const sockPath = getSocketPath("my-session");
    expect(sockPath).toMatch(/bridge\.sock$/);
  });

  it("is within the session directory", () => {
    const sessionDir = getSessionDir("my-session");
    const sockPath = getSocketPath("my-session");
    expect(sockPath.startsWith(sessionDir)).toBe(true);
  });
});

describe("getMetaPath", () => {
  it("returns a path ending with bridge_meta.json", () => {
    const metaPath = getMetaPath("my-session");
    expect(metaPath).toMatch(/bridge_meta\.json$/);
  });

  it("is within the session directory", () => {
    const sessionDir = getSessionDir("my-session");
    const metaPath = getMetaPath("my-session");
    expect(metaPath.startsWith(sessionDir)).toBe(true);
  });
});

describe("validateSessionId", () => {
  it("accepts valid session IDs", () => {
    expect(validateSessionId("1234567890-abcdef01")).toBe(true);
    expect(validateSessionId("test-session")).toBe(true);
  });

  it("rejects empty strings", () => {
    expect(validateSessionId("")).toBe(false);
  });

  it("rejects null bytes", () => {
    expect(validateSessionId("test\0session")).toBe(false);
  });

  it("rejects path separators", () => {
    expect(validateSessionId("test/session")).toBe(false);
    expect(validateSessionId("test\\session")).toBe(false);
  });

  it("rejects traversal sequences", () => {
    expect(validateSessionId("..")).toBe(false);
    expect(validateSessionId("test..session")).toBe(false);
  });

  it("rejects Windows reserved names", () => {
    expect(validateSessionId("CON")).toBe(false);
    expect(validateSessionId("NUL")).toBe(false);
    expect(validateSessionId("COM1")).toBe(false);
    expect(validateSessionId("LPT1")).toBe(false);
  });

  it("rejects control characters", () => {
    expect(validateSessionId("test\x01session")).toBe(false);
    expect(validateSessionId("test\x7fsession")).toBe(false);
  });
});

describe("validatePath", () => {
  it("accepts paths within the session directory", () => {
    const dir = getSessionDir("valid-session");
    expect(validatePath(dir)).toBe(true);
  });

  it("accepts the socket path", () => {
    const sockPath = getSocketPath("valid-session");
    expect(validatePath(sockPath)).toBe(true);
  });

  it("rejects directory traversal attempts", () => {
    const dir = getSessionDir("test");
    const traversal = join(dir, "..", "..", "etc", "passwd");
    expect(validatePath(traversal)).toBe(false);
  });

  it("rejects paths completely outside the base directory", () => {
    expect(validatePath("/etc/passwd")).toBe(false);
    expect(validatePath("/tmp/random-file")).toBe(false);
  });
});

describe("ensureSessionDir", () => {
  const sessionId = `test-ensure-${Date.now()}`;

  afterEach(async () => {
    try {
      await cleanup(sessionId);
    } catch {
      // ignore
    }
  });

  it("creates the session directory and returns the path", async () => {
    const dir = await ensureSessionDir(sessionId);
    expect(existsSync(dir)).toBe(true);
    expect(dir).toBe(getSessionDir(sessionId));
  });

  it("is idempotent", async () => {
    const dir1 = await ensureSessionDir(sessionId);
    const dir2 = await ensureSessionDir(sessionId);
    expect(dir1).toBe(dir2);
    expect(existsSync(dir1)).toBe(true);
  });
});

describe("cleanup", () => {
  it("removes the session directory", async () => {
    const sessionId = `test-cleanup-${Date.now()}`;
    const dir = await ensureSessionDir(sessionId);
    expect(existsSync(dir)).toBe(true);

    await cleanup(sessionId);
    expect(existsSync(dir)).toBe(false);
  });

  it("does not throw if directory does not exist", async () => {
    await expect(cleanup("nonexistent-session-id-xyz")).resolves.not.toThrow();
  });
});
