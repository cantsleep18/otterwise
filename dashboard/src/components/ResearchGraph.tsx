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
  completed: '#3b82f6',
  'in-progress': '#a78bfa',
  'dead-end': '#525252',
  pending: '#404040',
};

const NODE_RADIUS = 3;

export default function ResearchGraph({ graphData, selectedNode, onSelectNode }: Props) {
  const fgRef = useRef<ForceGraphMethods>();
  const containerRef = useRef<HTMLDivElement>(null);

  const forceData = useMemo(() => {
    const nodes = graphData.nodes.map((n) => ({ ...n }));
    const links = graphData.edges.map((e) => ({ source: e.source, target: e.target }));
    return { nodes, links };
  }, [graphData]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fgRef.current?.zoomToFit(400, 80);
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
      const name = (node as { name?: string }).name ?? '';
      const color = STATUS_COLORS[status];
      const isSelected = selectedNode?.id === node.id;

      if (isSelected) {
        ctx.beginPath();
        ctx.arc(x, y, NODE_RADIUS + 6, 0, 2 * Math.PI);
        ctx.fillStyle = '#3b82f610';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x, y, NODE_RADIUS + 3, 0, 2 * Math.PI);
        ctx.strokeStyle = '#3b82f650';
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(x, y, NODE_RADIUS, 0, 2 * Math.PI);
      ctx.fillStyle = isSelected ? '#93c5fd' : color;
      ctx.fill();

      const fontSize = Math.max(9 / globalScale, 2);
      ctx.font = `300 ${fontSize}px -apple-system, BlinkMacSystemFont, "Inter", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = isSelected ? '#93c5fd' : '#525252';
      ctx.fillText(name, x, y + NODE_RADIUS + 4);
    },
    [selectedNode],
  );

  const paintPointerArea = useCallback(
    (node: { id?: string | number } & Record<string, unknown>, color: string, ctx: CanvasRenderingContext2D) => {
      const x = (node as { x?: number }).x ?? 0;
      const y = (node as { y?: number }).y ?? 0;

      ctx.beginPath();
      ctx.arc(x, y, NODE_RADIUS + 8, 0, 2 * Math.PI);
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
        backgroundColor="#000000"
        nodeCanvasObject={paintNode}
        nodeCanvasObjectMode={() => 'replace'}
        nodePointerAreaPaint={paintPointerArea}
        onNodeClick={handleNodeClick}
        linkColor={() => '#ffffff10'}
        linkDirectionalArrowLength={2.5}
        linkDirectionalArrowRelPos={1}
        linkDirectionalArrowColor={() => '#ffffff15'}
        linkWidth={0.3}
        showPointerCursor={() => true}
        cooldownTicks={100}
        enableNodeDrag
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.3}
        dagMode="td"
        dagLevelDistance={70}
      />
    </div>
  );
}
