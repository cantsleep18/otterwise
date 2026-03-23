import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createServer, Server, Socket as NetSocket } from "node:net";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  connect,
  sendRequest,
  disconnect,
  isConnected,
  SocketConnectionError,
  SocketTimeoutError,
  JsonRpcError,
} from "./socket-client.js";

let tmpDir: string;
let server: Server;
let socketPath: string;
let connections: NetSocket[];

function startMockServer(
  handler: (data: string, write: (response: string) => void) => void,
): Promise<void> {
  connections = [];
  return new Promise((resolve) => {
    server = createServer((conn) => {
      connections.push(conn);
      let buffer = "";
      conn.on("data", (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop()!;
        for (const line of lines) {
          if (line.trim()) {
            handler(line, (response) => {
              if (!conn.destroyed) {
                conn.write(response + "\n");
              }
            });
          }
        }
      });
    });
    server.listen(socketPath, () => resolve());
  });
}

function stopMockServer(): Promise<void> {
  return new Promise((resolve) => {
    // Close all client connections first
    for (const conn of connections) {
      if (!conn.destroyed) conn.destroy();
    }
    connections = [];
    if (server) {
      server.close(() => resolve());
    } else {
      resolve();
    }
  });
}

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "otterwise-socket-test-"));
  socketPath = join(tmpDir, "test.sock");
  connections = [];
});

afterEach(async () => {
  disconnect();
  await stopMockServer();
  // Small delay to let socket cleanup complete
  await new Promise((r) => setTimeout(r, 50));
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("connect / disconnect", () => {
  it("connects to a Unix socket server", async () => {
    await startMockServer(() => {});
    await connect(socketPath);
    expect(isConnected()).toBe(true);
  });

  it("isConnected returns false before connecting", () => {
    expect(isConnected()).toBe(false);
  });

  it("disconnect sets isConnected to false", async () => {
    await startMockServer(() => {});
    await connect(socketPath);
    disconnect();
    expect(isConnected()).toBe(false);
  });

  it("throws SocketConnectionError for invalid path", async () => {
    await expect(connect("/tmp/nonexistent-socket-path-xyz.sock")).rejects.toThrow(
      SocketConnectionError,
    );
  });
});

describe("sendRequest — JSON-RPC 2.0", () => {
  it("sends a valid JSON-RPC 2.0 request and receives result", async () => {
    await startMockServer((data, write) => {
      const req = JSON.parse(data);
      write(
        JSON.stringify({
          jsonrpc: "2.0",
          id: req.id,
          result: { success: true, stdout: "hi" },
        }),
      );
    });

    await connect(socketPath);
    const result = await sendRequest<{ success: boolean; stdout: string }>(
      "execute",
      { code: "print('hi')" },
    );
    expect(result.success).toBe(true);
    expect(result.stdout).toBe("hi");
  });

  it("sends request without params when none given", async () => {
    let receivedRequest: any;
    await startMockServer((data, write) => {
      receivedRequest = JSON.parse(data);
      write(
        JSON.stringify({
          jsonrpc: "2.0",
          id: receivedRequest.id,
          result: { variables: {} },
        }),
      );
    });

    await connect(socketPath);
    await sendRequest("get_state");
    expect(receivedRequest.params).toBeUndefined();
  });

  it("rejects with JsonRpcError on error response", async () => {
    await startMockServer((data, write) => {
      const req = JSON.parse(data);
      write(
        JSON.stringify({
          jsonrpc: "2.0",
          id: req.id,
          error: { code: -32600, message: "Invalid Request" },
        }),
      );
    });

    await connect(socketPath);
    await expect(sendRequest("bad_method")).rejects.toThrow(JsonRpcError);
  });

  it("rejects with SocketConnectionError when not connected", async () => {
    await expect(sendRequest("test")).rejects.toThrow(SocketConnectionError);
  });
});

describe("sendRequest — timeout", () => {
  it("rejects with SocketTimeoutError after timeout", async () => {
    // Server accepts connections but never responds
    await startMockServer(() => {
      // intentionally empty — no response
    });
    await connect(socketPath);

    await expect(sendRequest("slow_method", undefined, 200)).rejects.toThrow(
      SocketTimeoutError,
    );
  });
});

describe("JSON-RPC error details", () => {
  it("preserves error code and data", async () => {
    await startMockServer((data, write) => {
      const req = JSON.parse(data);
      write(
        JSON.stringify({
          jsonrpc: "2.0",
          id: req.id,
          error: {
            code: -32001,
            message: "Execution failed",
            data: { traceback: "line 1\nline 2" },
          },
        }),
      );
    });

    await connect(socketPath);
    try {
      await sendRequest("execute", { code: "bad" });
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(JsonRpcError);
      const rpcErr = err as JsonRpcError;
      expect(rpcErr.code).toBe(-32001);
      expect(rpcErr.message).toBe("Execution failed");
      expect(rpcErr.data).toEqual({ traceback: "line 1\nline 2" });
    }
  });
});
