import { open, unlink, readFile } from "node:fs/promises";
import { constants } from "node:fs";

interface LockData {
  pid: number;
  startTime: number;
  acquiredAt: string;
}

export class SessionLock {
  constructor(private lockPath: string) {}

  async acquire(timeout = 30_000): Promise<void> {
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
      try {
        const fd = await open(
          this.lockPath,
          constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY,
        );
        const data: LockData = {
          pid: process.pid,
          startTime: Date.now(),
          acquiredAt: new Date().toISOString(),
        };
        await fd.writeFile(JSON.stringify(data));
        await fd.close();
        return;
      } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException).code !== "EEXIST") {
          throw err;
        }

        // Lock file exists — check if it's stale
        if (await this.isStale()) {
          continue; // Stale lock removed, retry immediately
        }

        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    throw new Error(
      `Failed to acquire session lock at ${this.lockPath} within ${timeout}ms`,
    );
  }

  async release(): Promise<void> {
    try {
      await unlink(this.lockPath);
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
        throw err;
      }
    }
  }

  async withLock<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      await this.release();
    }
  }

  private async isStale(): Promise<boolean> {
    try {
      const raw = await readFile(this.lockPath, "utf-8");
      const data: LockData = JSON.parse(raw);

      try {
        process.kill(data.pid, 0);
        return false; // Process is alive
      } catch {
        // Process is dead — remove stale lock
        await this.release();
        return true;
      }
    } catch {
      // Can't read lock file — treat as not stale
      return false;
    }
  }
}
