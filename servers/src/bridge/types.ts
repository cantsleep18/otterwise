export interface CellResult {
  success: boolean;
  stdout: string;
  stderr: string;
  figures: string[];
}

export interface VariableInfo {
  name: string;
  type: string;
  shape?: number[];
  dtype?: string;
  dtypes?: Record<string, string>;
}

export interface StateResult {
  variables: VariableInfo[];
  memory?: { rss: number; vms: number };
}

export interface BridgeMeta {
  pid: number;
  socketPath: string;
  processStartTime: number;
  pythonVersion: string;
  pythonPath: string;
  startedAt: string;
}
