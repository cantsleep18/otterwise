import { describe, it, expect } from "vitest";
import { getKernelState } from "./state.js";
import { mockBridgeWithState } from "../../tests/fixtures/mock-bridge.js";

describe("getKernelState", () => {
  it("returns JSON-stringified variables from bridge", async () => {
    const bridge = mockBridgeWithState({
      variables: {
        df: { type: "DataFrame", shape: [100, 5], dtypes: { a: "int64" } },
        x: { type: "int" },
      },
    });

    const result = await getKernelState(bridge as any);
    const parsed = JSON.parse(result);

    expect(parsed.df.type).toBe("DataFrame");
    expect(parsed.df.shape).toEqual([100, 5]);
    expect(parsed.x.type).toBe("int");
  });

  it("returns empty object JSON when bridge returns no variables", async () => {
    const bridge = mockBridgeWithState({
      variables: {},
    });

    const result = await getKernelState(bridge as any);
    expect(result).toBe("{}");
  });

  it("calls bridge.getState", async () => {
    const bridge = mockBridgeWithState({
      variables: { x: { type: "int" } },
    });

    await getKernelState(bridge as any);
    expect(bridge.getState).toHaveBeenCalledOnce();
  });
});
