import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type WheelEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, Maximize2, Minimize2, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import type { DependencyEdge, DependencyGraphResponse } from "../types";
import SectionState from "./SectionState";
import Tooltip from "./charts/Tooltip";

interface Props {
  graph: DependencyGraphResponse | null;
  loading: boolean;
  error: string | null;
}

/** Longest-path-from-a-root layering, computed purely from the real edges. */
function computeLayers(graph: DependencyGraphResponse): string[][] {
  const ids = graph.nodes.map((n) => n.id);
  const incoming = new Map<string, string[]>(ids.map((id) => [id, []]));
  for (const edge of graph.edges) {
    incoming.get(edge.targetService)?.push(edge.sourceService);
  }

  const depth = new Map<string, number>();
  function depthOf(id: string, visiting: Set<string>): number {
    if (depth.has(id)) return depth.get(id)!;
    if (visiting.has(id)) return 0; // defensive cycle guard
    visiting.add(id);
    const preds = incoming.get(id) ?? [];
    const d = preds.length === 0 ? 0 : Math.max(...preds.map((p) => depthOf(p, visiting))) + 1;
    depth.set(id, d);
    visiting.delete(id);
    return d;
  }
  ids.forEach((id) => depthOf(id, new Set()));

  const maxDepth = ids.length === 0 ? -1 : Math.max(...ids.map((id) => depth.get(id) ?? 0));
  const layers: string[][] = Array.from({ length: maxDepth + 1 }, () => []);
  ids.forEach((id) => layers[depth.get(id) ?? 0].push(id));
  return layers;
}

// Left-to-right layout (layers = columns): fills a wide canvas far better
// than a top-to-bottom chain does, and matches how real infra service maps
// (Datadog, Docker Desktop) are conventionally read - left is upstream.
const NODE_W = 150;
const NODE_H = 44;
const LAYER_GAP_X = 150;
const NODE_GAP_Y = 32;

function computePositions(layers: string[][]): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const layerHeights = layers.map((l) => l.length * (NODE_H + NODE_GAP_Y) - NODE_GAP_Y);
  const totalHeight = Math.max(...layerHeights, NODE_H);
  layers.forEach((layer, layerIndex) => {
    const layerHeight = layer.length * (NODE_H + NODE_GAP_Y) - NODE_GAP_Y;
    const startY = (totalHeight - layerHeight) / 2;
    layer.forEach((nodeId, i) => {
      positions.set(nodeId, { x: layerIndex * (NODE_W + LAYER_GAP_X), y: startY + i * (NODE_H + NODE_GAP_Y) });
    });
  });
  return positions;
}

interface NodeStats {
  incomingCount: number;
  outgoingCount: number;
  totalIn: number;
  totalOut: number;
  failedIn: number;
}

