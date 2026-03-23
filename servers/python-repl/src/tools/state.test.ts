import { describe, it, expect, vi } from "vitest";
import { getKernelState } from "./state.js";

describe("getKernelState", () => {
  it("returns JSON-stringified variables from bridge", async () => {
    const mockBridge = {
      getState: vi.fn().mockResolvedValue({
        id: "test",
        type: "state" as const,
        variables: {
          df: { type: "DataFrame", shape: [100, 5], dtypes: { a: "int64" } },
          x: { type: "int" },
        },
      }),
    } as any;

    const result = await getKernelState(mockBridge);
    const parsed = JSON.parse(result);

    expect(parsed.df.type).toBe("DataFrame");
    expect(parsed.df.shape).toEqual([100, 5]);
    expect(parsed.x.type).toBe("int");
  });

  it("returns empty object JSON when bridge returns no variables", async () => {
    const mockBridge = {
      getState: vi.fn().mockResolvedValue({
        id: "test",
        type: "state" as const,
        variables: {},
      }),
    } as any;

    const result = await getKernelState(mockBridge);
    expect(result).toBe("{}");
  });
});
