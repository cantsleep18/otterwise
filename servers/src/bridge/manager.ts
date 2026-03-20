import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { sendRequest } from "./client.js";
import { getSocketPath, getMetaPath } from "./paths.js";
import { findPython } from "../utils/platform.js";
import type { BridgeMeta } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SPAWN_TIMEOUT_MS = 30_000;
const SPAWN_POLL_MS = 200;
const GRACEFUL_SHUTDOWN_MS = 2_000;
const SIGTERM_GRACE_MS = 2_500;
const STDERR_MAX_BYTES = 64 * 1024;

export class BridgeManager {
  private bridge: { proc: ChildProcess; meta: BridgeMeta } | null = null;

  get socketPath(): string {
    return this.bridge?.meta.socketPath ?? getSocketPath();
  }

  get isRunning(): boolean {
    return this.bridge !== null;
  }

  async ensureRunning(): Promise<BridgeMeta> {
    if (this.bridge && (await this.isAlive())) {
      return this.bridge.meta;
    }

    await this.cleanupStale();
    const result = await this.spawn();
    this.bridge = result;
    return result.meta;
  }

  /** Alias used by tool handlers */
  async ensureBridge(): Promise<BridgeMeta> {
    return this.ensureRunning();
  }

  async start(): Promise<BridgeMeta> {
    return this.ensureRunning();
  }

  async shutdown(): Promise<void> {
    if (!this.bridge) return;

    const { proc, meta } = this.bridge;
    this.bridge = null;

    // 1. Try graceful JSON-RPC shutdown
    try {
      await sendRequest(meta.socketPath, "shutdown", undefined, GRACEFUL_SHUTDOWN_MS);
    } catch {
      // Ignore — proceed to signal-based shutdown
    }

    // 2. Wait for graceful exit
    if (await this.waitForExit(proc, GRACEFUL_SHUTDOWN_MS)) {
      await this.cleanupFiles(meta);
      return;
    }

    // 3. Escalate with signals
    await this.killWithEscalation(proc, meta);
  }

  async stop(): Promise<void> {
    return this.shutdown();
  }

  private async spawn(): Promise<{ proc: ChildProcess; meta: BridgeMeta }> {
    const pythonPath = findPython();
    if (!pythonPath) {
      throw new Error(
        "Python 3.10+ not found. Set OTTERWISE_VENV or ensure python3 is on PATH.",
      );
    }

    const socketPath = getSocketPath();
    const metaPath = getMetaPath();

    // Worker path relative to dist/ output
    const workerPath = path.resolve(__dirname, "../../bridge/worker.py");

    let stderrBuf = "";
    const processStartTime = Date.now();

    const proc = spawn(pythonPath, [workerPath, "--socket-path", socketPath], {
      stdio: ["ignore", "ignore", "pipe"],
      detached: false,
    });

    proc.stderr?.on("data", (chunk: Buffer) => {
      if (stderrBuf.length < STDERR_MAX_BYTES) {
        stderrBuf += chunk.toString("utf-8").slice(0, STDERR_MAX_BYTES - stderrBuf.length);
      }
    });

    // Wait for socket file to appear
    const deadline = Date.now() + SPAWN_TIMEOUT_MS;
    let exited = false;

    proc.once("exit", () => {
      exited = true;
    });

    while (Date.now() < deadline) {
      if (exited) {
        throw new Error(
          `Python worker exited before socket was ready.\nstderr: ${stderrBuf || "(empty)"}`,
        );
      }

      if (existsSync(socketPath)) {
        break;
      }

      await new Promise((r) => setTimeout(r, SPAWN_POLL_MS));
    }

    if (!existsSync(socketPath)) {
      proc.kill("SIGKILL");
      throw new Error(
        `Python worker did not create socket within ${SPAWN_TIMEOUT_MS}ms.\nstderr: ${stderrBuf || "(empty)"}`,
      );
    }

    // Probe Python version
    let pythonVersion = "unknown";
    try {
      const info = await sendRequest<{ python_version?: string }>(
        socketPath,
        "ping",
        undefined,
        5_000,
      );
      if (info?.python_version) {
        pythonVersion = info.python_version;
      }
    } catch {
      // Non-fatal
    }

    const meta: BridgeMeta = {
      pid: proc.pid!,
      socketPath,
      processStartTime,
      pythonVersion,
      pythonPath,
      startedAt: new Date().toISOString(),
    };

    await writeFile(metaPath, JSON.stringify(meta, null, 2));

    return { proc, meta };
  }

  private async isAlive(): Promise<boolean> {
    if (!this.bridge) return false;

    const { proc, meta } = this.bridge;

    if (proc.killed || proc.exitCode !== null) {
      return false;
    }

    try {
      process.kill(proc.pid!, 0);
    } catch {
      return false;
    }

    // Ping via JSON-RPC
    try {
      await sendRequest(meta.socketPath, "ping", undefined, 2_000);
      return true;
    } catch {
      return false;
    }
  }

  private async killWithEscalation(
    proc: ChildProcess,
    meta: BridgeMeta,
  ): Promise<void> {
    try {
      proc.kill("SIGTERM");
    } catch {
      // Already dead
    }

    if (await this.waitForExit(proc, SIGTERM_GRACE_MS)) {
      await this.cleanupFiles(meta);
      return;
    }

    // Last resort
    try {
      proc.kill("SIGKILL");
    } catch {
      // Already dead
    }

    await this.cleanupFiles(meta);
  }

  private async cleanupStale(): Promise<void> {
    const metaPath = getMetaPath();

    let raw: string;
    try {
      raw = await readFile(metaPath, "utf-8");
    } catch {
      return; // No meta file
    }

    let meta: BridgeMeta;
    try {
      meta = JSON.parse(raw) as BridgeMeta;
    } catch {
      // Corrupt meta — remove it
      await this.safeUnlink(metaPath);
      return;
    }

    // Check if PID is still alive
    let alive = false;
    try {
      process.kill(meta.pid, 0);
      alive = true;
    } catch {
      // Dead
    }

    if (!alive) {
      await this.cleanupFiles(meta);
    }
  }

  private async cleanupFiles(meta: BridgeMeta): Promise<void> {
    await this.safeUnlink(meta.socketPath);
    await this.safeUnlink(getMetaPath());
  }

  private async safeUnlink(filePath: string): Promise<void> {
    try {
      await unlink(filePath);
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
        throw err;
      }
    }
  }

  private waitForExit(proc: ChildProcess, timeoutMs: number): Promise<boolean> {
    return new Promise((resolve) => {
      if (proc.exitCode !== null) {
        resolve(true);
        return;
      }

      let timer: ReturnType<typeof setTimeout>;

      const onExit = () => {
        clearTimeout(timer);
        resolve(true);
      };

      timer = setTimeout(() => {
        proc.removeListener("exit", onExit);
        resolve(false);
      }, timeoutMs);

      proc.once("exit", onExit);
    });
  }
}
