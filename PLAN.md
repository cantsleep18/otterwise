# Otterwise Python REPL Refactor: IPython+JSON-line → exec()+Unix Socket+JSON-RPC 2.0

## Overview

Replace the IPython-based Python worker and stdin/stdout JSON-line IPC with a plain
`exec()` worker that exposes a Unix domain socket server speaking JSON-RPC 2.0.
The TypeScript side gets a socket client that replaces the current `ipc.ts` bridge.

**Non-goals**: changing the MCP server framework, the notebook format, or the Zod
schema structure in `index.ts`.

---

## 1. File-by-File Changes

### Files DELETED

| File | Reason |
|------|--------|
| `servers/python-repl/src/bridge/ipc.ts` | Replaced by `socket-client.ts` — stdin/stdout JSON-line protocol is gone |

### Files REWRITTEN (major changes)

| File | Summary |
|------|---------|
| `servers/python-repl/worker/worker.py` | IPython → `exec()` + Unix socket server + JSON-RPC 2.0 |
| `servers/python-repl/src/bridge/python-bridge.ts` | Spawn worker, connect via socket client instead of stdin/stdout |
| `servers/python-repl/src/bridge/types.ts` | Replace custom request/response types with JSON-RPC 2.0 types |
| `servers/python-repl/src/index.ts` | Add `interrupt_execution` and `reset_kernel` tools; update tool descriptions |
| `servers/python-repl/src/tools/execute.ts` | Accept session ID; no interface change to bridge call |
| `servers/python-repl/src/tools/state.ts` | Minor — bridge API stays the same |

### Files CREATED (new)

| File | Purpose |
|------|---------|
| `servers/python-repl/src/bridge/socket-client.ts` | Unix socket client: connect, send JSON-RPC requests, receive responses |
| `servers/python-repl/src/bridge/session-lock.ts` | Session ID generation, PID-file locking, stale lock detection |
| `servers/python-repl/src/bridge/paths.ts` | Platform-specific socket path + lock file path resolution |
| `servers/python-repl/src/tools/interrupt.ts` | New MCP tool: send SIGINT to running execution |
| `servers/python-repl/src/tools/reset.ts` | New MCP tool: reset kernel namespace |

### Files UNCHANGED

| File | Why |
|------|-----|
| `servers/python-repl/src/notebook/types.ts` | Notebook types are independent of IPC mechanism |
| `servers/python-repl/src/notebook/format.ts` | Notebook I/O is independent of IPC mechanism |
| `servers/python-repl/src/tools/install.ts` | Uses `execFile` directly — no bridge dependency |
| `servers/python-repl/src/tools/notebook.ts` | Only change: bridge type import path (if any) |
| `servers/python-repl/tsconfig.json` | No changes needed |

### Test Files UPDATED

| File | Changes |
|------|---------|
| `servers/python-repl/src/tools/execute.test.ts` | Update mock bridge shape (same methods, same signatures) |
| `servers/python-repl/src/tools/state.test.ts` | Minimal — mock shape unchanged |
| `servers/python-repl/src/tools/install.test.ts` | No changes (no bridge dependency) |
| `servers/python-repl/src/notebook/format.test.ts` | No changes |
| `tests/fixtures/mock-bridge.ts` | Update to match new bridge interface (add `interrupt`, `reset`) |
| `tests/fixtures/ipc-messages.ts` | Rewrite: JSON-RPC 2.0 fixtures instead of JSON-line fixtures |

### Config Files UPDATED

| File | Changes |
|------|---------|
| `servers/python-repl/package.json` | No new runtime deps (MCP SDK + zod stay). No changes needed. |
| `.mcp.json` | No changes — still launches `tsx servers/python-repl/src/index.ts` |
| `settings.json` | Add permissions for new tools: `mcp__python-repl__interrupt_execution`, `mcp__python-repl__reset_kernel` |

---

## 2. Interface Definitions: JSON-RPC 2.0 Methods

The Python worker exposes these JSON-RPC 2.0 methods over Unix socket.

