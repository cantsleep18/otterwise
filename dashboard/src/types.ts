export interface ResearchNode {
  id: string;
  name: string;
  parentIds: string[];
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
  parentIds: string[];
  dataset: string;
  status: string;
  findings_count: number;
}

export interface AutopilotStatus {
  status: 'running' | 'paused' | 'aborted';
  nodeCount: number;
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
