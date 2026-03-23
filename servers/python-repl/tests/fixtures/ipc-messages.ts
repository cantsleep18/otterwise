/**
 * JSON-RPC 2.0 message fixtures for testing the socket-based IPC protocol.
 */

// ── Requests ────────────────────────────────────────────────────

export const executeRequest = {
  jsonrpc: "2.0" as const,
  method: "execute",
  params: { code: "print('hello')" },
  id: "req-001",
};

export const getStateRequest = {
  jsonrpc: "2.0" as const,
  method: "get_state",
  id: "req-002",
};

export const interruptRequest = {
  jsonrpc: "2.0" as const,
  method: "interrupt",
  id: "req-003",
};

export const resetRequest = {
  jsonrpc: "2.0" as const,
  method: "reset",
  id: "req-004",
};

// ── Success responses ───────────────────────────────────────────

export const executeSuccessResponse = {
  jsonrpc: "2.0" as const,
  id: "req-001",
  result: {
    success: true,
    stdout: "hello\n",
    stderr: "",
    figures: [],
  },
};

export const executeWithFiguresResponse = {
  jsonrpc: "2.0" as const,
  id: "req-001",
  result: {
    success: true,
    stdout: "",
    stderr: "",
    figures: ["iVBORw0KGgoAAAANSUhEUg=="],
  },
};

export const executeErrorResponse = {
  jsonrpc: "2.0" as const,
  id: "req-001",
  result: {
    success: false,
    stdout: "",
    stderr: "NameError: name 'x' is not defined",
    figures: [],
  },
};

export const stateResponse = {
  jsonrpc: "2.0" as const,
  id: "req-002",
  result: {
    variables: {
      df: { type: "DataFrame", shape: [100, 5], dtypes: { a: "int64", b: "float64" } },
      x: { type: "int" },
    },
    memoryUsage: { rss: 52428800, vms: 104857600 },
  },
};

export const emptyStateResponse = {
  jsonrpc: "2.0" as const,
  id: "req-002",
  result: {
    variables: {},
    memoryUsage: { rss: 10485760, vms: 20971520 },
  },
};

export const interruptResponse = {
  jsonrpc: "2.0" as const,
  id: "req-003",
  result: { interrupted: true },
};

export const resetResponse = {
  jsonrpc: "2.0" as const,
  id: "req-004",
  result: { reset: true },
};

// ── Error responses (JSON-RPC protocol errors) ──────────────────

export const jsonRpcParseError = {
  jsonrpc: "2.0" as const,
  id: null,
  error: {
    code: -32700,
    message: "Parse error",
  },
};

export const jsonRpcMethodNotFound = {
  jsonrpc: "2.0" as const,
  id: "req-001",
  error: {
    code: -32601,
    message: "Method not found",
  },
};

export const jsonRpcExecutionError = {
  jsonrpc: "2.0" as const,
  id: "req-001",
  error: {
    code: -32001,
    message: "Execution failed",
    data: { traceback: "Traceback (most recent call last):\n  File ...\nNameError" },
  },
};
