/**
 * Notebook fixture factories for testing notebook creation, reading, and manipulation.
 *
 * Usage:
 *   import { notebooks } from "../fixtures/notebooks.js";
 *   // notebooks.empty — minimal valid notebook
 *   // notebooks.withAnalysis — notebook with code cells and outputs
 */

import type {
  Notebook,
  CodeCell,
  MarkdownCell,
  StreamOutput,
  DisplayDataOutput,
} from "../../servers/python-repl/src/notebook/types.js";
import { TINY_PNG_BASE64 } from "./ipc-messages.js";

// ── Complete notebook fixtures ──────────────────────────────────

export const notebooks = {
  /** Minimal valid empty notebook (no cells) */
  empty: {
    nbformat: 4,
    nbformat_minor: 5,
    metadata: {
      kernelspec: {
        display_name: "Python 3",
        language: "python",
        name: "python3",
      },
      language_info: { name: "python", version: "3" },
    },
    cells: [],
  } satisfies Notebook,

  /** Notebook with otterwise metadata */
  withOtterwiseMeta: {
    nbformat: 4,
    nbformat_minor: 5,
    metadata: {
      kernelspec: {
        display_name: "Python 3",
        language: "python",
        name: "python3",
      },
      language_info: { name: "python", version: "3" },
      otterwise: {
        title: "Sales Analysis",
        dataset: "/data/sales.csv",
      },
    },
    cells: [],
  } satisfies Notebook,

  /** Notebook with a mix of markdown and code cells, including outputs */
  withAnalysis: {
    nbformat: 4,
    nbformat_minor: 5,
    metadata: {
      kernelspec: {
        display_name: "Python 3",
        language: "python",
        name: "python3",
      },
      language_info: { name: "python", version: "3" },
      otterwise: {
        title: "Test Analysis",
        dataset: "/data/test.csv",
      },
    },
    cells: [
      {
        cell_type: "markdown",
        source: ["# Test Analysis"],
        metadata: {},
      } satisfies MarkdownCell,
      {
        cell_type: "code",
        source: ["import pandas as pd", "df = pd.read_csv('/data/test.csv')", "print(df.shape)"],
        metadata: {},
        outputs: [
          {
            output_type: "stream",
            name: "stdout",
            text: ["(20, 10)"],
          } satisfies StreamOutput,
        ],
        execution_count: 1,
      } satisfies CodeCell,
      {
        cell_type: "code",
        source: ["import matplotlib.pyplot as plt", "df['revenue'].hist()", "plt.show()"],
        metadata: {},
        outputs: [
          {
            output_type: "display_data",
            data: { "image/png": TINY_PNG_BASE64 },
            metadata: {},
          } satisfies DisplayDataOutput,
        ],
        execution_count: 2,
      } satisfies CodeCell,
      {
        cell_type: "markdown",
        source: ["## Findings", "", "Revenue is right-skewed."],
        metadata: {},
      } satisfies MarkdownCell,
    ],
  } satisfies Notebook,
};

// ── Individual cell fixtures ────────────────────────────────────

export const cells = {
  /** Simple markdown heading */
  markdownHeading: {
    cell_type: "markdown" as const,
    source: ["# Title"],
    metadata: {},
  } satisfies MarkdownCell,

  /** Multiline markdown */
  markdownMultiline: {
    cell_type: "markdown" as const,
    source: ["## Section", "", "Paragraph text here.", "", "- bullet 1", "- bullet 2"],
    metadata: {},
  } satisfies MarkdownCell,

  /** Empty markdown cell */
  markdownEmpty: {
    cell_type: "markdown" as const,
    source: [""],
    metadata: {},
  } satisfies MarkdownCell,

  /** Code cell with no outputs */
  codeNoOutput: {
    cell_type: "code" as const,
    source: ["x = 42"],
    metadata: {},
    outputs: [],
    execution_count: null,
  } satisfies CodeCell,

  /** Code cell with stdout */
  codeWithStdout: {
    cell_type: "code" as const,
    source: ["print('hello')"],
    metadata: {},
    outputs: [
      { output_type: "stream", name: "stdout", text: ["hello"] } satisfies StreamOutput,
    ],
    execution_count: 1,
  } satisfies CodeCell,

  /** Code cell with stderr */
  codeWithStderr: {
    cell_type: "code" as const,
    source: ["import warnings", "warnings.warn('test')"],
    metadata: {},
    outputs: [
      { output_type: "stream", name: "stderr", text: ["UserWarning: test"] } satisfies StreamOutput,
    ],
    execution_count: 2,
  } satisfies CodeCell,

  /** Code cell with figure output */
  codeWithFigure: {
    cell_type: "code" as const,
    source: ["plt.plot([1,2,3])", "plt.show()"],
    metadata: {},
    outputs: [
      {
        output_type: "display_data",
        data: { "image/png": TINY_PNG_BASE64 },
        metadata: {},
      } satisfies DisplayDataOutput,
    ],
    execution_count: 3,
  } satisfies CodeCell,

  /** Code cell with both stdout and figure */
  codeWithMixedOutputs: {
    cell_type: "code" as const,
    source: ["print('stats computed')", "plt.hist(data)", "plt.show()"],
    metadata: {},
    outputs: [
      { output_type: "stream", name: "stdout", text: ["stats computed"] } satisfies StreamOutput,
      {
        output_type: "display_data",
        data: { "image/png": TINY_PNG_BASE64 },
        metadata: {},
      } satisfies DisplayDataOutput,
    ],
    execution_count: 4,
  } satisfies CodeCell,
};
