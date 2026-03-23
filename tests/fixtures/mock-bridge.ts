/**
 * Mock PythonBridge for testing tools without spawning a real Python process.
 *
 * Usage:
 *   import { createMockBridge, createFailingBridge } from "../fixtures/mock-bridge.js";
 *
 *   const bridge = createMockBridge();
 *   const result = await executePython(bridge, "print('hi')", "/tmp/nb.ipynb");
 */

import { vi } from "vitest";
import type { ExecuteResponse, StateResponse } from "../../servers/python-repl/src/bridge/types.js";
import { responses } from "./ipc-messages.js";

export interface MockBridge {
  execute: ReturnType<typeof vi.fn>;
  getState: ReturnType<typeof vi.fn>;
  shutdown: ReturnType<typeof vi.fn>;
}

/**
 * Create a mock bridge that returns successful responses by default.
 * Override individual methods after creation for specific test scenarios.
 */
export function createMockBridge(overrides?: {
  executeResponse?: ExecuteResponse;
  stateResponse?: StateResponse;
}): MockBridge {
  return {
    execute: vi.fn().mockResolvedValue(
      overrides?.executeResponse ?? responses.successWithOutput,
    ),
    getState: vi.fn().mockResolvedValue(
      overrides?.stateResponse ?? responses.stateWithVariables,
    ),
    shutdown: vi.fn(),
  };
}

/**
 * Create a mock bridge where execute() always returns an error response.
 */
export function createFailingBridge(errorMessage = "ZeroDivisionError: division by zero"): MockBridge {
  return {
    execute: vi.fn().mockResolvedValue({
      id: "err-001",
      type: "result" as const,
      success: false,
      stdout: "",
      stderr: errorMessage,
      figures: [],
    } satisfies ExecuteResponse),
    getState: vi.fn().mockResolvedValue(responses.stateEmpty),
    shutdown: vi.fn(),
  };
}

/**
 * Create a mock bridge where execute() rejects with an Error (simulates crash).
 */
export function createCrashingBridge(error = new Error("Python process exited unexpectedly")): MockBridge {
  return {
    execute: vi.fn().mockRejectedValue(error),
    getState: vi.fn().mockRejectedValue(error),
    shutdown: vi.fn(),
  };
}

/**
 * Create a mock bridge that returns a figure in the execute response.
 */
export function createFigureBridge(): MockBridge {
  return createMockBridge({
    executeResponse: responses.successWithFigure,
  });
}

/**
 * Create a mock bridge that times out (never resolves).
 */
export function createHangingBridge(): MockBridge {
  return {
    execute: vi.fn().mockReturnValue(new Promise(() => {})),
    getState: vi.fn().mockReturnValue(new Promise(() => {})),
    shutdown: vi.fn(),
  };
}
