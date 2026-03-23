import type { PythonBridge } from "../bridge/python-bridge.js";

export async function interruptExecution(bridge: PythonBridge): Promise<string> {
  const result = await bridge.interrupt();
  return JSON.stringify(result);
}
