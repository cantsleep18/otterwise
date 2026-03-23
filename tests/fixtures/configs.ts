/**
 * Config and report fixtures for testing .otterwise/ directory structures.
 *
 * Usage:
 *   import { configs, reports, reportFrontmatter } from "../fixtures/configs.js";
 */

// ── .otterwise/config.json fixtures ─────────────────────────────

export interface OtterwiseConfig {
  dataset: string;
  goals: string[];
  created: string;
}

export const configs = {
  /** Standard config with multiple goals */
  standard: {
    dataset: "/mnt/c/Allround/otterwise/tests/fixtures/sample-dataset.csv",
    goals: [
      "Analyze revenue trends by category and region",
      "Identify key factors driving customer satisfaction",
      "Detect anomalies or missing data patterns",
    ],
    created: "2025-01-25T10:30:00.000Z",
  } satisfies OtterwiseConfig,

  /** Config with single goal */
  singleGoal: {
    dataset: "/data/simple.csv",
    goals: ["General profiling and EDA"],
    created: "2025-01-20T08:00:00.000Z",
  } satisfies OtterwiseConfig,

  /** Config with empty goals (should trigger default profiling) */
  emptyGoals: {
    dataset: "/data/test.csv",
    goals: [],
    created: "2025-01-18T12:00:00.000Z",
  } satisfies OtterwiseConfig,

  /** Config with absolute Windows-style path */
  windowsPath: {
    dataset: "C:\\Users\\user\\data\\dataset.csv",
    goals: ["Analyze data"],
    created: "2025-01-25T10:30:00.000Z",
  } satisfies OtterwiseConfig,

  /** Config with relative path */
  relativePath: {
    dataset: "./data/local-dataset.csv",
    goals: ["Quick analysis"],
    created: "2025-01-25T10:30:00.000Z",
  } satisfies OtterwiseConfig,
};

// ── report.md YAML frontmatter fixtures ─────────────────────────

export interface ReportFrontmatter {
  id: string;
  name: string;
  parent: string | null;
  related: string[];
  dataset: string;
  status: "completed" | "in-progress" | "dead-end";
  findings_count: number;
}

export const reportFrontmatter = {
  /** Root node — first research session */
  root: {
    id: "20250125_103000_a1b2",
    name: "initial-profiling",
    parent: null,
    related: [],
    dataset: "sample-dataset.csv",
    status: "completed" as const,
    findings_count: 5,
  } satisfies ReportFrontmatter,

  /** Child node — deeper analysis */
  child: {
    id: "20250126_140000_c3d4",
    name: "revenue-deep-dive",
    parent: "20250125_103000_a1b2",
    related: ["20250125_103000_a1b2"],
    dataset: "sample-dataset.csv",
    status: "completed" as const,
    findings_count: 3,
  } satisfies ReportFrontmatter,

  /** Dead-end node */
  deadEnd: {
    id: "20250126_160000_e5f6",
    name: "time-series-attempt",
    parent: "20250125_103000_a1b2",
    related: ["20250125_103000_a1b2", "20250126_140000_c3d4"],
    dataset: "sample-dataset.csv",
    status: "dead-end" as const,
    findings_count: 0,
  } satisfies ReportFrontmatter,

  /** In-progress node */
  inProgress: {
    id: "20250127_090000_g7h8",
    name: "customer-segmentation",
    parent: "20250126_140000_c3d4",
    related: [],
    dataset: "sample-dataset.csv",
    status: "in-progress" as const,
    findings_count: 2,
  } satisfies ReportFrontmatter,
};

// ── Full report.md content builders ─────────────────────────────

/** Build a complete report.md string from frontmatter and body */
export function buildReportMd(fm: ReportFrontmatter, body: string): string {
  const relatedYaml =
    fm.related.length > 0
      ? fm.related.map((r) => `  - "${r}"`).join("\n")
      : "[]";

  return `---
id: "${fm.id}"
name: "${fm.name}"
parent: ${fm.parent ? `"${fm.parent}"` : "null"}
related:
${fm.related.length > 0 ? relatedYaml : "  []"}
dataset: "${fm.dataset}"
status: "${fm.status}"
findings_count: ${fm.findings_count}
---

${body}`;
}

export const reports = {
  /** Complete root report with body */
  root: buildReportMd(
    reportFrontmatter.root,
    `# Initial Data Profiling

## Executive Summary

The sample dataset contains 20 records across four product categories and four regions.

## Key Findings

1. Electronics dominates revenue (68% of total).
2. North region leads in total revenue.
3. 40% of transactions include discounts.
4. Customer ages range from 22-67.
5. Positive correlation between price and satisfaction (r=0.72).

## Dead Ends & Branch Points

- Time-series window too short for trend detection.

## Open Questions

- Discount-satisfaction relationship controlling for category?
- Systematic missing data in Food/North?`,
  ),

  /** Complete child report */
  child: buildReportMd(
    reportFrontmatter.child,
    `# Revenue Deep Dive

## Executive Summary

Detailed analysis of revenue patterns across categories and regions.

## Key Findings

1. Electronics mean transaction: $1,349.86.
2. North region Electronics drives overall revenue.
3. Discount impact on revenue is category-dependent.

## Dead Ends & Branch Points

- Per-region analysis limited by small sample size.

## Open Questions

- Would larger dataset confirm regional patterns?`,
  ),

  /** Dead-end report */
  deadEnd: buildReportMd(
    reportFrontmatter.deadEnd,
    `# Time Series Attempt

## Executive Summary

Attempted time-series analysis on the 10-day dataset window. Insufficient data for meaningful temporal patterns.

## Key Findings

None — insufficient data.

## Dead Ends & Branch Points

- 10-day window too narrow for any seasonal or trend analysis.
- Suggest collecting at least 90 days of data before revisiting.

## Open Questions

- Revisit when more data is available.`,
  ),
};
