import { spawn, ChildProcess } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";
import { readFile, lstat } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import {
  connect as socketConnect,
  sendRequest,
  disconnect as socketDisconnect,
  isConnected,
} from "./socket-client.js";
import { acquire, release } from "./session-lock.js";
import {
  getSocketPath,
  getMetaPath,
  ensureSessionDir,
  cleanup,
  validateSessionId,
} from "./paths.js";
import type {
  BridgeMeta,
  ExecuteResponse,
  StateResponse,
  InterruptResponse,
  ResetResponse,
} from "./types.js";

export type { ExecuteResponse, StateResponse, InterruptResponse, ResetResponse };

const __curDir = dirname(fileURLToPath(import.meta.url));
// In dev (src/bridge/), go up 2 levels; in bundled CJS (dist/), go up 1 level
const PACKAGE_ROOT = __curDir.endsWith("bridge")
  ? join(__curDir, "../..")
  : join(__curDir, "..");
const WORKER_PATH = join(PACKAGE_ROOT, "worker/worker.py");

const READY_TIMEOUT_MS = 30_000;
const SIGINT_TIMEOUT_MS = 5_000;
const SIGTERM_TIMEOUT_MS = 2_500;
const MAX_RESPAWN_ATTEMPTS = 5;
const RESPAWN_BASE_DELAY_MS = 500;
const SESSION_MAX_AGE_MS = 4 * 60 * 60 * 1000; // 4 hours

const FORBIDDEN_PATTERNS = ["os.system(", "subprocess.", "eval(", "__import__"];

function generateSessionId(): string {
  const ts = Date.now();
  const rand = randomBytes(4).toString("hex");
  return `${ts}-${rand}`;
}

export class BridgeManager {
  private process: ChildProcess | null = null;
  private sessionId: string | null = null;
  private startTime: number | null = null;
  private bridgeMeta: BridgeMeta | null = null;
  private respawnCount = 0;
  private spawning: Promise<void> | null = null;

  /**
   * Spawn the Python worker, wait for READY, and connect the socket client.
   */
  private async spawnWorker(): Promise<void> {
    const sessionId = generateSessionId();

    // Validate generated session ID
    if (!validateSessionId(sessionId)) {
      throw new Error(`Generated session ID failed validation: ${sessionId}`);
    }

    const socketPath = getSocketPath(sessionId);

    await ensureSessionDir(sessionId);
    await acquire(sessionId);

    const proc = spawn(
      "python3",
      ["-u", WORKER_PATH, "--socket-path", socketPath],
      {
        stdio: ["ignore", "pipe", "pipe"],
        detached: true,
      },
    );

    // Forward worker stderr for logging
    proc.stderr?.on("data", (chunk: Buffer) => {
      process.stderr.write(chunk);
    });

    // Wait for the READY signal on stdout
    await this.waitForReady(proc);

    // Validate bridge_meta.json
    const metaPath = getMetaPath(sessionId);
    const meta = await this.readMeta(metaPath);
    if (meta) {
      // PID must match the spawned process
      if (meta.pid !== proc.pid) {
        proc.kill("SIGKILL");
        await release(sessionId);
        throw new Error(
          `Worker PID mismatch: expected ${proc.pid}, meta says ${meta.pid}`,
        );
      }

      // Verify socket path in meta matches what we expect (anti-hijack)
      if (meta.socketPath && meta.socketPath !== socketPath) {
        proc.kill("SIGKILL");
        await release(sessionId);
        throw new Error(
          `Socket path mismatch: expected ${socketPath}, meta says ${meta.socketPath}`,
        );
      }
    }

    // Verify the socket file exists and is owned correctly before connecting
    await this.verifySocketPath(socketPath);

    // Connect the socket client
    await socketConnect(socketPath);

    // Track worker exit
    proc.on("exit", (code, signal) => {
      if (this.process === proc) {
        this.process = null;
        this.spawning = null;
      }
      process.stderr.write(
        `[bridge-manager] Worker exited (code=${code}, signal=${signal})\n`,
      );
    });

    this.process = proc;
    this.sessionId = sessionId;
    this.startTime = Date.now();
    this.bridgeMeta = meta;
    this.respawnCount = 0;
  }

