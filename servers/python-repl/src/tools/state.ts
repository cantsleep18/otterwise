import type { PythonBridge } from "../bridge/python-bridge.js";

export async function getKernelState(bridge: PythonBridge): Promise<string> {
  const state = await bridge.getState();
  return JSON.stringify(state.variables);
}