### 2.1 `execute`

Execute Python code in the persistent namespace.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": "uuid-here",
  "method": "execute",
  "params": {
    "code": "print('hello')"
  }
}
```

**Success Response:**
```json
{
  "jsonrpc": "2.0",
  "id": "uuid-here",
  "result": {
    "success": true,
    "stdout": "hello\n",
    "stderr": "",
    "figures": []
  }
}
```

**Error Response (Python runtime error — NOT a JSON-RPC error, because execution itself succeeded):**
```json
{
  "jsonrpc": "2.0",
  "id": "uuid-here",
  "result": {
    "success": false,
    "stdout": "",
    "stderr": "ZeroDivisionError: division by zero",
    "figures": []
  }
}
```

`figures` is an array of base64-encoded PNG strings (from matplotlib capture).

### 2.2 `get_state`

Return current namespace variables with type info.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": "uuid-here",
  "method": "get_state",
  "params": {}
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": "uuid-here",
  "result": {
    "variables": {
      "df": { "type": "DataFrame", "shape": [100, 5], "dtypes": { "a": "int64" } },
      "x": { "type": "int" }
    }
  }
}
```

### 2.3 `interrupt`

Send SIGINT to the currently executing code. If nothing is running, this is a no-op.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": "uuid-here",
  "method": "interrupt",
  "params": {}
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": "uuid-here",
  "result": {
    "interrupted": true
  }
}
```

### 2.4 `reset`

Clear the execution namespace (like restarting the kernel, but without restarting the process).

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": "uuid-here",
  "method": "reset",
  "params": {}
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": "uuid-here",
  "result": {
    "reset": true
  }
}
```

### 2.5 JSON-RPC Error Codes

Standard JSON-RPC 2.0 error codes:

| Code | Meaning | When |
|------|---------|------|
| `-32700` | Parse error | Invalid JSON received |
| `-32600` | Invalid request | Missing method/jsonrpc fields |
| `-32601` | Method not found | Unknown method name |
| `-32000` | Worker busy | Execution already in progress (single-threaded) |

Example error response:
```json
{
  "jsonrpc": "2.0",
  "id": null,
  "error": {
    "code": -32700,
    "message": "Parse error",
    "data": "Expecting ',' delimiter: line 1 column 42"
  }
}
```

---

## 3. Socket Path Convention

### 3.1 Path Format

```
<runtime_dir>/otterwise-repl-<session_id>.sock
```

### 3.2 Platform-Specific Runtime Directory

| Platform | Directory | Source |
|----------|-----------|--------|
| Linux | `$XDG_RUNTIME_DIR` or `/tmp` | XDG Base Directory Spec |
| macOS | `$TMPDIR` (e.g., `/var/folders/.../T/`) | macOS convention |
| Windows/WSL | `/tmp` | WSL maps to Linux tmpfs |

### 3.3 Implementation (`paths.ts`)

```typescript
import { tmpdir } from "node:os";
import { join } from "node:path";

export function getSocketDir(): string {
  // Prefer XDG_RUNTIME_DIR (Linux, per-user, tmpfs, correct permissions)
  if (process.env.XDG_RUNTIME_DIR) {
    return process.env.XDG_RUNTIME_DIR;
  }
  // Fallback to OS tmpdir
  return tmpdir();
}

export function getSocketPath(sessionId: string): string {
  return join(getSocketDir(), `otterwise-repl-${sessionId}.sock`);
}

export function getLockPath(sessionId: string): string {
  return join(getSocketDir(), `otterwise-repl-${sessionId}.lock`);
}
```

### 3.4 Socket Permissions

- Worker creates socket with `0o600` (owner-only read/write)
- Lock file created with `0o600`
- On startup, worker unlinks any stale socket at the target path before binding

---

## 4. Session ID and Locking Strategy

### 4.1 Session ID Format

```
<timestamp>-<random>
```

Example: `1711234567890-a1b2c3d4`

