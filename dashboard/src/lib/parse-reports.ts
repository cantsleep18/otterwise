import matter from 'gray-matter';
import type { ResearchNode, GraphData, ReportFrontmatter } from '../types';

/**
 * Fetch all reports from the Vite dev server API and build graph data.
 * GET /api/reports returns JSON array of {path, content}.
 */
export async function fetchReports(): Promise<GraphData> {
  const res = await fetch('/api/reports');
  if (!res.ok) {
    throw new Error(`Failed to fetch reports: ${res.status} ${res.statusText}`);
  }
  const reports: Array<{ path: string; content: string }> = await res.json();
  return buildGraphData(reports);
}

/**
 * Parse a report's raw markdown content into typed frontmatter and body.
 */
export function parseReportContent(content: string): {
  frontmatter: ReportFrontmatter;
  body: string;
} {
  const { data, content: body } = matter(content);

  const frontmatter: ReportFrontmatter = {
    id: String(data.id ?? ''),
    name: String(data.name ?? ''),
    parent: data.parent != null ? String(data.parent) : null,
    related: Array.isArray(data.related)
      ? data.related.map(String)
      : undefined,
    dataset: String(data.dataset ?? ''),
    status: String(data.status ?? 'pending'),
    findings_count: Number(data.findings_count) || 0,
  };

  return { frontmatter, body };
}

/**
 * Extract the executive summary from the markdown body.
 * Looks for the first paragraph after a "## Executive Summary" heading.
 */
function extractExecutiveSummary(body: string): string | undefined {
  const match = /^##\s+Executive\s+Summary\s*$/im.exec(body);
  if (!match) return undefined;

  const afterHeading = body.slice(match.index + match[0].length).trimStart();
  const nextHeading = afterHeading.search(/^##\s/m);
  const paragraph =
    nextHeading >= 0
      ? afterHeading.slice(0, nextHeading).trim()
      : afterHeading.trim();

  return paragraph || undefined;
}

/**
 * Build the full graph data (nodes + edges) from an array of raw reports.
 */
export function buildGraphData(
  reports: Array<{ path: string; content: string }>,
): GraphData {
  const nodes: ResearchNode[] = [];
  const edges: GraphData['edges'] = [];

  for (const report of reports) {
    try {
      const { frontmatter, body } = parseReportContent(report.content);

      if (!frontmatter.id) continue;

      const folderPath = report.path.replace(/\/report\.md$/, '');

      const node: ResearchNode = {
        id: frontmatter.id,
        name: frontmatter.name,
        parent: frontmatter.parent,
        related: frontmatter.related ?? [],
        dataset: frontmatter.dataset,
        status: frontmatter.status as ResearchNode['status'],
        findings_count: frontmatter.findings_count,
        folderPath,
        executiveSummary: extractExecutiveSummary(body),
      };

      nodes.push(node);

      // Edge from parent -> this node
      if (frontmatter.parent) {
        edges.push({ source: frontmatter.parent, target: frontmatter.id });
      }

      // Edges from related nodes
      if (frontmatter.related) {
        for (const relatedId of frontmatter.related) {
          edges.push({ source: frontmatter.id, target: relatedId });
        }
      }
    } catch {
      // Skip malformed reports
      continue;
    }
  }

  return { nodes, edges };
}
