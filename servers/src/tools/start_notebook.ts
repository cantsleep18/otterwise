import { BridgeManager } from "../bridge/manager.js";
import { sendRequest, SocketConnectionError, SocketTimeoutError, JsonRpcError } from "../bridge/client.js";

export interface StartNotebookParams {
  path: string;
  title: string;
  dataset_path: string;
}

export async function handleStartNotebook(
  params: StartNotebookParams,
  bridge: BridgeManager,
): Promise<unknown> {
  try {
    const meta = await bridge.ensureRunning();
    return await sendRequest(meta.socketPath, "start_notebook", {
      path: params.path,
      title: params.title,
      dataset_path: params.dataset_path,
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