- Timestamp: `Date.now()` milliseconds
- Random: 8 hex characters from `crypto.randomBytes(4)`
- Human-readable, sortable, collision-resistant

### 4.2 Lock File Format

Plain text file at `getLockPath(sessionId)` containing:

```
<worker_pid>
```

Single line, no trailing newline. Contains the PID of the Python worker process.

### 4.3 Locking Protocol

**Acquisition (TypeScript side, in `python-bridge.ts`):**

1. Generate new session ID
2. Compute socket path and lock path
3. Spawn Python worker with `--socket-path <path>` argument
4. Worker writes lock file with its PID, then binds socket
5. TypeScript waits for socket to become connectable (poll with backoff)
6. Session is now active

**Stale Lock Detection (TypeScript side, in `session-lock.ts`):**

1. Read lock file → get PID
2. Check if PID is alive: `process.kill(pid, 0)` (signal 0 = existence check)
3. If PID is dead: unlink lock file + socket file, return "stale"
4. If PID is alive: return "locked"

**Release (TypeScript side, in `python-bridge.ts` shutdown):**

1. Send `SIGTERM` to worker
2. Worker catches SIGTERM, closes socket, unlinks socket file, unlinks lock file, exits
3. If worker doesn't exit within 5s, send `SIGKILL`
4. TypeScript unlinks lock + socket files as fallback cleanup

### 4.4 `session-lock.ts` Interface

```typescript
export interface SessionLock {
  sessionId: string;
  socketPath: string;
  lockPath: string;
  workerPid: number;
}

/** Create lock file. Throws if lock already exists and PID is alive. */
export async function acquireLock(sessionId: string, pid: number): Promise<SessionLock>;

/** Check if a lock file exists and its PID is alive. */
export async function checkLock(sessionId: string): Promise<"free" | "locked" | "stale">;

/** Remove lock file and socket file. */
export async function releaseLock(sessionId: string): Promise<void>;

/** Clean up any stale locks in the socket directory. */
export async function cleanStaleLocks(): Promise<void>;
```

---

## 5. Worker Lifecycle

### 5.1 Spawn Sequence

```
TypeScript (python-bridge.ts)          Python (worker.py)
──────────────────────────             ──────────────────
1. Generate sessionId
2. Compute socketPath, lockPath
3. spawn("python3", [workerPath,
         "--socket-path", socketPath])
                                       4. Parse --socket-path arg
                                       5. Write PID to lock file
                                       6. Unlink stale socket (if any)
                                       7. Bind Unix socket
                                       8. Print "READY\n" to stdout
9. Read "READY\n" from stdout
   (with 10s timeout)
10. Connect socket client
11. Session is live
```

### 5.2 Ready Detection

The worker prints a single line `READY\n` to stdout after the socket is bound and
listening. TypeScript reads this line with a 10-second timeout. If the timeout fires,
the worker is killed and an error is thrown.

This is a one-shot handshake — after `READY`, stdout is not used for any other
communication. All subsequent IPC goes through the Unix socket.

### 5.3 Normal Shutdown

```
TypeScript                              Python
──────────                              ──────
1. bridge.shutdown() called
2. Close socket client connection
3. Send SIGTERM to worker
                                        4. SIGTERM handler fires
                                        5. Close socket server
                                        6. Unlink socket file
                                        7. Unlink lock file
                                        8. sys.exit(0)
9. 'exit' event fires on ChildProcess
10. releaseLock() as fallback cleanup
```

### 5.4 Crash Recovery

If the worker crashes (unexpected exit):

1. `ChildProcess` 'exit' event fires in TypeScript
2. `python-bridge.ts` sets `this.process = null`
3. Any pending socket requests get rejected with "connection closed"
4. Next MCP tool call triggers `getProcess()` → detects `process === null`
5. New worker is spawned with a **new session ID**
6. Old lock + socket files are cleaned up via `releaseLock(oldSessionId)`

### 5.5 Worker Timeout During Execution