  /**
   * Wait for the worker to print READY on stdout.
   */
  private waitForReady(proc: ChildProcess): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!proc.stdout) {
        reject(new Error("Worker stdout not available"));
        return;
      }

      const timer = setTimeout(() => {
        rl.close();
        proc.kill("SIGKILL");
        reject(new Error(`Worker did not become ready within ${READY_TIMEOUT_MS}ms`));
      }, READY_TIMEOUT_MS);

      const rl = createInterface({ input: proc.stdout });

      rl.on("line", (line) => {
        if (line.trim() === "READY") {
          clearTimeout(timer);
          rl.close();
          resolve();
        }
      });

      proc.on("exit", (code) => {
        clearTimeout(timer);
        rl.close();
        reject(new Error(`Worker exited during startup with code ${code}`));
      });
    });
  }

  /**
   * Read and parse bridge_meta.json, returning null if unavailable.
   */
  private async readMeta(metaPath: string): Promise<BridgeMeta | null> {
    try {
      const raw = await readFile(metaPath, "utf-8");
      const parsed = JSON.parse(raw) as BridgeMeta;
      if (typeof parsed.pid !== "number" || typeof parsed.startTime !== "number") {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  /**
   * Verify the socket path exists and is a socket (not a symlink or regular file).
   * Prevents socket hijack attacks where an attacker places a symlink or file
   * at the expected socket path.
   */
  private async verifySocketPath(socketPath: string): Promise<void> {
    try {
      // Use lstat to NOT follow symlinks
      const stats = await lstat(socketPath);
      if (!stats.isSocket()) {
        throw new Error(
          `Expected socket at ${socketPath} but found ${stats.isSymbolicLink() ? "symlink" : "regular file"}`,
        );
      }
    } catch (err: unknown) {
      // If the file doesn't exist yet, the worker may not have created it;
      // the connect() call will fail naturally in that case.
      if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
        return;
      }
      throw err;
    }
  }

  /**
   * Validate that the bridge can be reused for the current session.
   * Checks session ID, PID, and process identity to prevent poisoning.
   */
  private validateBridgeReuse(): boolean {
    if (!this.process || !this.sessionId || !this.bridgeMeta) {
      return false;
    }

    // Verify PID matches the stored process
    if (this.process.pid !== this.bridgeMeta.pid) {
      process.stderr.write(
        `[bridge-manager] PID mismatch on reuse: process=${this.process.pid}, meta=${this.bridgeMeta.pid}\n`,
      );
      return false;
    }

    // Verify process start time to detect PID reuse
    if (this.bridgeMeta.startTime && this.startTime) {
      const drift = Math.abs(this.bridgeMeta.startTime - this.startTime);
      // Allow 5 second tolerance
      if (drift > 5000) {
        process.stderr.write(
          `[bridge-manager] Start time drift too large on reuse: ${drift}ms\n`,
        );
        return false;
      }
    }

    return true;
  }

  /**
   * Ensure the worker is running and the socket is connected.
   * Auto-respawns on crash with exponential backoff.
   */
  private async ensureReady(): Promise<void> {
    // If already spawning, wait for that
    if (this.spawning) {
      await this.spawning;
      return;
    }

    const alive =
      this.process !== null &&
      !this.process.killed &&
      this.process.exitCode === null &&
      isConnected();

    if (alive) {
      // Session age check — force respawn after SESSION_MAX_AGE_MS
      if (this.startTime && Date.now() - this.startTime > SESSION_MAX_AGE_MS) {
        process.stderr.write(
          `[bridge-manager] Session exceeded max age (${SESSION_MAX_AGE_MS}ms), forcing respawn\n`,
        );
        await this.cleanupSession();
      // Additional anti-poisoning check on reuse
      } else if (!this.validateBridgeReuse()) {
        process.stderr.write(
          `[bridge-manager] Bridge reuse validation failed, forcing respawn\n`,
        );
        await this.cleanupSession();
      } else {
        return;
      }
    }

    // Need to spawn or respawn
    if (this.respawnCount >= MAX_RESPAWN_ATTEMPTS) {
      throw new Error(
        `Worker crashed ${this.respawnCount} times, giving up (max ${MAX_RESPAWN_ATTEMPTS})`,
      );
    }

    // Backoff delay on respawn (not on first spawn)
    if (this.respawnCount > 0) {
      const delay = RESPAWN_BASE_DELAY_MS * Math.pow(2, this.respawnCount - 1);
      process.stderr.write(
        `[bridge-manager] Respawning worker (attempt ${this.respawnCount + 1}/${MAX_RESPAWN_ATTEMPTS}, delay ${delay}ms)\n`,
      );
      await new Promise((r) => setTimeout(r, delay));
    }

    // Clean up previous session
    await this.cleanupSession();

    this.respawnCount++;
    this.spawning = this.spawnWorker().finally(() => {
      this.spawning = null;
    });
    await this.spawning;
  }

  /**
   * Clean up the previous session's resources.
   */
  private async cleanupSession(): Promise<void> {
    if (isConnected()) {
      socketDisconnect();
    }
    if (this.sessionId) {
      try {
        await release(this.sessionId);
        await cleanup(this.sessionId);
      } catch {
        // Best-effort cleanup
      }
      this.sessionId = null;
    }
    this.startTime = null;
    this.bridgeMeta = null;
  }

  /**
   * Defense-in-depth code sanitization check.
   * Rejects code containing known dangerous patterns.
   */
  private sanitizeCheck(code: string): void {
    for (const pattern of FORBIDDEN_PATTERNS) {
      if (code.includes(pattern)) {
        throw new Error(`Forbidden pattern detected: ${pattern}`);
      }
    }
  }

  async execute(code: string): Promise<ExecuteResponse> {
    this.sanitizeCheck(code);
    await this.ensureReady();
    try {
      const result = await sendRequest<ExecuteResponse>("execute", { code });
      return result;
    } catch (err) {
      // On socket errors, mark process as dead so next call respawns
      if (!isConnected()) {
        this.process = null;
      }
      throw err;
    }
  }

  async getState(): Promise<StateResponse> {
    await this.ensureReady();
    try {
      const result = await sendRequest<StateResponse>("get_state");
      return result;
    } catch (err) {
      if (!isConnected()) {
        this.process = null;
      }
      throw err;
    }
  }

  async interrupt(): Promise<InterruptResponse> {
    await this.ensureReady();
    const result = await sendRequest<InterruptResponse>("interrupt", {}, SIGINT_TIMEOUT_MS);
    return result;
  }

  async reset(): Promise<ResetResponse> {
    await this.ensureReady();
    const result = await sendRequest<ResetResponse>("reset");
    return result;
  }

  /**
   * Graceful 3-stage shutdown: SIGINT(5s) -> SIGTERM(2.5s) -> SIGKILL.
   * Cleans up session lock and socket files.
   */
  async shutdown(): Promise<void> {
    // Disconnect socket client first
    if (isConnected()) {
      socketDisconnect();
    }

    const proc = this.process;
    if (proc && !proc.killed && proc.exitCode === null) {
      await this.terminateProcess(proc);
    }

    // Clean up session resources
    if (this.sessionId) {
      try {
        await release(this.sessionId);
        await cleanup(this.sessionId);
      } catch {
        // Best-effort cleanup
      }
    }

    this.process = null;
    this.sessionId = null;
    this.startTime = null;
    this.bridgeMeta = null;
    this.spawning = null;
    this.respawnCount = 0;
  }

  /**
   * 3-stage process termination:
   *   1. SIGINT — give the worker 5s to finish gracefully
   *   2. SIGTERM — give it 2.5s more
   *   3. SIGKILL — force kill
   */
  private terminateProcess(proc: ChildProcess): Promise<void> {
    return new Promise<void>((resolve) => {
      let sigtermTimer: ReturnType<typeof setTimeout> | undefined;

      const onExit = () => {
        clearTimeout(sigintTimer);
        if (sigtermTimer) clearTimeout(sigtermTimer);
        resolve();
      };

      proc.once("exit", onExit);

      // Stage 1: SIGINT
      proc.kill("SIGINT");

      const sigintTimer = setTimeout(() => {
        if (proc.killed || proc.exitCode !== null) return;

        // Stage 2: SIGTERM
        proc.kill("SIGTERM");

        sigtermTimer = setTimeout(() => {
          if (proc.killed || proc.exitCode !== null) return;

          // Stage 3: SIGKILL
          proc.kill("SIGKILL");
        }, SIGTERM_TIMEOUT_MS);
      }, SIGINT_TIMEOUT_MS);
    });
  }
}

// Re-export as PythonBridge for backward compatibility
export { BridgeManager as PythonBridge };
