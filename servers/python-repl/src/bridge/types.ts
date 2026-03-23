// Method-specific result types (unwrapped from JSON-RPC envelope)
// These represent the "result" field from JSON-RPC 2.0 responses.

export interface BridgeMeta {
  pid: number;
  socketPath: string;
  startTime: number;
  pythonVersion: string;
}

export interface MarkerInfo {
  type: string;
  subtype: string;
  content: string;
  line_number: number;
}

export interface ExecutionMetrics {
  duration_ms: number;
  memory_rss_mb: number;
  memory_vms_mb: number;
  output_truncated: boolean;
}

export interface ExecuteResult {
  success: boolean;
  stdout: string;
  stderr: string;
  figures: string[]; // base64 PNGs
  metrics?: ExecutionMetrics;
  error_detail?: {
    type: string;
    message: string;
    traceback: string;
  } | null;
  marker?: string;
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

// Tool action type (mirrors the Zod enum in tool.ts)
export type PythonReplAction =
  | "execute"
  | "start_notebook"
  | "get_state"
  | "install_package"
  | "interrupt"
  | "reset";

// Tool input type
export interface PythonReplInput {
  action: PythonReplAction;
  code?: string;
  notebook_path?: string;
  title?: string;
  dataset_path?: string;
  package_name?: string;
  timeout?: number;
}

// Convenience aliases for bridge return types
export type ExecuteResponse = ExecuteResult;
export type StateResponse = StateResult;
export type InterruptResponse = InterruptResult;
export type ResetResponse = ResetResult;
