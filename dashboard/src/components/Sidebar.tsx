import { useState, useMemo } from 'react';
import type { ResearchNode } from '../types';

interface Props {
  nodes: ResearchNode[];
  selectedNode: ResearchNode | null;
  onSelectNode: (node: ResearchNode | null) => void;
}

const STATUS_COLORS: Record<ResearchNode['status'], string> = {
  completed: 'bg-blue-500',
  'in-progress': 'bg-violet-400',
  'dead-end': 'bg-neutral-600',
  pending: 'bg-neutral-700',
};

const STATUS_LABELS: Record<ResearchNode['status'], string> = {
  completed: 'Done',
  'in-progress': 'Running',
  'dead-end': 'Dead end',
  pending: 'Pending',
};

export default function Sidebar({ nodes, selectedNode, onSelectNode }: Props) {
  const [search, setSearch] = useState('');

  // Sort by creation time (ID is timestamp-based, so lexicographic = chronological)
  const sortedNodes = useMemo(() => {
    return [...nodes].sort((a, b) => a.id.localeCompare(b.id));
  }, [nodes]);

  const filtered = useMemo(() => {
    if (!search.trim()) return sortedNodes;
    const q = search.toLowerCase();
    return sortedNodes.filter((n) => n.name.toLowerCase().includes(q));
  }, [sortedNodes, search]);

  return (
    <div className="h-full flex flex-col">
      {/* Search */}
      <div className="p-3">
        <input
          type="text"
          placeholder="Search nodes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-3 py-1.5 text-xs rounded-md bg-neutral-950 border border-neutral-800 text-neutral-300 placeholder-neutral-600 focus:outline-none focus:border-neutral-700"
        />
      </div>

      {/* Node list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {filtered.map((node) => {
          const isSelected = selectedNode?.id === node.id;

          return (
            <button
              key={node.id}
              onClick={() => onSelectNode(node)}
              className={`w-full text-left px-3 py-1.5 rounded-md text-xs transition-colors flex items-center gap-2 ${
                isSelected
                  ? 'bg-neutral-900 text-neutral-100'
                  : 'text-neutral-500 hover:bg-neutral-950 hover:text-neutral-300'
              }`}
            >
              {/* Status dot */}
              <span
                className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_COLORS[node.status]}`}
                title={STATUS_LABELS[node.status]}
              />

              {/* Name */}
              <span className="truncate flex-1 font-medium">{node.name}</span>

              {/* Status badge */}
              <span className="text-xs text-neutral-600 flex-shrink-0">
                {STATUS_LABELS[node.status]}
              </span>

              {/* Findings count badge */}
              {node.findings_count > 0 && (
                <span className="text-xs bg-neutral-900 text-neutral-500 px-1.5 py-0.5 rounded-full flex-shrink-0">
                  {node.findings_count}
                </span>
              )}
            </button>
          );
        })}

        {filtered.length === 0 && (
          <p className="text-xs text-neutral-700 text-center py-4">No nodes found</p>
        )}
      </div>
    </div>
  );
}
