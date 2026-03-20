export interface ResearchNode {
  id: string;
  name: string;
  parent: string | null;
  related: string[];
  dataset: string;
  status: 'completed' | 'in-progress' | 'dead-end' | 'pending';
  findings_count: number;
  folderPath: string;
  executiveSummary?: string;
}

export interface GraphData {
  nodes: ResearchNode[];
  edges: { source: string; target: string }[];
}

export interface ReportFrontmatter {
  id: string;
  name: string;
  parent: string | null;
  related?: string[];
  dataset: string;
  status: string;
  findings_count: number;
}

export interface NotebookCell {
  cell_type: 'code' | 'markdown' | 'raw';
  source: string;
  outputs: NotebookOutput[];
}

export interface NotebookOutput {
  output_type: 'stream' | 'execute_result' | 'display_data' | 'error';
  text?: string;
  data?: Record<string, string>;
  ename?: string;
  evalue?: string;
  traceback?: string[];
}

export interface ParsedNotebook {
  cells: NotebookCell[];
  metadata: Record<string, unknown>;
}

export interface TeammateSummary {
  title: string;
  objective: string;
  approach: string;
  findings: string[];
  confidence: 'High' | 'Medium' | 'Low';
  confidenceJustification: string;
  deadEnds: string[];
  followUps: string[];
}

export interface OtterwiseConfig {
  dataset: string;
  goals: string[];
  created: string;
}
