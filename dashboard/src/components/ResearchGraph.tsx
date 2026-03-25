import { useRef, useCallback, useEffect, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import type { ForceGraphMethods } from 'react-force-graph-2d';
import type { ResearchNode, GraphData } from '../types';

interface Props {
  graphData: GraphData;
  selectedNode: ResearchNode | null;
  onSelectNode: (node: ResearchNode | null) => void;
}

const STATUS_COLORS: Record<ResearchNode['status'], string> = {
  completed: '#22c55e',
  'in-progress': '#eab308',
  'dead-end': '#ef4444',
  pending: '#6b7280',
};

function nodeRadius(findingsCount: number): number {
  return Math.min(4 + findingsCount * 0.5, 10);
}

export default function ResearchGraph({ graphData, selectedNode, onSelectNode }: Props) {
  const fgRef = useRef<ForceGraphMethods>();
  const containerRef = useRef<HTMLDivElement>(null);

  // Convert our GraphData to the format react-force-graph expects
  const forceData = useMemo(() => {
    const nodes = graphData.nodes.map((n) => ({ ...n }));
    const links = graphData.edges.map((e) => ({ source: e.source, target: e.target }));
    return { nodes, links };
  }, [graphData]);

  // Auto-fit when data changes
  useEffect(() => {
    const timer = setTimeout(() => {
      fgRef.current?.zoomToFit(400, 40);
    }, 300);
    return () => clearTimeout(timer);
  }, [forceData]);

  const handleNodeClick = useCallback(
    (node: { id?: string | number } & Record<string, unknown>) => {
      const researchNode = graphData.nodes.find((n) => n.id === node.id);
      if (researchNode) {
        onSelectNode(researchNode);
      }
    },
    [graphData.nodes, onSelectNode],
  );

  const paintNode = useCallback(
    (node: { id?: string | number } & Record<string, unknown>, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const x = (node as { x?: number }).x ?? 0;
      const y = (node as { y?: number }).y ?? 0;
      const status = (node as { status?: ResearchNode['status'] }).status ?? 'pending';
      const findings = (node as { findings_count?: number }).findings_count ?? 0;
      const name = (node as { name?: string }).name ?? '';
      const color = STATUS_COLORS[status];
      const radius = nodeRadius(findings);

      const isSelected = selectedNode?.id === node.id;

      // Glow for selected
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(x, y, radius + 4, 0, 2 * Math.PI);
        ctx.fillStyle = `${color}30`;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x, y, radius + 2, 0, 2 * Math.PI);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5 / globalScale;
        ctx.stroke();
      }

      // Node circle
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      ctx.fillStyle = isSelected ? '#ffffff' : color;
      ctx.fill();

      // Label below node
      const fontSize = Math.max(10 / globalScale, 2.5);
      ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = isSelected ? '#ffffff' : '#a1a1aa';
      ctx.fillText(name, x, y + radius + 3);
    },
    [selectedNode],
  );

  const paintPointerArea = useCallback(
    (node: { id?: string | number } & Record<string, unknown>, color: string, ctx: CanvasRenderingContext2D) => {
      const x = (node as { x?: number }).x ?? 0;
      const y = (node as { y?: number }).y ?? 0;
      const findings = (node as { findings_count?: number }).findings_count ?? 0;
      const radius = nodeRadius(findings);

      ctx.beginPath();
      ctx.arc(x, y, radius + 4, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
    },
    [],
  );

  return (
    <div ref={containerRef} className="w-full h-full">
      <ForceGraph2D
        ref={fgRef}
        graphData={forceData}
        backgroundColor="#09090b"
        nodeCanvasObject={paintNode}
        nodeCanvasObjectMode={() => 'replace'}
        nodePointerAreaPaint={paintPointerArea}
        onNodeClick={handleNodeClick}
        linkColor={() => '#ffffff20'}
        linkDirectionalArrowLength={3}
        linkDirectionalArrowRelPos={1}
        linkDirectionalArrowColor={() => '#ffffff30'}
        linkWidth={0.5}
        showPointerCursor={() => true}
        cooldownTicks={100}
        enableNodeDrag
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.3}
        dagMode="td"
        dagLevelDistance={60}
      />
    </div>
  );
}
