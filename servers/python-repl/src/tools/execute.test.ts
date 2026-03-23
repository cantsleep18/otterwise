import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { executePython } from "./execute.js";
import { createNotebook, writeNotebook, readNotebook, flushAll } from "../notebook/format.js";

describe("executePython", () => {
  let tmpDir: string;
  let nbPath: string;

  beforeEach(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), "otterwise-exec-test-"));
    nbPath = join(tmpDir, "test.ipynb");
    const nb = createNotebook("Test");
    await writeNotebook(nbPath, nb);
  });

  afterEach(() => {
    flushAll();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function mockBridge(response: {
    success: boolean;
    stdout: string;
    stderr: string;
    figures: string[];
  }) {
    return {
      execute: vi.fn().mockResolvedValue({
        id: "test-id",
        type: "result",
        ...response,
      }),
    } as any;
  }

  it("returns JSON with execution results", async () => {
    const bridge = mockBridge({
      success: true,
      stdout: "hello",
      stderr: "",
      figures: [],
    });

    const raw = await executePython(bridge, "print('hello')", nbPath);
    const result = JSON.parse(raw);

    expect(result.success).toBe(true);
    expect(result.stdout).toBe("hello");
    expect(result.stderr).toBe("");
    expect(result.figures).toEqual([]);
  });

  it("appends code cell with outputs to notebook", async () => {
    const bridge = mockBridge({
      success: true,
      stdout: "output line",
      stderr: "warn",
      figures: ["base64img"],
    });

    await executePython(bridge, "code_here", nbPath);

    flushAll();
    const nb = await readNotebook(nbPath);
    expect(nb.cells).toHaveLength(1);

    const cell = nb.cells[0];
    expect(cell.cell_type).toBe("code");
    expect(cell.source).toEqual(["code_here"]);

    if (cell.cell_type === "code") {
      expect(cell.outputs).toHaveLength(3); // stdout + stderr + figure
      expect(cell.outputs[0]).toEqual({
        output_type: "stream",
        name: "stdout",
        text: ["output line"],
      });
      expect(cell.outputs[1]).toEqual({
        output_type: "stream",
        name: "stderr",
        text: ["warn"],
      });
      expect(cell.outputs[2]).toEqual({
        output_type: "display_data",
        data: { "image/png": "base64img" },
        metadata: {},
      });
    }
  });

  it("skips empty stdout/stderr in outputs", async () => {
    const bridge = mockBridge({
      success: true,
      stdout: "",
      stderr: "",
      figures: [],
    });

    await executePython(bridge, "x = 1", nbPath);

    flushAll();
    const nb = await readNotebook(nbPath);
    if (nb.cells[0].cell_type === "code") {
      expect(nb.cells[0].outputs).toHaveLength(0);
    }
  });

  it("still returns result even if notebook write fails", async () => {
    const bridge = mockBridge({
      success: false,
      stdout: "",
      stderr: "NameError",
      figures: [],
    });

    // Use a path that doesn't exist as a notebook (readNotebook will fail)
    const badPath = join(tmpDir, "nonexistent", "missing.ipynb");
    const raw = await executePython(bridge, "bad_code", badPath);
    const result = JSON.parse(raw);

    expect(result.success).toBe(false);
    expect(result.stderr).toBe("NameError");
  });

  it("passes code to bridge.execute", async () => {
    const bridge = mockBridge({
      success: true,
      stdout: "",
      stderr: "",
      figures: [],
    });

    await executePython(bridge, "import pandas", nbPath);
    expect(bridge.execute).toHaveBeenCalledWith("import pandas");
  });
});
