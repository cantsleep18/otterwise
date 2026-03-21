import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type {
  Notebook,
  CodeCell,
  MarkdownCell,
  CellOutput,
  StreamOutput,
  DisplayDataOutput,
} from "./types.js";

export function createNotebook(title: string, dataset?: string): Notebook {
  return {
    nbformat: 4,
    nbformat_minor: 5,
    metadata: {
      kernelspec: {
        display_name: "Python 3",
        language: "python",
        name: "python3",
      },
      language_info: { name: "python", version: "3" },
      ...(dataset ? { otterwise: { title, dataset } } : {}),
    },
    cells: [],
  };
}

export function createMarkdownCell(source: string): MarkdownCell {
  return { cell_type: "markdown", source: source.split("\n"), metadata: {} };
}

export function createCodeCell(
  source: string,
  outputs: CellOutput[] = [],
): CodeCell {
  return {
    cell_type: "code",
    source: source.split("\n"),
    metadata: {},
    outputs,
    execution_count: null,
  };
}

export function createStreamOutput(
  name: "stdout" | "stderr",
  text: string,
): StreamOutput {
  return { output_type: "stream", name, text: text.split("\n") };
}

export function createDisplayDataOutput(
  imageBase64: string,
): DisplayDataOutput {
  return {
    output_type: "display_data",
    data: { "image/png": imageBase64 },
    metadata: {},
  };
}

export function readNotebook(path: string): Notebook {
  return JSON.parse(readFileSync(path, "utf-8"));
}

export function writeNotebook(path: string, notebook: Notebook): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(notebook, null, 2));
}

export function appendCell(
  path: string,
  cell: CodeCell | MarkdownCell,
): void {
  const nb = readNotebook(path);
  nb.cells.push(cell);
  writeNotebook(path, nb);
}
