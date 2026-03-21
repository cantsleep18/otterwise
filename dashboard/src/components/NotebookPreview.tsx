import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ResearchNode, ParsedNotebook, NotebookCell, NotebookOutput } from '../types';
import { fetchNotebooksForNode } from '../lib/parse-notebook';

interface Props {
  node: ResearchNode | null;
}

const DEFAULT_VISIBLE_CELLS = 5;

function CellOutput({ output }: { output: NotebookOutput }) {
  if (output.output_type === 'error') {
    return (
      <div className="mt-1 rounded bg-red-950/50 border border-red-900/50 p-3 overflow-x-auto">
        <div className="text-red-400 text-xs font-mono font-semibold">
          {output.ename}: {output.evalue}
        </div>
        {output.traceback && output.traceback.length > 0 && (
          <pre className="text-red-300/80 text-xs font-mono mt-2 whitespace-pre-wrap">
            {output.traceback.join('\n')}
          </pre>
        )}
      </div>
    );
  }

  if (output.output_type === 'stream' && output.text) {
    return (
      <pre className="mt-1 rounded bg-zinc-900 p-3 text-xs font-mono text-zinc-300 overflow-x-auto whitespace-pre-wrap">
        {output.text}
      </pre>
    );
  }

  if (
    (output.output_type === 'execute_result' || output.output_type === 'display_data') &&
    output.data
  ) {
    // Prefer image, then HTML, then plain text
    if (output.data['image/png']) {
      return (
        <div className="mt-1">
          <img
            src={`data:image/png;base64,${output.data['image/png']}`}
            alt="Cell output"
            className="max-w-full rounded"
          />
        </div>
      );
    }

    if (output.data['text/html']) {
      return (
        <div
          className="mt-1 rounded bg-zinc-900 p-3 text-xs text-zinc-300 overflow-x-auto notebook-html-output"
          dangerouslySetInnerHTML={{ __html: output.data['text/html'] }}
        />
      );
    }

    if (output.data['text/plain']) {
      return (
        <pre className="mt-1 rounded bg-zinc-900 p-3 text-xs font-mono text-zinc-300 overflow-x-auto whitespace-pre-wrap">
          {output.data['text/plain']}
        </pre>
      );
    }
  }

  return null;
}

function Cell({ cell }: { cell: NotebookCell }) {
  if (cell.cell_type === 'code') {
    return (
      <div className="mb-3">
        <pre className="rounded bg-zinc-900 border border-zinc-800 p-3 text-xs font-mono text-green-400 overflow-x-auto whitespace-pre-wrap">
          {cell.source}
        </pre>
        {cell.outputs.map((output, i) => (
          <CellOutput key={i} output={output} />
        ))}
      </div>
    );
  }

  if (cell.cell_type === 'markdown') {
    return (
      <div className="mb-3 prose prose-invert prose-sm max-w-none text-zinc-300">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{cell.source}</ReactMarkdown>
      </div>
    );
  }

  // raw cells
  return (
    <pre className="mb-3 rounded bg-zinc-900 p-3 text-xs font-mono text-zinc-400 overflow-x-auto whitespace-pre-wrap">
      {cell.source}
    </pre>
  );
}

function TeammateNotebook({
  teammate,
  notebook,
}: {
  teammate: string;
  notebook: ParsedNotebook;
}) {
  const [expanded, setExpanded] = useState(false);
  const cells = notebook.cells;
  const visibleCells = expanded ? cells : cells.slice(0, DEFAULT_VISIBLE_CELLS);
  const hasMore = cells.length > DEFAULT_VISIBLE_CELLS;

  return (
    <div className="mb-6">
      <h4 className="text-sm font-semibold text-zinc-200 mb-3 capitalize">{teammate}</h4>
      {visibleCells.map((cell, i) => (
        <Cell key={i} cell={cell} />
      ))}
      {hasMore && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="text-xs text-teal-400 hover:text-teal-300 transition-colors"
        >
          Show {cells.length - DEFAULT_VISIBLE_CELLS} more cells
        </button>
      )}
      {hasMore && expanded && (
        <button
          onClick={() => setExpanded(false)}
          className="text-xs text-teal-400 hover:text-teal-300 transition-colors"
        >
          Show less
        </button>
      )}
    </div>
  );
}

export function NotebookPreview({ node }: Props) {
  const [notebooks, setNotebooks] = useState<
    Array<{ teammate: string; notebook: ParsedNotebook }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!node) {
      setNotebooks([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchNotebooksForNode(node.folderPath)
      .then((result) => {
        if (!cancelled) {
          setNotebooks(result);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load notebooks');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [node?.folderPath]);

  if (!node) return null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-zinc-500 text-sm">
        Loading notebooks...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-8 text-red-400 text-sm">
        {error}
      </div>
    );
  }

  if (notebooks.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-zinc-500 text-sm">
        No notebooks found for this node
      </div>
    );
  }

  return (
    <div className="p-4">
      {notebooks.map(({ teammate, notebook }, i) => (
        <TeammateNotebook key={i} teammate={teammate} notebook={notebook} />
      ))}
    </div>
  );
}