function computeNodeStats(nodeId: string, edges: DependencyEdge[]): NodeStats {
  const incoming = edges.filter((e) => e.targetService === nodeId);
  const outgoing = edges.filter((e) => e.sourceService === nodeId);
  return {
    incomingCount: incoming.length,
    outgoingCount: outgoing.length,
    totalIn: incoming.reduce((sum, e) => sum + e.totalCalls, 0),
    totalOut: outgoing.reduce((sum, e) => sum + e.totalCalls, 0),
    failedIn: incoming.reduce((sum, e) => sum + e.failedCalls, 0),
  };
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;

export default function DependencyGraphPanel({ graph, loading, error }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoverEdge, setHoverEdge] = useState<{ edge: DependencyEdge; screenX: number; screenY: number } | null>(null);
  const isDragging = useRef(false);
  const dragOrigin = useRef({ x: 0, y: 0 });
  const panOrigin = useRef({ x: 0, y: 0 });

  useEffect(() => {
    function handleFsChange() {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    }
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  const layers = graph ? computeLayers(graph) : [];
  const positions = computePositions(layers);
  const totalWidth = layers.length > 0 ? layers.length * (NODE_W + LAYER_GAP_X) - LAYER_GAP_X + NODE_W : NODE_W;
  const totalHeight = Math.max(...layers.map((l) => l.length * (NODE_H + NODE_GAP_Y) - NODE_GAP_Y), NODE_H, 1);

  // Canvas height follows actual content (clamped) instead of wasting a
  // fixed tall box on a simple/narrow graph - avoids the "excessive empty
  // space" a fixed-height letterboxed viewBox would otherwise produce.
  const canvasHeight = Math.min(560, Math.max(220, totalHeight + 90));

  const baseViewBox = { x: -30, y: -30, w: totalWidth + 60, h: totalHeight + 60 };
  const viewBox = {
    x: baseViewBox.x + pan.x,
    y: baseViewBox.y + pan.y,
    w: baseViewBox.w / zoom,
    h: baseViewBox.h / zoom,
  };

  function clamp(v: number, lo: number, hi: number) {
    return Math.max(lo, Math.min(hi, v));
  }

  function handleWheel(e: WheelEvent<SVGSVGElement>) {
    e.preventDefault();
    const direction = e.deltaY > 0 ? -1 : 1;
    setZoom((z) => clamp(Number((z + direction * 0.15).toFixed(2)), MIN_ZOOM, MAX_ZOOM));
  }

  function handleMouseDown(e: ReactMouseEvent<SVGSVGElement>) {
    isDragging.current = true;
    dragOrigin.current = { x: e.clientX, y: e.clientY };
    panOrigin.current = { ...pan };
  }

  function handleMouseMove(e: ReactMouseEvent<SVGSVGElement>) {
    if (!isDragging.current || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = viewBox.w / rect.width;
    const scaleY = viewBox.h / rect.height;
    const dx = (e.clientX - dragOrigin.current.x) * scaleX;
    const dy = (e.clientY - dragOrigin.current.y) * scaleY;
    setPan({ x: panOrigin.current.x - dx, y: panOrigin.current.y - dy });
  }

  function stopDragging() {
    isDragging.current = false;
  }

  function resetView() {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current?.requestFullscreen();
    }
  }

  function openInspector(serviceName: string) {
    navigate(`/services/${encodeURIComponent(serviceName)}`, { state: { backgroundLocation: location } });
  }

  const selectedStats = graph && selectedNodeId ? computeNodeStats(selectedNodeId, graph.edges) : null;

  return (
    <section className="panel topology-panel">
      <div className="topology-header">
        <h2 className="section-title">Topology</h2>
        <span className="topology-alltime-badge">All-time</span>
      </div>

      <SectionState
        loading={loading}
        error={error}
        empty={!graph || graph.edges.length === 0}
        emptyMessage="No dependencies observed yet."
        skeletonRows={4}
      >
        {graph && (
          <div
            className={`topology-canvas${isFullscreen ? " is-fullscreen" : ""}`}
            ref={containerRef}
            style={isFullscreen ? undefined : { height: canvasHeight, minHeight: canvasHeight }}
          >
            <div className="topology-toolbar">
              <button type="button" title="Zoom in" onClick={() => setZoom((z) => clamp(z + 0.2, MIN_ZOOM, MAX_ZOOM))}>
                <ZoomIn size={14} />
              </button>
              <button type="button" title="Zoom out" onClick={() => setZoom((z) => clamp(z - 0.2, MIN_ZOOM, MAX_ZOOM))}>
                <ZoomOut size={14} />
              </button>
              <button type="button" title="Reset view" onClick={resetView}>
                <RotateCcw size={14} />
              </button>
              <button type="button" title={isFullscreen ? "Exit fullscreen" : "Fullscreen"} onClick={toggleFullscreen}>
                {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>
            </div>

            <svg
              ref={svgRef}
              className="topology-svg"
              style={isFullscreen ? undefined : { height: canvasHeight }}
              viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={stopDragging}
              onMouseLeave={stopDragging}
            >
              <defs>
                <marker id="topology-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M0,0 L10,5 L0,10 z" className="topology-arrowhead" />
                </marker>
                <marker id="topology-arrow-failed" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M0,0 L10,5 L0,10 z" className="topology-arrowhead failed" />
                </marker>
              </defs>

              {graph.edges.map((edge) => {
                const from = positions.get(edge.sourceService);
                const to = positions.get(edge.targetService);
                if (!from || !to) return null;
                const x1 = from.x + NODE_W;
                const y1 = from.y + NODE_H / 2;
                const x2 = to.x;
                const y2 = to.y + NODE_H / 2;
                const midX = (x1 + x2) / 2;
                const midY = (y1 + y2) / 2;
                const hasFailures = edge.failedCalls > 0;
                const labelText = hasFailures
                  ? `${edge.totalCalls} · ${edge.failedCalls} failed`
                  : `${edge.totalCalls} · ${Math.round(edge.confidence * 100)}%`;
                return (
                  <g
                    key={`${edge.sourceService}->${edge.targetService}`}
                    onMouseEnter={(e) => setHoverEdge({ edge, screenX: e.clientX, screenY: e.clientY })}
                    onMouseMove={(e) => setHoverEdge({ edge, screenX: e.clientX, screenY: e.clientY })}
                    onMouseLeave={() => setHoverEdge(null)}
                  >
                    <path
                      d={`M${x1},${y1} C${midX},${y1} ${midX},${y2} ${x2},${y2}`}
                      className={`topology-edge${hasFailures ? " has-failures" : ""}`}
                      markerEnd={`url(#${hasFailures ? "topology-arrow-failed" : "topology-arrow"})`}
                    />
                    <rect
                      x={midX - labelText.length * 2.6}
                      y={midY - 15}
                      width={labelText.length * 5.2}
                      height={12}
                      className="topology-edge-label-bg"
                    />
                    <text
                      x={midX}
                      y={midY - 6}
                      textAnchor="middle"
                      className={`topology-edge-label${hasFailures ? " has-failures" : ""}`}
                    >
                      {labelText}
                    </text>
                  </g>
                );
              })}

              {[...positions.entries()].map(([nodeId, pos]) => {
                const stats = computeNodeStats(nodeId, graph.edges);
                const degraded = stats.failedIn > 0;
                const selected = nodeId === selectedNodeId;
                return (
                  <g
                    key={nodeId}
                    transform={`translate(${pos.x},${pos.y})`}
                    className="topology-node-group"
                    onClick={() => setSelectedNodeId((prev) => (prev === nodeId ? null : nodeId))}
                  >
                    <rect
                      width={NODE_W}
                      height={NODE_H}
                      rx={2}
                      className={`topology-node-rect${degraded ? " degraded" : ""}${selected ? " selected" : ""}`}
                    />
                    <text x={NODE_W / 2} y={NODE_H / 2 + 5} textAnchor="middle" className="topology-node-label">
                      {nodeId}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        )}

        {selectedStats && selectedNodeId && (
          <div className="topology-selected-panel">
            <span className="topology-selected-name">{selectedNodeId}</span>
            <div className="topology-selected-stat">
              <span className="topology-selected-stat-label">In / Out</span>
              <span>
                {selectedStats.incomingCount} / {selectedStats.outgoingCount} deps
              </span>
            </div>
            <div className="topology-selected-stat">
              <span className="topology-selected-stat-label">Calls</span>
              <span>
                {selectedStats.totalIn} in, {selectedStats.totalOut} out
              </span>
            </div>
            {selectedStats.failedIn > 0 && (
              <div className="topology-selected-stat">
                <span className="topology-selected-stat-label">Failed</span>
                <span style={{ color: "var(--critical)" }}>{selectedStats.failedIn} inbound</span>
              </div>
            )}
            <button
              type="button"
              className="panel-header-link"
              style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.3rem" }}
              onClick={() => openInspector(selectedNodeId)}
            >
              Inspect <ArrowRight size={12} />
            </button>
          </div>
        )}

        {hoverEdge && (
          <Tooltip x={hoverEdge.screenX} y={hoverEdge.screenY}>
            <div className="chart-tooltip-time">
              {hoverEdge.edge.sourceService} &rarr; {hoverEdge.edge.targetService}
            </div>
            <div>{hoverEdge.edge.totalCalls} total &middot; {hoverEdge.edge.successfulCalls} ok &middot; {hoverEdge.edge.failedCalls} failed</div>
            <div>{Math.round(hoverEdge.edge.confidence * 100)}% confidence</div>
            {hoverEdge.edge.lastObservedAt && (
              <div className="chart-tooltip-muted">{new Date(hoverEdge.edge.lastObservedAt).toLocaleTimeString()}</div>
            )}
          </Tooltip>
        )}
      </SectionState>
    </section>
  );
}
