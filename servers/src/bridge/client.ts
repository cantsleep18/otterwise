import * as net from "node:net";
import { randomUUID } from "node:crypto";

// --- Error classes ---

export class SocketConnectionError extends Error {
  constructor(
    public readonly socketPath: string,
    cause?: Error,
  ) {
    super(`Failed to connect to socket: ${socketPath}`, { cause });
    this.name = "SocketConnectionError";
  }
}

export class SocketTimeoutError extends Error {
  constructor(
    public readonly socketPath: string,
    public readonly timeoutMs: number,
  ) {
    super(`Socket request timed out after ${timeoutMs}ms: ${socketPath}`);
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

// --- Constants ---

const DEFAULT_TIMEOUT_MS = 60_000;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024; // 2 MB

// --- JSON-RPC types ---

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: string;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponseSuccess {
  jsonrpc: "2.0";
  id: string;
  result: unknown;
}

interface JsonRpcResponseError {
  jsonrpc: "2.0";
  id: string;
  error: { code: number; message: string; data?: unknown };
}

type JsonRpcResponse = JsonRpcResponseSuccess | JsonRpcResponseError;

// --- Client ---

export async function sendRequest<T>(
  socketPath: string,
  method: string,
  params?: Record<string, unknown>,
  timeout: number = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const id = randomUUID();
  const request: JsonRpcRequest = {
    jsonrpc: "2.0",
    id,
    method,
    ...(params !== undefined && { params }),
  };

  return new Promise<T>((resolve, reject) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let buffer = "";
    let totalBytes = 0;

    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      fn();
    };

    const cleanup = () => {
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
      socket.removeListener("data", onData);
      socket.removeListener("error", onError);
      socket.removeListener("close", onClose);
      socket.destroy();
    };

    // Determine connection target: TCP or Unix socket
    const socket = createConnection(socketPath);

    function onError(err: Error) {
      settle(() =>
        reject(new SocketConnectionError(socketPath, err)),
      );
    }

    function onClose() {
      settle(() =>
        reject(new SocketConnectionError(socketPath)),
      );
    }

    function onData(chunk: Buffer) {
      totalBytes += chunk.length;
      if (totalBytes > MAX_RESPONSE_BYTES) {
        settle(() =>
          reject(
            new Error(
              `Response exceeded ${MAX_RESPONSE_BYTES} byte limit from ${socketPath}`,
            ),
          ),
        );
        return;
      }

      buffer += chunk.toString("utf-8");

      // Newline-delimited JSON: process complete lines
      let newlineIdx: number;
      while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newlineIdx).trim();
        buffer = buffer.slice(newlineIdx + 1);

        if (line.length === 0) continue;

        let parsed: JsonRpcResponse;
        try {
          parsed = JSON.parse(line) as JsonRpcResponse;
        } catch {
          // Skip malformed lines
          continue;
        }

        // Only handle the response that matches our request id
        if (parsed.id !== id) continue;

        if ("error" in parsed && parsed.error) {
          settle(() =>
            reject(
              new JsonRpcError(
                parsed.error.code,
                parsed.error.message,
                parsed.error.data,
              ),
            ),
          );
        } else {
          settle(() => resolve((parsed as JsonRpcResponseSuccess).result as T));
        }
        return;
      }
    }

    socket.on("error", onError);
    socket.on("close", onClose);

    socket.once("connect", () => {
      // Start timeout only after connection is established
      timer = setTimeout(() => {
        settle(() => reject(new SocketTimeoutError(socketPath, timeout)));
      }, timeout);

      socket.on("data", onData);

      // Send the JSON-RPC request, newline-terminated
      socket.write(JSON.stringify(request) + "\n");
    });
  });
}

function createConnection(socketPath: string): net.Socket {
  if (socketPath.startsWith("tcp:")) {
    const portStr = socketPath.slice(4);
    const port = parseInt(portStr, 10);
    if (isNaN(port) || port < 1 || port > 65535) {
      throw new SocketConnectionError(
        socketPath,
        new Error(`Invalid TCP port: ${portStr}`),
      );
    }
    return net.createConnection({ port, host: "127.0.0.1" });
  }
  return net.createConnection(socketPath);
}
