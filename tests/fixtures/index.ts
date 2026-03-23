/**
 * Central fixture index — re-exports all test fixtures for convenient imports.
 *
 * Usage:
 *   import { requests, responses, rawJsonLines } from "../fixtures/index.js";
 *   import { createMockBridge, createFailingBridge } from "../fixtures/index.js";
 *   import { notebooks, cells } from "../fixtures/index.js";
 *   import { configs, reports, reportFrontmatter } from "../fixtures/index.js";
 */

// IPC message fixtures
export {
  requests,
  responses,
  rawJsonLines,
  TINY_PNG_BASE64,
} from "./ipc-messages.js";

// Mock PythonBridge
export {
  createMockBridge,
  createFailingBridge,
  createCrashingBridge,
  createFigureBridge,
  createHangingBridge,
} from "./mock-bridge.js";
export type { MockBridge } from "./mock-bridge.js";

// Notebook fixtures
export { notebooks, cells } from "./notebooks.js";

// Config and report fixtures
export {
  configs,
  reports,
  reportFrontmatter,
  buildReportMd,
} from "./configs.js";
export type { OtterwiseConfig, ReportFrontmatter } from "./configs.js";

// ── File paths for static fixtures ──────────────────────────────

import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Absolute paths to static fixture files on disk */
export const fixturePaths = {
  sampleDataset: join(__dirname, "sample-dataset.csv"),
  sampleConfig: join(__dirname, "config.json"),
  sampleReport: join(__dirname, "report.md"),
  sampleNotebook: join(__dirname, "notebook.ipynb"),
};
