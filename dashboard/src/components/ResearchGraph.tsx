import { useRef, useCallback, useEffect, useMemo, useState } from 'react';
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

const R = 3.5;
const HIT_R = 16;

export default function ResearchGraph({ graphData, selectedNode, onSelectNode }: Props) {
  const fgRef = useRef<ForceGraphMethods>();
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Track container size with ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) setDimensions({ width, height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const forceData = useMemo(() => {
    const nodes = graphData.nodes.map((n) => ({ ...n }));
    const links = graphData.edges.map((e) => ({ source: e.source, target: e.target }));
    return { nodes, links };
  }, [graphData]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fgRef.current?.zoomToFit(400, 80);
    }, 500);
    return () => clearTimeout(timer);
  }, [forceData]);

  const handleNodeClick = useCallback(
    (node: Record<string, unknown>) => {
      const id = node.id as string;
      const researchNode = graphData.nodes.find((n) => n.id === id);
      if (researchNode) onSelectNode(researchNode);
    },
    [graphData.nodes, onSelectNode],
  );

  const handleNodeHover = useCallback(
    (node: Record<string, unknown> | null) => {
      setHoveredId((node?.id as string) ?? null);
    },
    [],
  );

  const handleBackgroundClick = useCallback(() => {
    onSelectNode(null);
  }, [onSelectNode]);

  const paintNode = useCallback(
    (node: Record<string, unknown>, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const x = (node.x as number) ?? 0;
      const y = (node.y as number) ?? 0;
      const id = node.id as string;
      const status = (node.status as ResearchNode['status']) ?? 'pending';
      const name = (node.name as string) ?? '';
      const color = STATUS_COLORS[status];
      const isSelected = selectedNode?.id === id;
      const isHovered = hoveredId === id;

      // Hover ring
      if (isHovered && !isSelected) {
        ctx.beginPath();
        ctx.arc(x, y, R + 4, 0, 2 * Math.PI);
        ctx.strokeStyle = '#ffffff15';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Selected glow
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(x, y, R + 8, 0, 2 * Math.PI);
        ctx.fillStyle = '#3b82f608';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x, y, R + 4, 0, 2 * Math.PI);
        ctx.strokeStyle = '#3b82f640';
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      // Dot
      ctx.beginPath();
      ctx.arc(x, y, isHovered ? R + 1 : R, 0, 2 * Math.PI);
      ctx.fillStyle = isSelected ? '#93c5fd' : isHovered ? '#60a5fa' : color;
      ctx.fill();

      // Label
      const fontSize = Math.max(9 / globalScale, 2);
      ctx.font = `300 ${fontSize}px -apple-system, BlinkMacSystemFont, "Inter", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = isSelected ? '#93c5fd' : isHovered ? '#9ca3af' : '#404040';
      ctx.fillText(name, x, y + R + 5);
    },
    [selectedNode, hoveredId],
  );

  const paintPointerArea = useCallback(
    (node: Record<string, unknown>, color: string, ctx: CanvasRenderingContext2D) => {
      const x = (node.x as number) ?? 0;
      const y = (node.y as number) ?? 0;
      ctx.beginPath();
      ctx.arc(x, y, HIT_R, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
    },
    [],
  );

  return (
    <div ref={containerRef} className="w-full h-full overflow-hidden" style={{ cursor: hoveredId ? 'pointer' : 'default' }}>
      <ForceGraph2D
        ref={fgRef}
        graphData={forceData}
        width={dimensions.width}
        height={dimensions.height}
        backgroundColor="#000000"
        nodeCanvasObject={paintNode}
        nodeCanvasObjectMode={() => 'replace'}
        nodePointerAreaPaint={paintPointerArea}
        onNodeClick={handleNodeClick}
        onNodeHover={handleNodeHover}
        onBackgroundClick={handleBackgroundClick}
        linkColor={() => '#ffffff10'}
        linkDirectionalArrowLength={2.5}
        linkDirectionalArrowRelPos={1}
        linkDirectionalArrowColor={() => '#ffffff15'}
        linkWidth={0.3}
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
