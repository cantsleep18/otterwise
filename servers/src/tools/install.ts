import { BridgeManager } from "../bridge/manager.js";
import { SessionLock } from "../bridge/lock.js";
import { sendRequest, SocketConnectionError, SocketTimeoutError, JsonRpcError } from "../bridge/client.js";

export async function handleInstallPackage(
  args: { package: string },
  bridge: BridgeManager,
  lock: SessionLock,
): Promise<string> {
  return lock.withLock(async () => {
    try {
      const meta = await bridge.ensureRunning();
      const result = await sendRequest(meta.socketPath, "install_package", {
        package: args.package,
      });
      return JSON.stringify(result);
    } catch (error) {
      if (error instanceof SocketConnectionError) {
        throw new Error("Python bridge not available. Run /otterwise:ow-doctor");
      }
      if (error instanceof SocketTimeoutError) {
        throw new Error(`Request timed out after ${error.timeoutMs / 1000}s`);
      }
      if (error instanceof JsonRpcError) {
        throw new Error(error.message);
      }
      throw error;
    }
  });
}
