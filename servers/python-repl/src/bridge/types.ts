// Method-specific result types (unwrapped from JSON-RPC envelope)
// These represent the "result" field from JSON-RPC 2.0 responses.

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

// Convenience aliases for bridge return types
export type ExecuteResponse = ExecuteResult;
export type StateResponse = StateResult;
export type InterruptResponse = InterruptResult;
export type ResetResponse = ResetResult;
