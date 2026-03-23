import type { PythonBridge } from "../bridge/python-bridge.js";

export async function resetKernel(bridge: PythonBridge): Promise<string> {
  const result = await bridge.reset();
  return JSON.stringify(result);
}
