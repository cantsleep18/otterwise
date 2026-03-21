import { ChildProcess } from "node:child_process";
import { createInterface } from "node:readline";
import { randomUUID } from "node:crypto";
import type { WorkerResponse } from "./types.js";

const DEFAULT_TIMEOUT_MS = 60_000;

type PendingRequest = {
  resolve: (response: WorkerResponse) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

const pending = new Map<string, PendingRequest>();

let initialized = false;

/**
 * Attach a readline listener to the process stdout to parse JSON-line responses.
 * Must be called once per spawned process.
 */
export function attachResponseListener(proc: ChildProcess): void {
  if (!proc.stdout) throw new Error("Process stdout is not available");

  initialized = true;

  const rl = createInterface({ input: proc.stdout });

  rl.on("line", (line) => {
    let parsed: WorkerResponse;
    try {
      parsed = JSON.parse(line);
    } catch {
      // Not JSON — ignore (shouldn't happen since worker uses stdout for IPC only)
      return;
    }

    const entry = pending.get(parsed.id);
    if (entry) {
      clearTimeout(entry.timer);
      pending.delete(parsed.id);
      entry.resolve(parsed);
    }
  });

  rl.on("close", () => {
    // Process exited — reject all pending requests
    for (const [id, entry] of pending) {
      clearTimeout(entry.timer);
      pending.delete(id);
      entry.reject(new Error("Python process exited unexpectedly"));
    }
    initialized = false;
  });
}

/**
 * Send a request to the Python worker and wait for the matching response.
 */
export function sendRequest(
  proc: ChildProcess,
  request: Record<string, unknown>,
  timeout: number = DEFAULT_TIMEOUT_MS,
): Promise<WorkerResponse> {
  if (!proc.stdin) return Promise.reject(new Error("Process stdin is not available"));
  if (!initialized) return Promise.reject(new Error("Response listener not attached — call attachResponseListener first"));

  const id = randomUUID();
  const fullRequest = { ...request, id };

  return new Promise<WorkerResponse>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      proc.kill("SIGKILL");
      reject(new Error(`Request ${id} timed out after ${timeout}ms`));
    }, timeout);

    pending.set(id, { resolve, reject, timer });

    proc.stdin!.write(JSON.stringify(fullRequest) + "\n", (err) => {
      if (err) {
        clearTimeout(timer);
        pending.delete(id);
        reject(new Error(`Failed to write to worker stdin: ${err.message}`));
      }
    });
  });
}

/**
 * Clear all pending requests (used during cleanup).
 */
export function clearPending(): void {
  for (const [id, entry] of pending) {
    clearTimeout(entry.timer);
    pending.delete(id);
    entry.reject(new Error("Bridge shutting down"));
  }
}
