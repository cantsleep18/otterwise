import type { NotebookCell, NotebookOutput, ParsedNotebook } from '../types';

/**
 * Fetch a single notebook by path from the API and parse it.
 * GET /api/files/{path} returns raw .ipynb JSON.
 */
export async function fetchNotebook(path: string): Promise<ParsedNotebook> {
  const res = await fetch(`/api/files/${encodeURIComponent(path)}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch notebook: ${res.status} ${res.statusText}`);
  }
  const json: unknown = await res.json();
  return parseNotebookJson(json);
}

/**
 * Fetch all notebooks for a research node folder and parse them.
 * GET /api/notebooks?folder={folderPath} returns list of notebook paths.
 * Returns each notebook with the teammate name extracted from the path.
 */
export async function fetchNotebooksForNode(
  folderPath: string,
): Promise<Array<{ teammate: string; notebook: ParsedNotebook }>> {
  const res = await fetch(
    `/api/notebooks?folder=${encodeURIComponent(folderPath)}`,
  );
  if (!res.ok) {
    throw new Error(
      `Failed to fetch notebooks: ${res.status} ${res.statusText}`,
    );
  }

  const paths: string[] = await res.json();
  const results: Array<{ teammate: string; notebook: ParsedNotebook }> = [];

  for (const nbPath of paths) {
    try {
      const notebook = await fetchNotebook(nbPath);
      const teammate = extractTeammateName(nbPath);
      results.push({ teammate, notebook });
    } catch {
      // Skip notebooks that fail to fetch or parse
      continue;
    }
  }

  return results;
}

/**
 * Extract the teammate name from a notebook path.
 * e.g. ".otterwise/nodes/node-1/teammate-1/analysis.ipynb" -> "teammate-1"
 */
function extractTeammateName(nbPath: string): string {
  const parts = nbPath.split('/');
  if (parts.length >= 2) {
    return parts[parts.length - 2];
  }
  return 'unknown';
}

/**
 * Normalize cell source: join array of strings or return as-is.
 */
function normalizeSource(source: unknown): string {
  if (Array.isArray(source)) return source.join('');
  if (typeof source === 'string') return source;
  return '';
}

/**
 * Parse a single output entry from a notebook cell.
 */
function parseOutput(raw: Record<string, unknown>): NotebookOutput {
  const outputType = String(raw.output_type ?? 'stream');

  switch (outputType) {
    case 'stream': {
      const text = Array.isArray(raw.text)
        ? (raw.text as string[]).join('')
        : String(raw.text ?? '');
      return { output_type: 'stream', text };
    }

    case 'execute_result':
    case 'display_data': {
      const dataObj = (raw.data ?? {}) as Record<string, unknown>;
      const data: Record<string, string> = {};
      for (const [mime, value] of Object.entries(dataObj)) {
        data[mime] = Array.isArray(value) ? value.join('') : String(value);
      }
      return {
        output_type: outputType as 'execute_result' | 'display_data',
        data,
      };
    }

    case 'error':
      return {
        output_type: 'error',
        ename: String(raw.ename ?? ''),
        evalue: String(raw.evalue ?? ''),
        traceback: Array.isArray(raw.traceback)
          ? raw.traceback.map(String)
          : [],
      };

    default:
      return { output_type: 'stream', text: '' };
  }
}

/**
 * Core parsing logic for .ipynb JSON (nbformat v4).
 * Accepts parsed JSON object (not a string).
 */
export function parseNotebookJson(json: unknown): ParsedNotebook {
  if (typeof json !== 'object' || json === null) {
    throw new Error('Invalid notebook JSON: expected an object');
  }

  const nb = json as Record<string, unknown>;
  const rawCells = nb.cells;

  if (!Array.isArray(rawCells)) {
    throw new Error('Invalid notebook JSON: missing cells array');
  }

  const cells: NotebookCell[] = rawCells.map(
    (rawCell: Record<string, unknown>) => {
      const cellType = String(rawCell.cell_type ?? 'code');
      const source = normalizeSource(rawCell.source);
      const rawOutputs = Array.isArray(rawCell.outputs)
        ? rawCell.outputs
        : [];

      const outputs: NotebookOutput[] = rawOutputs.map(
        (o: Record<string, unknown>) => parseOutput(o),
      );

      return {
        cell_type: cellType as NotebookCell['cell_type'],
        source,
        outputs,
      };
    },
  );

  const metadata =
    typeof nb.metadata === 'object' && nb.metadata !== null
      ? (nb.metadata as Record<string, unknown>)
      : {};

  return { cells, metadata };
}