- Socket client sends request with a configurable timeout (default: 60s)
- If timeout fires: reject the promise, but do NOT kill the worker
- The `interrupt` tool can be used to cancel long-running execution
- If the worker becomes truly unresponsive (no response to interrupt within 5s),
  then kill and respawn

---

## 6. Migration Path for Each MCP Tool

### 6.1 `execute_python`

| Aspect | Before | After |
|--------|--------|-------|
| Bridge call | `bridge.execute(code)` | `bridge.execute(code)` (same signature) |
| Wire format | `{"type":"execute","code":"...","id":"..."}` via stdin | `{"jsonrpc":"2.0","method":"execute","params":{"code":"..."},"id":"..."}` via socket |
| Response shape | `ExecuteResponse` with `success/stdout/stderr/figures` | Same fields, wrapped in `result` key |
| Tool handler in index.ts | No change | No change |
| Notebook integration | Unchanged | Unchanged |

The `PythonBridge.execute()` method signature stays the same. Internal implementation
changes from stdin write to socket client call.

### 6.2 `start_notebook`

| Aspect | Before | After |
|--------|--------|-------|
| Implementation | Calls `bridge.execute()` for setup code | Same — calls `bridge.execute()` |
| Changes | None | None beyond what `execute` changes handle |

### 6.3 `get_kernel_state`

| Aspect | Before | After |
|--------|--------|-------|
| Bridge call | `bridge.getState()` | `bridge.getState()` (same signature) |
| Wire format | `{"type":"get_state","id":"..."}` via stdin | `{"jsonrpc":"2.0","method":"get_state","params":{},"id":"..."}` via socket |
| Response shape | `StateResponse` with `variables` | Same fields, wrapped in `result` key |

### 6.4 `install_package`

| Aspect | Before | After |
|--------|--------|-------|
| Implementation | Direct `execFile("python3", ["-m", "pip", ...])` | Same — no bridge dependency |
| Changes | None | None |

### 6.5 `interrupt_execution` (NEW)

```typescript
// servers/python-repl/src/tools/interrupt.ts
export async function interruptExecution(bridge: PythonBridge): Promise<string> {
  const result = await bridge.interrupt();
  return JSON.stringify(result);
}
```

MCP tool registration in `index.ts`:
```typescript
server.tool(
  "interrupt_execution",
  "Interrupt the currently running Python execution.",
  {},
  async () => { /* call interruptExecution(bridge) */ }
);
```

### 6.6 `reset_kernel` (NEW)

```typescript
// servers/python-repl/src/tools/reset.ts
export async function resetKernel(bridge: PythonBridge): Promise<string> {
  const result = await bridge.reset();
  return JSON.stringify(result);
}
```

MCP tool registration in `index.ts`:
```typescript
server.tool(
  "reset_kernel",
  "Reset the Python kernel namespace (clear all variables).",
  {},
  async () => { /* call resetKernel(bridge) */ }
);
```

---

## 7. What Stays the Same

| Component | Details |
|-----------|---------|
| **MCP server framework** | `@modelcontextprotocol/sdk` with `McpServer` + `StdioServerTransport` |
| **Zod schemas** | Tool parameter validation in `index.ts` unchanged |
| **Notebook format** | `nbformat 4.5`, same `types.ts`, same `format.ts` |
| **Notebook I/O** | `readNotebook`, `writeNotebook`, `appendCell`, cache — all unchanged |
| **install_package** | Still uses `execFile` directly, whitelist logic unchanged |
| **package.json dependencies** | `@modelcontextprotocol/sdk`, `zod` — no new runtime deps |
| **Dev dependencies** | `tsx`, `typescript`, `vitest`, `@types/node` — unchanged |
| **tsconfig.json** | No changes |
| **Tool handler pattern** | Each tool is a pure function taking bridge + params, returning JSON string |
| **MCP server name/version** | `otterwise-python-repl` v1.0.0 |
| **Test framework** | vitest, same mock pattern (mock bridge object) |
| **Fixture structure** | `tests/fixtures/` directory layout preserved |

---

## 8. Detailed Component Specifications

