import { BridgeManager } from "../bridge/manager.js";
import { sendRequest, SocketConnectionError, SocketTimeoutError, JsonRpcError } from "../bridge/client.js";
import type { CellResult } from "../bridge/types.js";

export interface ExecutePythonParams {
  code: string;
  notebook_path: string;
}

export async function handleExecutePython(
  params: ExecutePythonParams,
  bridge: BridgeManager,
): Promise<CellResult> {
  try {
    const meta = await bridge.ensureRunning();
    return await sendRequest<CellResult>(meta.socketPath, "execute", {
      code: params.code,
      notebook_path: params.notebook_path,
    });
  } catch (error) {
    if (error instanceof SocketConnectionError) {
      throw new Error("Python bridge not available. Run /otterwise:ow-doctor");
    }
    if (error instanceof SocketTimeoutError) {
      throw new Error(`Execution timed out after ${error.timeoutMs / 1000}s`);
    }
    if (error instanceof JsonRpcError) {
      throw new Error(error.message);
    }
    throw error;
  }
}
