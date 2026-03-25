import { useEffect, useState, useCallback } from 'react';
import { fetchReports } from '@/lib/parse-reports';
import type { GraphData, ResearchNode, AutopilotStatus } from './types';
import Sidebar from './components/Sidebar';
import ResearchGraph from './components/ResearchGraph';
import { ReportPanel } from './components/ReportPanel';


const POLL_INTERVAL = 5000;

const STATUS_DISPLAY: Record<AutopilotStatus['status'], { label: string; color: string }> = {
  running: { label: 'Running', color: 'bg-blue-500' },
  paused: { label: 'Paused', color: 'bg-neutral-500' },
  aborted: { label: 'Aborted', color: 'bg-neutral-600' },
};

export default function App() {
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], edges: [] });
  const [selectedNode, setSelectedNode] = useState<ResearchNode | null>(null);
  const [autopilotStatus, setAutopilotStatus] = useState<AutopilotStatus | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const data = await fetchReports();
      setGraphData(data);
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

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Graph area */}
        <div className="flex-1 min-h-0">
          <ResearchGraph
            graphData={graphData}
            selectedNode={selectedNode}
            onSelectNode={setSelectedNode}
          />
        </div>

        {/* Detail panel */}
        <div className="h-[300px] flex-shrink-0 border-t border-neutral-900 bg-black">
          <ReportPanel node={selectedNode} />
        </div>
      </main>
    </div>
  );
}
