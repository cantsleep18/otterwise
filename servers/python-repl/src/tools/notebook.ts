import type { PythonBridge } from "../bridge/python-bridge.js";
import { createNotebook, createMarkdownCell, createCodeCell, createStreamOutput, writeNotebook } from "../notebook/format.js";
import type { CellOutput } from "../notebook/types.js";

export async function startNotebook(bridge: PythonBridge, path: string, title: string, datasetPath: string): Promise<string> {
  if (!path.endsWith('.ipynb')) {
    return JSON.stringify({ success: false, error: "Notebook path must end with .ipynb" });
  }
  if (path.includes('..')) {
    return JSON.stringify({ success: false, error: "Path traversal not allowed" });
  }

  try {
    // Create notebook with title cell
    const nb = createNotebook(title, datasetPath);
    nb.cells.push(createMarkdownCell(`# ${title}`));

    // Setup code
    const setupCode = [
      "import pandas as pd",
      "import numpy as np",
      "",
      `df = pd.read_csv(${JSON.stringify(datasetPath)})`,
      "print(f'Dataset loaded: {df.shape[0]} rows x {df.shape[1]} columns')",
      "df.head()",
    ].join("\n");

    // Execute setup in Python
    const result = await bridge.execute(setupCode);

    // Build outputs for setup cell
    const outputs: CellOutput[] = [];
    if (result.stdout) outputs.push(createStreamOutput("stdout", result.stdout));
    if (result.stderr) outputs.push(createStreamOutput("stderr", result.stderr));

    nb.cells.push(createCodeCell(setupCode, outputs));

    // Write notebook
    await writeNotebook(path, nb);

    return JSON.stringify({
      success: true,
      notebook_path: path,
      stdout: result.stdout,
      stderr: result.stderr,
    });
  } catch (error) {
    return JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
}
