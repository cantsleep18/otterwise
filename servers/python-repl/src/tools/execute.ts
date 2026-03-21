import type { PythonBridge } from "../bridge/python-bridge.js";
import {
  readNotebook,
  writeNotebook,
  createCodeCell,
  createStreamOutput,
  createDisplayDataOutput,
} from "../notebook/format.js";
import type { CellOutput } from "../notebook/types.js";

export async function executePython(
  bridge: PythonBridge,
  code: string,
  notebookPath: string,
): Promise<string> {
  const result = await bridge.execute(code);

  // Build cell outputs
  const outputs: CellOutput[] = [];
  if (result.stdout) outputs.push(createStreamOutput("stdout", result.stdout));
  if (result.stderr) outputs.push(createStreamOutput("stderr", result.stderr));
  for (const fig of result.figures) {
    outputs.push(createDisplayDataOutput(fig));
  }

  // Append to notebook
  try {
    const cell = createCodeCell(code, outputs);
    const nb = readNotebook(notebookPath);
    nb.cells.push(cell);
    writeNotebook(notebookPath, nb);
  } catch {
    // Don't fail the tool if notebook write fails
  }

  return JSON.stringify({
    success: result.success,
    stdout: result.stdout,
    stderr: result.stderr,
    figures: result.figures,
  });
}
