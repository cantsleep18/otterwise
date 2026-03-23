import { createConnection, Socket } from "node:net";
import { randomUUID } from "node:crypto";
import { platform } from "node:os";

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

export class SocketConnectionError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = "SocketConnectionError";
  }
}

export class SocketTimeoutError extends Error {
  constructor(public readonly requestId: string, public readonly timeoutMs: number) {
    super(`Request ${requestId} timed out after ${timeoutMs}ms`);
    this.name = "SocketTimeoutError";
  }
}

export class JsonRpcError extends Error {
  constructor(
    public readonly code: number,
    message: string,
    public readonly data?: unknown,
  ) {
    super(message);
    this.name = "JsonRpcError";
  }
}

// ---------------------------------------------------------------------------
// JSON-RPC 2.0 types
// ---------------------------------------------------------------------------

interface JsonRpcRequest {
  jsonrpc: "2.0";
  method: string;
  params?: Record<string, unknown>;
  id: string;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_TIMEOUT_MS = 60_000;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024; // 2 MB
const RECONNECT_DELAY_MS = 500;
const MAX_RECONNECT_ATTEMPTS = 5;

// Timeout escalation: for long-running requests, escalate through warning
// stages before hard timeout. Allows callers to get notified at each stage.
const TIMEOUT_ESCALATION_STAGES = [
  { fraction: 0.5, label: "warning" },
  { fraction: 0.8, label: "critical" },
  { fraction: 1.0, label: "timeout" },
] as const;

type TimeoutStage = (typeof TIMEOUT_ESCALATION_STAGES)[number]["label"];
type TimeoutCallback = (stage: TimeoutStage, elapsed: number, total: number) => void;

// ---------------------------------------------------------------------------
// Pending request bookkeeping
// ---------------------------------------------------------------------------

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

// ---------------------------------------------------------------------------
// Socket client state
// ---------------------------------------------------------------------------

let socket: Socket | null = null;
let currentPath: string | null = null;
let currentPort: number | null = null;
let reconnecting = false;
let intentionalDisconnect = false;
const pending = new Map<string, PendingRequest>();

let lineBuffer = "";
let lineBufferBytes = 0;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function resetBuffer(): void {
  lineBuffer = "";
  lineBufferBytes = 0;
}

function handleLine(line: string): void {
  let msg: JsonRpcResponse;
  try {
    msg = JSON.parse(line);
  } catch {
    process.stderr.write(`[socket-client] Failed to parse JSON response: ${line.slice(0, 200)}\n`);
    return;
  }

  if (!msg.id) return; // notifications — ignore for now

  const entry = pending.get(msg.id);
  if (!entry) {
    process.stderr.write(`[socket-client] Response with unknown id: ${msg.id}\n`);
    return;
  }

  clearTimeout(entry.timer);
  pending.delete(msg.id);

  if (msg.error) {
    entry.reject(new JsonRpcError(msg.error.code, msg.error.message, msg.error.data));
  } else {
    entry.resolve(msg.result);
  }
}

function handleData(chunk: Buffer): void {
  const text = chunk.toString("utf-8");
  for (const char of text) {
    if (char === "\n") {
      if (lineBuffer.length > 0) {
        handleLine(lineBuffer);
      }
      resetBuffer();
    } else {
      lineBufferBytes += Buffer.byteLength(char, "utf-8");
      if (lineBufferBytes > MAX_RESPONSE_BYTES) {
        process.stderr.write(
          `[socket-client] Response exceeded ${MAX_RESPONSE_BYTES} bytes, dropping\n`,
        );
        // Reject all pending requests that could be waiting for this oversized response
        resetBuffer();
        return;
      }
      lineBuffer += char;
    }
  }
}

function rejectAll(error: Error): void {
  for (const [id, entry] of pending) {
    clearTimeout(entry.timer);
    pending.delete(id);
    entry.reject(error);
  }
}

function connectSocket(path: string): Promise<Socket>;
function connectSocket(port: number): Promise<Socket>;
function connectSocket(target: string | number): Promise<Socket> {
  return new Promise<Socket>((resolve, reject) => {
    const opts =
      typeof target === "number"
        ? { port: target, host: "127.0.0.1" }
        : { path: target };

    const sock = createConnection(opts, () => resolve(sock));

    sock.on("error", (err) => {
      reject(new SocketConnectionError(`Socket connection failed: ${err.message}`, err));
    });
  });
}

function attachListeners(sock: Socket): void {
  sock.on("data", handleData);

  sock.on("close", () => {
    resetBuffer();
    if (!intentionalDisconnect) {
      rejectAll(new SocketConnectionError("Socket closed unexpectedly"));
      attemptReconnect();
    }
  });

  sock.on("error", (err) => {
    process.stderr.write(`[socket-client] Socket error: ${err.message}\n`);
  });
}

async function attemptReconnect(): Promise<void> {
  if (reconnecting || intentionalDisconnect) return;
  if (!currentPath && !currentPort) return;

  reconnecting = true;

  for (let attempt = 1; attempt <= MAX_RECONNECT_ATTEMPTS; attempt++) {
    try {
      await new Promise((r) => setTimeout(r, RECONNECT_DELAY_MS * attempt));
      if (intentionalDisconnect) break;

      const sock = currentPort
        ? await connectSocket(currentPort)
        : await connectSocket(currentPath!);

      socket = sock;
      attachListeners(sock);
      process.stderr.write(`[socket-client] Reconnected (attempt ${attempt})\n`);
      reconnecting = false;
      return;
    } catch {
      process.stderr.write(
        `[socket-client] Reconnect attempt ${attempt}/${MAX_RECONNECT_ATTEMPTS} failed\n`,
      );
    }
  }

  reconnecting = false;
  process.stderr.write(`[socket-client] Gave up reconnecting after ${MAX_RECONNECT_ATTEMPTS} attempts\n`);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Connect to the Python worker over a Unix domain socket (or TCP on Windows).
 *
 * @param socketPath - Path to the Unix domain socket, OR a TCP port number.
 *   On Windows, if a string path is given it will be treated as a TCP port
 *   number when the platform lacks Unix socket support.
 */
export async function connect(socketPath: string): Promise<void> {
  intentionalDisconnect = false;

  // Windows fallback: if the path looks like a port number, use TCP.
  // The Python worker on Windows can listen on localhost:<port> instead.
  const usePort = platform() === "win32" && /^\d+$/.test(socketPath);

  let sock: Socket;
  if (usePort) {
    const port = Number(socketPath);
    currentPort = port;
    currentPath = null;
    sock = await connectSocket(port);
  } else {
    currentPath = socketPath;
    currentPort = null;
    sock = await connectSocket(socketPath);
  }

  socket = sock;
  resetBuffer();
  attachListeners(sock);
}

/**
 * Send a JSON-RPC 2.0 request and wait for the correlated response.
 *
 * @param method - The JSON-RPC method name.
 * @param params - Optional parameters for the method.
 * @param timeout - Hard timeout in milliseconds (default 60s).
 * @param onTimeoutStage - Optional callback invoked at escalation stages
 *   (50% = "warning", 80% = "critical", 100% = "timeout" which rejects).
 */
export function sendRequest<T = unknown>(
  method: string,
  params?: Record<string, unknown>,
  timeout: number = DEFAULT_TIMEOUT_MS,
  onTimeoutStage?: TimeoutCallback,
): Promise<T> {
  if (!socket || socket.destroyed) {
    return Promise.reject(
      new SocketConnectionError("Not connected — call connect() first"),
    );
  }

  const id = randomUUID();
  const request: JsonRpcRequest = {
    jsonrpc: "2.0",
    method,
    id,
    ...(params !== undefined && { params }),
  };

  return new Promise<T>((resolve, reject) => {
    const stageTimers: ReturnType<typeof setTimeout>[] = [];

    // Set up escalation timers if callback provided
    if (onTimeoutStage) {
      for (const stage of TIMEOUT_ESCALATION_STAGES) {
        if (stage.label === "timeout") continue; // handled by main timer
        const delay = Math.floor(timeout * stage.fraction);
        stageTimers.push(
          setTimeout(() => {
            onTimeoutStage(stage.label, delay, timeout);
          }, delay),
        );
      }
    }

    const timer = setTimeout(() => {
      // Clear escalation timers
      for (const t of stageTimers) clearTimeout(t);
      pending.delete(id);
      if (onTimeoutStage) {
        onTimeoutStage("timeout", timeout, timeout);
      }
      reject(new SocketTimeoutError(id, timeout));
    }, timeout);

    // Override resolve/reject to also clean up stage timers
    const cleanupAndResolve = (value: unknown) => {
      for (const t of stageTimers) clearTimeout(t);
      resolve(value as T);
    };
    const cleanupAndReject = (error: Error) => {
      for (const t of stageTimers) clearTimeout(t);
      reject(error);
    };

    pending.set(id, {
      resolve: cleanupAndResolve,
      reject: cleanupAndReject,
      timer,
    });

    socket!.write(JSON.stringify(request) + "\n", "utf-8", (err) => {
      if (err) {
        clearTimeout(timer);
        for (const t of stageTimers) clearTimeout(t);
        pending.delete(id);
        reject(new SocketConnectionError(`Failed to write to socket: ${err.message}`, err));
      }
    });
  });
}

/**
 * Gracefully disconnect from the worker socket.
 */
export function disconnect(): void {
  intentionalDisconnect = true;
  rejectAll(new SocketConnectionError("Client disconnected"));

  if (socket && !socket.destroyed) {
    socket.end();
    socket = null;
  }

  currentPath = null;
  currentPort = null;
  resetBuffer();
}

/**
 * Returns true when connected to the worker socket.
 */
export function isConnected(): boolean {
  return socket !== null && !socket.destroyed;
}

/**
 * Returns observability stats for the socket client.
 */
export function getStats(): {
  pendingRequests: number;
  connected: boolean;
  reconnecting: boolean;
} {
  return {
    pendingRequests: pending.size,
    connected: isConnected(),
    reconnecting,
  };
}
