import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  createNotebook,
  createMarkdownCell,
  createCodeCell,
  createStreamOutput,
  createDisplayDataOutput,
  readNotebook,
  writeNotebook,
  appendCell,
  flushAll,
} from "./format.js";

// ── createNotebook ──────────────────────────────────────────────

describe("createNotebook", () => {
  it("returns a valid nbformat 4.5 notebook", () => {
    const nb = createNotebook("Test");
    expect(nb.nbformat).toBe(4);
    expect(nb.nbformat_minor).toBe(5);
    expect(nb.cells).toEqual([]);
  });

  it("includes kernelspec and language_info metadata", () => {
    const nb = createNotebook("Test");
    expect(nb.metadata.kernelspec).toEqual({
      display_name: "Python 3",
      language: "python",
      name: "python3",
    });
    expect(nb.metadata.language_info).toEqual({
      name: "python",
      version: "3",
    });
  });

  it("stores otterwise metadata when dataset is provided", () => {
    const nb = createNotebook("Sales Analysis", "/data/sales.csv");
    expect(nb.metadata.otterwise).toEqual({
      title: "Sales Analysis",
      dataset: "/data/sales.csv",
    });
  });

  it("omits otterwise metadata when dataset is not provided", () => {
    const nb = createNotebook("Scratch");
    expect(nb.metadata.otterwise).toBeUndefined();
  });
});

// ── createMarkdownCell ──────────────────────────────────────────

describe("createMarkdownCell", () => {
  it("splits source into lines", () => {
    const cell = createMarkdownCell("# Title\nParagraph");
    expect(cell.cell_type).toBe("markdown");
    expect(cell.source).toEqual(["# Title", "Paragraph"]);
    expect(cell.metadata).toEqual({});
  });

  it("handles single-line source", () => {
    const cell = createMarkdownCell("hello");
    expect(cell.source).toEqual(["hello"]);
  });

  it("handles empty source", () => {
    const cell = createMarkdownCell("");
    expect(cell.source).toEqual([""]);
  });
});

// ── createCodeCell ──────────────────────────────────────────────

describe("createCodeCell", () => {
  it("creates a code cell with defaults", () => {
    const cell = createCodeCell("print('hi')");
    expect(cell.cell_type).toBe("code");
    expect(cell.source).toEqual(["print('hi')"]);
    expect(cell.outputs).toEqual([]);
    expect(cell.execution_count).toBeNull();
    expect(cell.metadata).toEqual({});
  });

  it("accepts outputs", () => {
    const out = createStreamOutput("stdout", "hi");
    const cell = createCodeCell("x = 1", [out]);
    expect(cell.outputs).toHaveLength(1);
    expect(cell.outputs[0]).toBe(out);
  });

  it("splits multiline code into lines", () => {
    const cell = createCodeCell("a = 1\nb = 2\nc = a + b");
    expect(cell.source).toEqual(["a = 1", "b = 2", "c = a + b"]);
  });
});

// ── createStreamOutput ──────────────────────────────────────────

describe("createStreamOutput", () => {
  it("creates stdout stream output", () => {
    const out = createStreamOutput("stdout", "hello world");
    expect(out.output_type).toBe("stream");
    expect(out.name).toBe("stdout");
    expect(out.text).toEqual(["hello world"]);
  });

  it("creates stderr stream output", () => {
    const out = createStreamOutput("stderr", "warning!");
    expect(out.name).toBe("stderr");
  });

  it("splits multiline text", () => {
    const out = createStreamOutput("stdout", "line1\nline2\nline3");
    expect(out.text).toEqual(["line1", "line2", "line3"]);
  });
});

// ── createDisplayDataOutput ─────────────────────────────────────

describe("createDisplayDataOutput", () => {
  it("wraps base64 image in display_data output", () => {
    const b64 = "iVBORw0KGgoAAAANSUhEUg==";
    const out = createDisplayDataOutput(b64);
    expect(out.output_type).toBe("display_data");
    expect(out.data["image/png"]).toBe(b64);
    expect(out.metadata).toEqual({});
  });
});

// ── readNotebook / writeNotebook / appendCell (fs round-trip) ───

describe("notebook file I/O", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "otterwise-test-"));
    flushAll();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("writeNotebook + readNotebook round-trips correctly", async () => {
    const nb = createNotebook("Round Trip");
    nb.cells.push(createMarkdownCell("# Hello"));
    const filePath = join(tmpDir, "test.ipynb");

    await writeNotebook(filePath, nb);
    flushAll();
    const loaded = await readNotebook(filePath);

    expect(loaded.nbformat).toBe(4);
    expect(loaded.cells).toHaveLength(1);
    expect(loaded.cells[0].cell_type).toBe("markdown");
  });

  it("writeNotebook creates intermediate directories", async () => {
    const nb = createNotebook("Nested");
    const filePath = join(tmpDir, "a", "b", "c", "deep.ipynb");

    await writeNotebook(filePath, nb);
    flushAll();
    const loaded = await readNotebook(filePath);

    expect(loaded.nbformat).toBe(4);
  });

  it("writeNotebook produces valid JSON", async () => {
    const nb = createNotebook("JSON Check");
    const filePath = join(tmpDir, "json.ipynb");

    await writeNotebook(filePath, nb);
    const raw = readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);

    expect(parsed).toEqual(nb);
  });

  it("appendCell adds a cell to an existing notebook file", async () => {
    const nb = createNotebook("Append Test");
    const filePath = join(tmpDir, "append.ipynb");

    await writeNotebook(filePath, nb);
    await appendCell(filePath, createCodeCell("x = 1"));
    await appendCell(filePath, createMarkdownCell("## Section"));

    flushAll();
    const loaded = await readNotebook(filePath);
    expect(loaded.cells).toHaveLength(2);
    expect(loaded.cells[0].cell_type).toBe("code");
    expect(loaded.cells[1].cell_type).toBe("markdown");
  });
});