### 8.1 Python Worker (`worker.py`) — Complete Design

```python
"""
Otterwise Python REPL Worker
Unix domain socket server, JSON-RPC 2.0 protocol, plain exec() execution.
Zero pip dependencies — stdlib only.
"""

# Imports: sys, json, io, os, signal, socket, threading, traceback, base64
# NO IPython. NO third-party imports in the worker itself.

# --- Argument parsing ---
# sys.argv: ["worker.py", "--socket-path", "/tmp/otterwise-repl-xxx.sock"]

# --- Globals ---
# _namespace: dict = {"__builtins__": __builtins__}   # persistent exec() namespace
# _executing: bool = False                            # guard for single-threaded execution
# _exec_thread: threading.Thread | None = None        # for interrupt support

# --- Socket server ---
# 1. Write PID to lock file
# 2. Unlink stale socket if exists
# 3. socket.AF_UNIX, socket.SOCK_STREAM
# 4. bind(), chmod 0o600, listen(1)
# 5. Print "READY\n" to stdout, flush
# 6. Accept loop: one connection at a time (MCP server is single-client)

# --- Request handling ---
# Read newline-delimited JSON-RPC messages from connected client.
# Each complete line is one JSON-RPC request.
# Framing: newline-delimited JSON (one JSON object per line).

# --- execute method ---
# 1. Check _executing → if True, return error -32000 "Worker busy"
# 2. Set _executing = True
# 3. Redirect sys.stdout, sys.stderr to StringIO buffers
# 4. exec(code, _namespace)  — plain exec, no IPython
# 5. Capture matplotlib figures (try/except ImportError — optional)
# 6. Restore sys.stdout, sys.stderr
# 7. Set _executing = False
# 8. Return result

# --- get_state method ---
# Iterate _namespace, skip dunder keys and builtins.
# For each value: type name, optional shape/dtype/dtypes.
# Same logic as current worker, but reads from _namespace dict instead of shell.user_ns.

# --- interrupt method ---
# If _exec_thread is alive: signal the execution thread.
# The worker runs exec() in a separate thread so that the socket accept loop
# can still receive the interrupt request.
# Implementation: use threading.Event or raise KeyboardInterrupt in the exec thread
# via ctypes (PyThreadState_SetAsyncExc).

# --- reset method ---
# Replace _namespace with fresh dict: {"__builtins__": __builtins__}

# --- Signal handlers ---
# SIGTERM: close socket, unlink socket file, unlink lock file, sys.exit(0)
# SIGINT: if executing, raise KeyboardInterrupt in exec thread

# --- matplotlib capture ---
# try:
#     import matplotlib.pyplot as plt
# except ImportError:
#     return []
# Same logic as current worker — optional dependency.
# On worker startup, try to set Agg backend (if matplotlib is importable).
```

### 8.2 Socket Client (`socket-client.ts`) — Complete Design

```typescript
import { connect, Socket } from "node:net";
import { createInterface, Interface } from "node:readline";
import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";

const DEFAULT_TIMEOUT_MS = 60_000;

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: string;
  method: string;
  params: Record<string, unknown>;
}

interface JsonRpcSuccessResponse {
  jsonrpc: "2.0";
  id: string;
  result: unknown;
}

interface JsonRpcErrorResponse {
  jsonrpc: "2.0";
  id: string | null;
  error: { code: number; message: string; data?: unknown };
}

type JsonRpcResponse = JsonRpcSuccessResponse | JsonRpcErrorResponse;

export class SocketClient extends EventEmitter {
  private socket: Socket | null = null;
  private readline: Interface | null = null;
  private pending = new Map<string, {
    resolve: (result: unknown) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }>();

  /**
   * Connect to the worker's Unix socket.
   * Retries with exponential backoff until the socket is available or timeout.
   */
  async connect(socketPath: string, timeout = 10_000): Promise<void>;

  /**
   * Send a JSON-RPC request and wait for the matching response.
   */
  async request(method: string, params: Record<string, unknown> = {}, timeout = DEFAULT_TIMEOUT_MS): Promise<unknown>;

  /**
   * Close the socket connection. Rejects all pending requests.
   */
  close(): void;

  /**
   * Whether the socket is currently connected.
   */
  get connected(): boolean;
}
```

