import { z } from "zod";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { PythonBridge } from "./bridge/bridge-manager.js";
import {
  readNotebook,
  writeNotebook,
  createNotebook,
  createMarkdownCell,
  createCodeCell,
  createStreamOutput,
  createDisplayDataOutput,
} from "./notebook/format.js";
import type { CellOutput } from "./notebook/types.js";

const execFileAsync = promisify(execFile);

const WHITELISTED_PACKAGES = new Set([
  "pandas", "numpy", "scipy", "statsmodels",
  "scikit-learn", "matplotlib", "seaborn",
]);

// ---------------------------------------------------------------------------
// Zod schema for the unified python_repl tool
// ---------------------------------------------------------------------------

export const pythonReplSchema = {
  action: z
    .enum([
      "execute",
      "start_notebook",
      "get_state",
      "install_package",
      "interrupt",
      "reset",
    ])
    .describe("The action to perform"),
  session_id: z
    .string()
    .optional()
    .describe("Session identifier (reserved for future use)"),
  code: z
    .string()
    .optional()
    .describe("Python code to execute (required for 'execute' action)"),
  notebook_path: z
    .string()
    .optional()
    .describe(
      "Path to .ipynb file — required for 'execute' (append results) and 'start_notebook' (create file)",
    ),
  title: z
    .string()
    .optional()
    .describe("Notebook title (required for 'start_notebook')"),
  dataset_path: z
    .string()
    .optional()
    .describe("Path to CSV dataset (required for 'start_notebook')"),
  timeout: z
    .number()
    .positive()
    .optional()
    .describe("Execution timeout in milliseconds"),
  project_dir: z
    .string()
    .optional()
    .describe("Project working directory"),
  package_name: z
    .string()
    .optional()
    .describe("Package name to install (required for 'install_package')"),
};

// ---------------------------------------------------------------------------
// Tool description
// ---------------------------------------------------------------------------

export const pythonReplDescription =
  "Unified Python REPL tool. Actions: execute (run code), start_notebook (create .ipynb), " +
  "get_state (list variables), install_package (pip install whitelisted package), " +
  "interrupt (cancel running execution), reset (clear kernel namespace).";

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function handlePythonRepl(
  bridge: PythonBridge,
  params: {
    action: string;
    session_id?: string;
    code?: string;
    notebook_path?: string;
    title?: string;
    dataset_path?: string;
    timeout?: number;
    project_dir?: string;
    package_name?: string;
  },
): Promise<string> {
  switch (params.action) {
    case "execute":
      return handleExecute(bridge, params);
    case "start_notebook":
      return handleStartNotebook(bridge, params);
    case "get_state":
      return handleGetState(bridge);
    case "install_package":
      return handleInstallPackage(params);
    case "interrupt":
      return handleInterrupt(bridge);
    case "reset":
      return handleReset(bridge);
    default:
      return JSON.stringify({
        success: false,
        error: `Unknown action: ${params.action}`,
      });
  }
}

// ---------------------------------------------------------------------------
// Action handlers
// ---------------------------------------------------------------------------

async function handleExecute(
  bridge: PythonBridge,
  params: { code?: string; notebook_path?: string },
): Promise<string> {
  if (!params.code) {
    return JSON.stringify({ success: false, error: "Missing required parameter: code" });
  }
  if (!params.notebook_path) {
    return JSON.stringify({ success: false, error: "Missing required parameter: notebook_path" });
  }

  const result = await bridge.execute(params.code);

  // Build cell outputs for notebook
  const outputs: CellOutput[] = [];
  if (result.stdout) outputs.push(createStreamOutput("stdout", result.stdout));
  if (result.stderr) outputs.push(createStreamOutput("stderr", result.stderr));
  for (const fig of result.figures) {
    outputs.push(createDisplayDataOutput(fig));
  }

  // Append to notebook
  try {
    const cell = createCodeCell(params.code, outputs);
    const nb = await readNotebook(params.notebook_path);
    nb.cells.push(cell);
    await writeNotebook(params.notebook_path, nb);
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

async function handleStartNotebook(
  bridge: PythonBridge,
  params: { notebook_path?: string; title?: string; dataset_path?: string },
): Promise<string> {
  if (!params.notebook_path) {
    return JSON.stringify({ success: false, error: "Missing required parameter: notebook_path" });
  }
  if (!params.title) {
    return JSON.stringify({ success: false, error: "Missing required parameter: title" });
  }
  if (!params.dataset_path) {
    return JSON.stringify({ success: false, error: "Missing required parameter: dataset_path" });
  }

  const path = params.notebook_path;
  if (!path.endsWith(".ipynb")) {
    return JSON.stringify({ success: false, error: "Notebook path must end with .ipynb" });
  }
  if (path.includes("..")) {
    return JSON.stringify({ success: false, error: "Path traversal not allowed" });
  }

  // Create notebook with title cell
  const nb = createNotebook(params.title, params.dataset_path);
  nb.cells.push(createMarkdownCell(`# ${params.title}`));

  // Setup code
  const setupCode = [
    "import pandas as pd",
    "import numpy as np",
    "",
    `df = pd.read_csv(${JSON.stringify(params.dataset_path)})`,
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
}

async function handleGetState(bridge: PythonBridge): Promise<string> {
  const state = await bridge.getState();
  return JSON.stringify(state.variables);
}

async function handleInstallPackage(params: { package_name?: string }): Promise<string> {
  if (!params.package_name) {
    return JSON.stringify({ success: false, error: "Missing required parameter: package_name" });
  }

  const normalized = params.package_name.trim().toLowerCase().replace(/_/g, "-");

  if (!WHITELISTED_PACKAGES.has(normalized)) {
    return JSON.stringify({
      success: false,
      error: `Package '${params.package_name}' is not whitelisted. Allowed: ${[...WHITELISTED_PACKAGES].sort().join(", ")}`,
    });
  }

  try {
    const { stdout, stderr } = await execFileAsync(
      "python3",
      ["-m", "pip", "install", normalized],
      { timeout: 120_000 },
    );
    return JSON.stringify({ success: true, stdout, stderr });
  } catch (error: unknown) {
    const err = error as { killed?: boolean; message?: string };
    if (err.killed) {
      return JSON.stringify({ success: false, error: "pip install timed out after 120 seconds" });
    }
    return JSON.stringify({ success: false, error: err.message ?? String(error) });
  }
}

async function handleInterrupt(bridge: PythonBridge): Promise<string> {
  const result = await bridge.interrupt();
  return JSON.stringify(result);
}

async function handleReset(bridge: PythonBridge): Promise<string> {
  const result = await bridge.reset();
  return JSON.stringify(result);
}
