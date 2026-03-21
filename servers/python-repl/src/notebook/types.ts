export interface Notebook {
  nbformat: 4;
  nbformat_minor: 5;
  metadata: NotebookMetadata;
  cells: Cell[];
}

export interface NotebookMetadata {
  kernelspec?: { display_name: string; language: string; name: string };
  language_info?: { name: string; version: string };
  otterwise?: { title: string; dataset: string };
  [key: string]: any;
}

export type Cell = CodeCell | MarkdownCell;

export interface CodeCell {
  cell_type: "code";
  source: string[];
  metadata: Record<string, any>;
  outputs: CellOutput[];
  execution_count: number | null;
}

export interface MarkdownCell {
  cell_type: "markdown";
  source: string[];
  metadata: Record<string, any>;
}

export type CellOutput = StreamOutput | DisplayDataOutput;

export interface StreamOutput {
  output_type: "stream";
  name: "stdout" | "stderr";
  text: string[];
}

export interface DisplayDataOutput {
  output_type: "display_data";
  data: { "image/png"?: string; [key: string]: any };
  metadata: Record<string, any>;
}
