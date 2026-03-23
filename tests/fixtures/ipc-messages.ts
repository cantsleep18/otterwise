/**
 * Test fixtures for JSON-line IPC messages between TS server and Python worker.
 *
 * Usage:
 *   import { requests, responses } from "../fixtures/ipc-messages.js";
 *   // requests.execute — sample ExecuteRequest
 *   // responses.successWithOutput — sample ExecuteResponse with stdout
 */

import type {
  ExecuteRequest,
  GetStateRequest,
  ExecuteResponse,
  StateResponse,
  ErrorResponse,
} from "../../servers/python-repl/src/bridge/types.js";

// ── Request fixtures (TS → Python) ──────────────────────────────

export const requests = {
  /** Simple print statement */
  execute: {
    id: "req-001",
    type: "execute" as const,
    code: "print('hello world')",
  } satisfies ExecuteRequest,

  /** Multi-line pandas code */
  executeMultiline: {
    id: "req-002",
    type: "execute" as const,
    code: [
      "import pandas as pd",
      "df = pd.read_csv('/data/test.csv')",
      "print(df.shape)",
    ].join("\n"),
  } satisfies ExecuteRequest,

  /** Code that produces a matplotlib figure */
  executeWithFigure: {
    id: "req-003",
    type: "execute" as const,
    code: [
      "import matplotlib.pyplot as plt",
      "plt.plot([1, 2, 3], [1, 4, 9])",
      "plt.title('Test Plot')",
      "plt.show()",
    ].join("\n"),
  } satisfies ExecuteRequest,

  /** Code that will raise an error */
  executeWithError: {
    id: "req-004",
    type: "execute" as const,
    code: "1 / 0",
  } satisfies ExecuteRequest,

  /** Empty code string */
  executeEmpty: {
    id: "req-005",
    type: "execute" as const,
    code: "",
  } satisfies ExecuteRequest,

  /** Get kernel state request */
  getState: {
    id: "req-006",
    type: "get_state" as const,
  } satisfies GetStateRequest,
};

// ── Response fixtures (Python → TS) ─────────────────────────────

/** Minimal valid base64 PNG (1x1 transparent pixel) */
export const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

export const responses = {
  /** Successful execution with stdout output */
  successWithOutput: {
    id: "req-001",
    type: "result" as const,
    success: true,
    stdout: "hello world\n",
    stderr: "",
    figures: [],
  } satisfies ExecuteResponse,

  /** Successful execution with no output (e.g., assignment) */
  successSilent: {
    id: "req-002",
    type: "result" as const,
    success: true,
    stdout: "",
    stderr: "",
    figures: [],
  } satisfies ExecuteResponse,

  /** Successful execution with figure output */
  successWithFigure: {
    id: "req-003",
    type: "result" as const,
    success: true,
    stdout: "",
    stderr: "",
    figures: [TINY_PNG_BASE64],
  } satisfies ExecuteResponse,

  /** Successful execution with multiple figures */
  successWithMultipleFigures: {
    id: "req-003b",
    type: "result" as const,
    success: true,
    stdout: "",
    stderr: "",
    figures: [TINY_PNG_BASE64, TINY_PNG_BASE64],
  } satisfies ExecuteResponse,

  /** Successful execution with both stdout and stderr */
  successWithStdoutAndStderr: {
    id: "req-002b",
    type: "result" as const,
    success: true,
    stdout: "(20, 10)\n",
    stderr: "FutureWarning: some deprecation\n",
    figures: [],
  } satisfies ExecuteResponse,

  /** Failed execution — Python runtime error */
  executionError: {
    id: "req-004",
    type: "result" as const,
    success: false,
    stdout: "",
    stderr: "\nZeroDivisionError: division by zero",
    figures: [],
  } satisfies ExecuteResponse,

  /** Failed execution — syntax error */
  syntaxError: {
    id: "req-004b",
    type: "result" as const,
    success: false,
    stdout: "",
    stderr: "\nSyntaxError: invalid syntax",
    figures: [],
  } satisfies ExecuteResponse,

  /** Kernel state with variables loaded */
  stateWithVariables: {
    id: "req-006",
    type: "state" as const,
    variables: {
      df: {
        type: "DataFrame",
        shape: [20, 10],
        dtypes: {
          id: "int64",
          date: "object",
          category: "object",
          region: "object",
          revenue: "float64",
          units_sold: "int64",
          price: "float64",
          discount: "float64",
          customer_age: "int64",
          satisfaction_score: "float64",
        },
      },
      x: { type: "int" },
      arr: { type: "ndarray", shape: [100], dtype: "float64" },
      series: { type: "Series", shape: [20], dtype: "float64" },
    },
  } satisfies StateResponse,

  /** Kernel state — empty (fresh kernel) */
  stateEmpty: {
    id: "req-006b",
    type: "state" as const,
    variables: {},
  } satisfies StateResponse,

  /** IPC-level error — unknown message type */
  errorUnknownType: {
    id: "req-999",
    type: "error" as const,
    message: "Unknown type: invalid_type",
  } satisfies ErrorResponse,

  /** IPC-level error — invalid JSON */
  errorInvalidJson: {
    id: "",
    type: "error" as const,
    message: "Invalid JSON: Unexpected token h in JSON at position 0",
  } satisfies ErrorResponse,

  /** IPC-level error — worker error */
  errorWorker: {
    id: "req-007",
    type: "error" as const,
    message: "Worker error: 'code'",
  } satisfies ErrorResponse,
};

// ── Raw JSON lines (for testing stdin/stdout parsing) ───────────

/** Serialized JSON lines exactly as they appear on the wire */
export const rawJsonLines = {
  /** Valid execute request line */
  executeRequest: JSON.stringify(requests.execute) + "\n",

  /** Valid get_state request line */
  getStateRequest: JSON.stringify(requests.getState) + "\n",

  /** Valid success response line */
  successResponse: JSON.stringify(responses.successWithOutput) + "\n",

  /** Valid error response line */
  errorResponse: JSON.stringify(responses.executionError) + "\n",

  /** Invalid JSON line (for error path testing) */
  invalidJson: "not valid json at all\n",

  /** Empty line (should be skipped by worker) */
  emptyLine: "\n",

  /** Whitespace-only line (should be skipped by worker) */
  whitespaceLine: "   \n",
};
