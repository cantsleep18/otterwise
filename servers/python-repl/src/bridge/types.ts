// Request types (TS → Python)
export interface ExecuteRequest {
  id: string;
  type: "execute";
  code: string;
}

export interface GetStateRequest {
  id: string;
  type: "get_state";
}

export type WorkerRequest = ExecuteRequest | GetStateRequest;

// Response types (Python → TS)
export interface ExecuteResponse {
  id: string;
  type: "result";
  success: boolean;
  stdout: string;
  stderr: string;
  figures: string[]; // base64 PNGs
}

export interface StateResponse {
  id: string;
  type: "state";
  variables: Record<string, VariableInfo>;
}

export interface ErrorResponse {
  id: string;
  type: "error";
  message: string;
}

export type WorkerResponse = ExecuteResponse | StateResponse | ErrorResponse;

export interface VariableInfo {
  type: string;
  shape?: number[];
  dtype?: string;
  dtypes?: Record<string, string>;
}
