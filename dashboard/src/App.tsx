import { useEffect, useState, useCallback, useRef } from 'react';
import { fetchReports } from '@/lib/parse-reports';
import type { GraphData, ResearchNode, AutopilotStatus } from './types';
import Sidebar from './components/Sidebar';
import ResearchGraph from './components/ResearchGraph';
import { ReportPanel } from './components/ReportPanel';


const POLL_INTERVAL = 5000;

function graphDataEqual(a: GraphData, b: GraphData): boolean {
  if (a.nodes.length !== b.nodes.length || a.edges.length !== b.edges.length) return false;
  for (let i = 0; i < a.nodes.length; i++) {
    if (a.nodes[i].id !== b.nodes[i].id || a.nodes[i].status !== b.nodes[i].status) return false;
  }
  return true;
}

const STATUS_DISPLAY: Record<AutopilotStatus['status'], { label: string; color: string }> = {
  running: { label: 'Running', color: 'bg-blue-500' },
  paused: { label: 'Paused', color: 'bg-neutral-500' },
  aborted: { label: 'Aborted', color: 'bg-neutral-600' },
};

export default function App() {
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], edges: [] });
  const [selectedNode, setSelectedNode] = useState<ResearchNode | null>(null);
  const [autopilotStatus, setAutopilotStatus] = useState<AutopilotStatus | null>(null);
  const graphDataRef = useRef(graphData);

  const fetchData = useCallback(async () => {
    try {
      const data = await fetchReports();
      // Only update if data actually changed (prevents simulation restart)
      if (!graphDataEqual(graphDataRef.current, data)) {
        graphDataRef.current = data;
        setGraphData(data);
      }
    } catch {
      // API not available yet, keep current data
    }

    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const status: AutopilotStatus = await res.json();
        setAutopilotStatus(status);
      }
    } catch {
      // Status endpoint not available yet
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchData]);

  const statusInfo = autopilotStatus ? STATUS_DISPLAY[autopilotStatus.status] : null;

  return (
    <div className="flex h-screen bg-black text-neutral-100">
      {/* Sidebar */}
      <aside className="w-[220px] flex-shrink-0 border-r border-neutral-900 bg-black">
        <div className="p-4 border-b border-neutral-900">
          <div className="flex items-center justify-between">
            <h1 className="text-sm font-medium tracking-wide text-neutral-400 uppercase">Otterwise</h1>
            {statusInfo && (
              <span className="flex items-center gap-1.5 text-xs text-neutral-500">
                <span className={`inline-block w-1.5 h-1.5 rounded-full ${statusInfo.color}`} />
                {statusInfo.label}
              </span>
            )}
          </div>
          {autopilotStatus && (
            <p className="text-xs text-neutral-600 mt-1">
              {autopilotStatus.nodeCount} {autopilotStatus.nodeCount === 1 ? 'node' : 'nodes'}
            </p>
          )}
        </div>
        <Sidebar
          nodes={graphData.nodes}
          selectedNode={selectedNode}
          onSelectNode={setSelectedNode}
        />
      </aside>

      {/* Graph */}
      <div className="flex-1 min-w-0 overflow-hidden">
        <ResearchGraph
          graphData={graphData}
          selectedNode={selectedNode}
          onSelectNode={setSelectedNode}
        />
      </div>

      {/* Report panel — right side, full height */}
      {selectedNode && (
        <aside className="w-[420px] flex-shrink-0 border-l border-neutral-900 bg-black overflow-hidden">
          <ReportPanel node={selectedNode} onClose={() => setSelectedNode(null)} />
        </aside>
      )}
    </div>
  );
}
