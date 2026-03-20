import { useState, useMemo } from 'react';
import type { ResearchNode } from '../types';

interface Props {
  nodes: ResearchNode[];
  selectedNode: ResearchNode | null;
  onSelectNode: (node: ResearchNode | null) => void;
}

const STATUS_COLORS: Record<ResearchNode['status'], string> = {
  completed: 'bg-green-500',
  'in-progress': 'bg-yellow-500',
  'dead-end': 'bg-red-500',
  pending: 'bg-zinc-500',
};

/** Count how many parents a node has to determine indent depth. */
function getDepth(node: ResearchNode, nodeMap: Map<string, ResearchNode>): number {
  let depth = 0;
  let current = node;
  while (current.parent) {
    depth++;
    const parent = nodeMap.get(current.parent);
    if (!parent) break;
    current = parent;
  }
  return depth;
}

export default function Sidebar({ nodes, selectedNode, onSelectNode }: Props) {
  const [search, setSearch] = useState('');

  const nodeMap = useMemo(
    () => new Map(nodes.map((n) => [n.id, n])),
    [nodes],
  );

  const sortedNodes = useMemo(() => {
    return [...nodes].sort((a, b) => {
      // Root nodes first
      const aRoot = a.parent === null ? 0 : 1;
      const bRoot = b.parent === null ? 0 : 1;
      if (aRoot !== bRoot) return aRoot - bRoot;
      // Then by ID (timestamp-based, so chronological)
      return a.id.localeCompare(b.id);
    });
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
          className="w-full px-3 py-1.5 text-sm rounded bg-zinc-800 border border-zinc-700 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
        />
      </div>

      {/* Node list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {filtered.map((node) => {
          const depth = getDepth(node, nodeMap);
          const isSelected = selectedNode?.id === node.id;

          return (
            <button
              key={node.id}
              onClick={() => onSelectNode(node)}
              className={`w-full text-left px-3 py-2 rounded text-sm transition-colors flex items-center gap-2 ${
                isSelected
                  ? 'bg-zinc-700 text-zinc-100'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
              }`}
              style={{ paddingLeft: `${12 + depth * 12}px` }}
            >
              {/* Status dot */}
              <span
                className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${STATUS_COLORS[node.status]}`}
              />

              {/* Name */}
              <span className="truncate flex-1 font-medium">{node.name}</span>

              {/* Findings count badge */}
              {node.findings_count > 0 && (
                <span className="text-xs bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded-full flex-shrink-0">
                  {node.findings_count}
                </span>
              )}
            </button>
          );
        })}

        {filtered.length === 0 && (
          <p className="text-xs text-zinc-600 text-center py-4">No nodes found</p>
        )}
      </div>
    </div>
  );
}
