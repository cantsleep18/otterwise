import { vi } from "vitest";

/**
 * Mock PythonBridge matching the new socket-based API.
 * Methods: execute, getState, interrupt, reset, shutdown
 */
export function createMockBridge(overrides: {
  execute?: ReturnType<typeof vi.fn>;
  getState?: ReturnType<typeof vi.fn>;
  interrupt?: ReturnType<typeof vi.fn>;
  reset?: ReturnType<typeof vi.fn>;
  shutdown?: ReturnType<typeof vi.fn>;
} = {}) {
  return {
    execute: overrides.execute ?? vi.fn().mockResolvedValue({
      success: true,
      stdout: "",
      stderr: "",
      figures: [],
    }),
    getState: overrides.getState ?? vi.fn().mockResolvedValue({
      variables: {},
    }),
    interrupt: overrides.interrupt ?? vi.fn().mockResolvedValue({ interrupted: true }),
    reset: overrides.reset ?? vi.fn().mockResolvedValue({ reset: true }),
    shutdown: overrides.shutdown ?? vi.fn().mockResolvedValue(undefined),
  };
}

/**
 * Create a mock bridge with a specific execute response.
 */
export function mockBridgeWithExecute(response: {
  success: boolean;
  stdout: string;
  stderr: string;
  figures: string[];
}) {
  return createMockBridge({
    execute: vi.fn().mockResolvedValue(response),
  });
}

/**
 * Create a mock bridge with a specific state response.
 */
export function mockBridgeWithState(response: {
  variables: Record<string, unknown>;
}) {
  return createMockBridge({
    getState: vi.fn().mockResolvedValue(response),
  });
}
