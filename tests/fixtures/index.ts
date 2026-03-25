/**
 * Central fixture index — re-exports all test fixtures for convenient imports.
 *
 * Usage:
 *   import { configs, reports, reportFrontmatter } from "../fixtures/index.js";
 *   import { scenarios, autopilotConfigs, autopilotStates } from "../fixtures/index.js";
 */

// Config and report fixtures
export {
  configs,
  reports,
  reportFrontmatter,
  buildReportMd,
} from "./configs.js";
export type { OtterwiseConfig, ReportFrontmatter } from "./configs.js";

// Autopilot fixtures
export {
  scenarios,
  autopilotConfigs,
  autopilotStates,
} from "./autopilot-scenarios.js";
export type {
  AutopilotConfig,
  AutopilotNode,
  AutopilotState,
  AutopilotScenario,
  CooldownEntry,
} from "./autopilot-scenarios.js";

// ── File paths for static fixtures ──────────────────────────────

import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Absolute paths to static fixture files on disk */
export const fixturePaths = {
  sampleDataset: join(__dirname, "sample-dataset.csv"),
  sampleConfig: join(__dirname, "config.json"),
  sampleReport: join(__dirname, "report.md"),
  autopilotConfig: join(__dirname, "autopilot-config.json"),
  autopilotStateRunning: join(__dirname, "autopilot-state-running.json"),
  autopilotStatePaused: join(__dirname, "autopilot-state-paused.json"),
  summaryWithSources: join(__dirname, "summary-with-sources.md"),
  summaryNoSources: join(__dirname, "summary-no-sources.md"),
};