**Framing**: Newline-delimited JSON. Each JSON-RPC message is a single line terminated
by `\n`. The readline interface parses one line at a time and JSON.parse()s each line.
This matches the current ipc.ts approach but over a socket instead of stdio pipes.

### 8.3 PythonBridge (`python-bridge.ts`) — Updated Design

```typescript
import { spawn, ChildProcess } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";
import { SocketClient } from "./socket-client.js";
import { acquireLock, releaseLock } from "./session-lock.js";
import { getSocketPath, getLockPath } from "./paths.js";
import type { ExecuteResponse, StateResponse, InterruptResponse, ResetResponse } from "./types.js";

export class PythonBridge {
  private process: ChildProcess | null = null;
  private client: SocketClient | null = null;
  private sessionId: string | null = null;

  private async spawnWorker(): Promise<void> {
    // 1. Generate session ID
    // 2. Compute paths
    // 3. Spawn python3 worker.py --socket-path <path>
    // 4. Wait for "READY\n" on stdout (10s timeout)
    // 5. acquireLock(sessionId, pid)
    // 6. client = new SocketClient()
    // 7. client.connect(socketPath)
  }

  private async ensureReady(): Promise<SocketClient> {
    // If no process or process exited → spawnWorker()
    // Return this.client
  }

  async execute(code: string): Promise<ExecuteResponse> {
    const client = await this.ensureReady();
    const result = await client.request("execute", { code });
    return result as ExecuteResponse;
  }

  async getState(): Promise<StateResponse> {
    const client = await this.ensureReady();
    const result = await client.request("get_state");
    return result as StateResponse;
  }

  async interrupt(): Promise<InterruptResponse> {
    const client = await this.ensureReady();
    const result = await client.request("interrupt", {}, 5_000);
    return result as InterruptResponse;
  }

  async reset(): Promise<ResetResponse> {
    const client = await this.ensureReady();
    const result = await client.request("reset");
    return result as ResetResponse;
  }

  shutdown(): void {
    // 1. client.close()
    // 2. SIGTERM → process
    // 3. 5s timeout → SIGKILL
    // 4. releaseLock(sessionId)
    // 5. Null out process, client, sessionId
  }
}
```

### 8.4 Updated Types (`types.ts`)

```typescript
// --- JSON-RPC 2.0 base types ---

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: string;
  method: string;
  params: Record<string, unknown>;
}

export interface JsonRpcSuccessResponse {
  jsonrpc: "2.0";
  id: string;
  result: unknown;
}

export interface JsonRpcErrorResponse {
  jsonrpc: "2.0";
  id: string | null;
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export type JsonRpcResponse = JsonRpcSuccessResponse | JsonRpcErrorResponse;

// --- Method-specific result types (unwrapped from JSON-RPC envelope) ---

export interface ExecuteResult {
  success: boolean;
  stdout: string;
  stderr: string;
  figures: string[]; // base64 PNGs
}

export interface StateResult {
  variables: Record<string, VariableInfo>;
}

export interface InterruptResult {
  interrupted: boolean;
}

export interface ResetResult {
  reset: boolean;
}

export interface VariableInfo {
  type: string;
  shape?: number[];
  dtype?: string;
  dtypes?: Record<string, string>;
}

// --- Convenience aliases for bridge return types ---
// These match the "result" field unwrapped from JSON-RPC responses.

export type ExecuteResponse = ExecuteResult;
export type StateResponse = StateResult;
export type InterruptResponse = InterruptResult;
export type ResetResponse = ResetResult;
```

---

## 9. Worker Threading Model

The Python worker uses **one thread for socket I/O** and **one thread for code execution**.

