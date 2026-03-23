import { ChildProcess } from "node:child_process";
import { createInterface } from "node:readline";
import { randomUUID } from "node:crypto";
import type { WorkerResponse } from "./types.js";

const DEFAULT_TIMEOUT_MS = 60_000;

type PendingRequest = {
  resolve: (response: WorkerResponse) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
  gen: number;
};

const pending = new Map<string, PendingRequest>();

let generation = 0;
let initialized = false;

/**
 * Attach a readline listener to the process stdout to parse JSON-line responses.
 * Must be called once per spawned process.
 */
export function attachResponseListener(proc: ChildProcess): void {
  if (!proc.stdout) throw new Error("Process stdout is not available");

  const myGen = ++generation;
  initialized = true;

  const rl = createInterface({ input: proc.stdout });

  rl.on("line", (line) => {
    let parsed: WorkerResponse;
    try {
      parsed = JSON.parse(line);
    } catch (err) {
      process.stderr.write(`[ipc] Failed to parse worker response as JSON: ${err instanceof Error ? err.message : err} | raw: ${line}\n`);
      return;
    }

    const entry = pending.get(parsed.id);
    if (entry) {
      clearTimeout(entry.timer);
      pending.delete(parsed.id);
      entry.resolve(parsed);
    } else {
      process.stderr.write(`[ipc] Received response with no matching pending request (id=${parsed.id})\n`);
    }
  });

  rl.on("close", () => {
    // Only reject requests belonging to this process generation.
    // If a new process has already been spawned (generation advanced),
    // its requests must not be rejected by this stale close event.
    for (const [id, entry] of pending) {
      if (entry.gen === myGen) {
        clearTimeout(entry.timer);
        pending.delete(id);
        entry.reject(new Error("Python process exited unexpectedly"));
      }
    }
    if (generation === myGen) {
      initialized = false;
    }
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

    pending.set(id, { resolve, reject, timer, gen: generation });

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
