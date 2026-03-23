import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type {
  Notebook,
  CodeCell,
  MarkdownCell,
  CellOutput,
  StreamOutput,
  DisplayDataOutput,
} from "./types.js";

const cache = new Map<string, Notebook>();

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

export async function readNotebook(path: string): Promise<Notebook> {
  const cached = cache.get(path);
  if (cached) return cached;
  const nb: Notebook = JSON.parse(await readFile(path, "utf-8"));
  cache.set(path, nb);
  return nb;
}

export async function writeNotebook(path: string, notebook: Notebook): Promise<void> {
  cache.set(path, notebook);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(notebook, null, 2));
}

export async function appendCell(
  path: string,
  cell: CodeCell | MarkdownCell,
): Promise<void> {
  const nb = await readNotebook(path);
  nb.cells.push(cell);
  await writeNotebook(path, nb);
}

export function flushAll(): void {
  cache.clear();
}