```
Main Thread (socket accept + readline loop)
  │
  ├── Receives JSON-RPC request
  ├── If method == "execute":
  │     ├── If _exec_thread is alive → return error -32000
  │     └── Else → start _exec_thread = Thread(target=do_exec, args=(code,))
  │              → wait for thread to finish (with internal Event)
  │              → send response
  │
  ├── If method == "interrupt":
  │     └── If _exec_thread is alive → raise KeyboardInterrupt in it
  │
  ├── If method == "reset":
  │     └── If _exec_thread is alive → return error -32000
  │         Else → reset _namespace
  │
  └── If method == "get_state":
        └── If _exec_thread is alive → return error -32000
            Else → read _namespace
```

This design allows `interrupt` to work even when `execute` is blocked —
the socket I/O loop remains responsive.

---

## 10. Implementation Order

Recommended implementation order to minimize conflicts between agents:

1. **paths.ts** + **session-lock.ts** — no dependencies on other new files
2. **worker.py** — rewrite independently, testable standalone
3. **types.ts** — update types (other files depend on these)
4. **socket-client.ts** — depends on types.ts
5. **python-bridge.ts** — depends on socket-client.ts, session-lock.ts, paths.ts
6. **tools/interrupt.ts** + **tools/reset.ts** — depend on updated bridge
7. **index.ts** — register new tools
8. **Test fixtures** — update to JSON-RPC format
9. **Test files** — update mocks and assertions
10. **Config files** — settings.json permissions
11. **Delete ipc.ts** — after all references removed

---

## 11. Agent Assignment Map

| Agent | Files | Dependencies |
|-------|-------|--------------|
| **worker-rewriter** | `worker/worker.py` | None (standalone Python) |
| **socket-client-dev** | `src/bridge/socket-client.ts` | `types.ts` (can use draft types) |
| **session-lock-dev** | `src/bridge/session-lock.ts`, `src/bridge/paths.ts` | None |
| **bridge-refactorer** | `src/bridge/python-bridge.ts`, `src/bridge/types.ts` | socket-client.ts, session-lock.ts, paths.ts |
| **tools-refactorer** | `src/tools/interrupt.ts`, `src/tools/reset.ts`, update `src/tools/execute.ts`, `src/tools/state.ts` | Updated bridge |
| **index-refactorer** | `src/index.ts` | All tools, updated bridge |
| **dependency-cleaner** | `package.json` | All source changes complete |
| **config-updater** | `settings.json`, `.mcp.json` | New tool names known |
| **test-migrator** | All `*.test.ts`, `tests/fixtures/*` | All source changes complete |

---

## 12. Key Design Decisions & Rationale

1. **exec() over IPython**: IPython is a large dependency (~30MB) that requires pip
   install. Plain `exec()` is stdlib, zero-install, and sufficient for our use case.
   We lose syntax highlighting and magic commands, which we never used.

2. **Unix socket over stdin/stdout**: Decouples the IPC from the process stdio,
   allowing the worker to use stdout for the READY handshake and stderr for logging.
   Enables future multi-client scenarios. More robust framing.

3. **JSON-RPC 2.0 over custom JSON-line**: Standard protocol with well-defined error
   codes. Makes the worker independently testable with any JSON-RPC client (e.g., `socat`).

4. **Newline-delimited framing**: Simple, matches current approach. Each JSON-RPC
   message is one line. No length-prefix needed for our message sizes.

5. **Threading for interrupt support**: exec() blocks the thread. Running it in a
   separate thread lets the socket loop stay responsive to interrupt requests.
   Alternative (signals from TS side) is fragile across platforms.

6. **Session ID in socket path**: Prevents conflicts when multiple instances run.
   Lock file enables stale detection. PID validation catches zombie processes.

7. **READY handshake over stdout**: Simple, reliable, no polling needed. Worker
   prints READY only after socket is bound and listening — guarantees the socket
   is connectable when TypeScript tries to connect.

8. **matplotlib as optional**: `try: import matplotlib` pattern. If not installed,
   figure capture returns empty array. Worker itself needs zero pip packages.
