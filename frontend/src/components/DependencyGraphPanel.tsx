import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type WheelEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Maximize2, Minimize2, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
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

const NODE_W = 150;
const NODE_H = 46;
const LAYER_GAP_Y = 96;
const NODE_GAP_X = 48;

function computePositions(layers: string[][]): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const layerWidths = layers.map((l) => l.length * (NODE_W + NODE_GAP_X) - NODE_GAP_X);
  const totalWidth = Math.max(...layerWidths, NODE_W);
  layers.forEach((layer, layerIndex) => {
    const layerWidth = layer.length * (NODE_W + NODE_GAP_X) - NODE_GAP_X;
    const startX = (totalWidth - layerWidth) / 2;
    layer.forEach((nodeId, i) => {
      positions.set(nodeId, { x: startX + i * (NODE_W + NODE_GAP_X), y: layerIndex * (NODE_H + LAYER_GAP_Y) });
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
  const [hoverTarget, setHoverTarget] = useState<
    | { kind: "node"; id: string; screenX: number; screenY: number }
    | { kind: "edge"; edge: DependencyEdge; screenX: number; screenY: number }
    | null
  >(null);
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
  const totalWidth = Math.max(...layers.map((l) => l.length * (NODE_W + NODE_GAP_X) - NODE_GAP_X), NODE_W, 1);
  const totalHeight = layers.length > 0 ? layers.length * (NODE_H + LAYER_GAP_Y) - LAYER_GAP_Y + NODE_H : NODE_H;

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

  return (
    <section className="panel topology-panel">
      <div className="topology-header">
        <div>
          <h2 className="section-title">Dependency Graph</h2>
          <p className="section-subtitle">
            Cumulative service topology inferred from all observed calls since startup - not a static
            diagram, and not limited to the dashboard's live window.
          </p>
        </div>
        <span className="topology-alltime-badge">All-time · not affected by chart window</span>
      </div>

      <SectionState
        loading={loading}
        error={error}
        empty={!graph || graph.edges.length === 0}
        emptyMessage="No dependencies observed yet."
        skeletonRows={4}
      >
        {graph && (
          <div className={`topology-canvas${isFullscreen ? " is-fullscreen" : ""}`} ref={containerRef}>
            <div className="topology-toolbar">
              <button type="button" title="Zoom in" onClick={() => setZoom((z) => clamp(z + 0.2, MIN_ZOOM, MAX_ZOOM))}>
                <ZoomIn size={15} />
              </button>
              <button type="button" title="Zoom out" onClick={() => setZoom((z) => clamp(z - 0.2, MIN_ZOOM, MAX_ZOOM))}>
                <ZoomOut size={15} />
              </button>
              <button type="button" title="Reset view" onClick={resetView}>
                <RotateCcw size={15} />
              </button>
              <button type="button" title={isFullscreen ? "Exit fullscreen" : "Fullscreen"} onClick={toggleFullscreen}>
                {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              </button>
            </div>

            <svg
              ref={svgRef}
              className="topology-svg"
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
                const x1 = from.x + NODE_W / 2;
                const y1 = from.y + NODE_H;
                const x2 = to.x + NODE_W / 2;
                const y2 = to.y;
                const midY = (y1 + y2) / 2;
                const hasFailures = edge.failedCalls > 0;
                return (
                  <g
                    key={`${edge.sourceService}->${edge.targetService}`}
                    onMouseEnter={(e) => setHoverTarget({ kind: "edge", edge, screenX: e.clientX, screenY: e.clientY })}
                    onMouseMove={(e) => setHoverTarget({ kind: "edge", edge, screenX: e.clientX, screenY: e.clientY })}
                    onMouseLeave={() => setHoverTarget(null)}
                  >
                    <path
                      d={`M${x1},${y1} C${x1},${midY} ${x2},${midY} ${x2},${y2}`}
                      className={`topology-edge${hasFailures ? " has-failures" : ""}`}
                      markerEnd={`url(#${hasFailures ? "topology-arrow-failed" : "topology-arrow"})`}
                    />
                  </g>
                );
              })}

              {[...positions.entries()].map(([nodeId, pos]) => {
                const stats = computeNodeStats(nodeId, graph.edges);
                const degraded = stats.failedIn > 0;
                return (
                  <g
                    key={nodeId}
                    transform={`translate(${pos.x},${pos.y})`}
                    className="topology-node-group"
                    onMouseEnter={(e) => setHoverTarget({ kind: "node", id: nodeId, screenX: e.clientX, screenY: e.clientY })}
                    onMouseMove={(e) => setHoverTarget({ kind: "node", id: nodeId, screenX: e.clientX, screenY: e.clientY })}
                    onMouseLeave={() => setHoverTarget(null)}
                    onClick={() => openInspector(nodeId)}
                  >
                    <rect
                      width={NODE_W}
                      height={NODE_H}
                      rx={8}
                      className={`topology-node-rect${degraded ? " degraded" : ""}`}
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

        {hoverTarget && hoverTarget.kind === "edge" && (
          <Tooltip x={hoverTarget.screenX} y={hoverTarget.screenY}>
            <div className="chart-tooltip-time">
              {hoverTarget.edge.sourceService} &rarr; {hoverTarget.edge.targetService}
            </div>
            <div>{hoverTarget.edge.totalCalls} total calls</div>
            <div>{hoverTarget.edge.successfulCalls} successful</div>
            <div>{hoverTarget.edge.failedCalls} failed</div>
            <div>{Math.round(hoverTarget.edge.confidence * 100)}% confidence</div>
            {hoverTarget.edge.lastObservedAt && (
              <div className="chart-tooltip-muted">Last observed {new Date(hoverTarget.edge.lastObservedAt).toLocaleTimeString()}</div>
            )}
          </Tooltip>
        )}
        {hoverTarget && hoverTarget.kind === "node" && graph && (
          <Tooltip x={hoverTarget.screenX} y={hoverTarget.screenY}>
            {(() => {
              const stats = computeNodeStats(hoverTarget.id, graph.edges);
              return (
                <>
                  <div className="chart-tooltip-time">{hoverTarget.id}</div>
                  <div>{stats.incomingCount} incoming / {stats.outgoingCount} outgoing dependencies</div>
                  <div>{stats.totalIn} calls in, {stats.totalOut} calls out</div>
                  {stats.failedIn > 0 && <div className="chart-tooltip-critical">{stats.failedIn} failed inbound calls</div>}
                  <div className="chart-tooltip-muted">Click to inspect</div>
                </>
              );
            })()}
          </Tooltip>
        )}
      </SectionState>
    </section>
  );
}
