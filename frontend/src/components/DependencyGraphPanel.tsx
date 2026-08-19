import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type WheelEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, Maximize2, Minimize2, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import type { DependencyEdge, DependencyGraphResponse } from "../types";
import type { RuntimeMetrics } from "./MetricsPanel";
import SectionState from "./SectionState";
import Tooltip from "./charts/Tooltip";

interface Props {
  graph: DependencyGraphResponse | null;
  loading: boolean;
  error: string | null;
  /** Optional: when provided, node cards show real live telemetry inline, not just on hover. */
  metrics?: RuntimeMetrics | null;
  /** Floor for the canvas height, e.g. a taller value on a dedicated full-page view. */
  minCanvasHeight?: number;
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
// Nodes are deliberately large, information-dense cards - the topology is
// this product's hero visual, not a decorative diagram.
const NODE_W = 224;
const NODE_H = 104;
const LAYER_GAP_X = 130;
const NODE_GAP_Y = 48;

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

function fmtPercent(v: number | undefined): string {
  return v === undefined ? "—" : `${(v * 100).toFixed(1)}%`;
}
function fmtMb(v: number | undefined): string {
  return v === undefined ? "—" : `${(v / 1024 / 1024).toFixed(1)} MB`;
}
function fmtRate(v: number | undefined): string {
  return v === undefined ? "—" : `${v.toFixed(2)} req/s`;
}
function fmtMs(v: number | undefined): string {
  return v === undefined ? "—" : `${(v * 1000).toFixed(0)} ms`;
}
/** Error % derived from two real Prometheus values (errorRate / requestRate) - not fabricated. */
function fmtErrPct(errorRate: number | undefined, requestRate: number | undefined): string {
  if (errorRate === undefined || requestRate === undefined) return "—";
  if (requestRate <= 0) return "0.0%";
  return `${((errorRate / requestRate) * 100).toFixed(1)}%`;
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;

export default function DependencyGraphPanel({ graph, loading, error, metrics, minCanvasHeight }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoverEdge, setHoverEdge] = useState<{ edge: DependencyEdge; screenX: number; screenY: number } | null>(null);
  const [hoverNode, setHoverNode] = useState<{ id: string; screenX: number; screenY: number } | null>(null);
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
  // fixed tall box on a simple/narrow graph. Width always fills 100% of the
  // container by construction (the svg is width:100% and the viewBox width
  // equals the real content width) - so there is never unused horizontal
  // margin regardless of container size. Vertical padding is kept tight so
  // the node row itself dominates the canvas rather than floating in empty
  // black space above and below it.
  const canvasHeight = Math.min(460, Math.max(minCanvasHeight ?? 140, totalHeight + 34));

  const baseViewBox = { x: -30, y: -17, w: totalWidth + 60, h: totalHeight + 34 };
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
                <marker id="topology-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse">
                  <path d="M0,0 L10,5 L0,10 z" className="topology-arrowhead" />
                </marker>
                <marker id="topology-arrow-failed" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse">
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
                const failurePct = edge.totalCalls > 0 ? Math.round((edge.failedCalls / edge.totalCalls) * 100) : 0;
                const pathId = `edge-${edge.sourceService}-${edge.targetService}`;
                // Line weight reflects observed traffic volume, within a sane visual range.
                const strokeWidth = clamp(1.25 + Math.log2(1 + edge.totalCalls) * 0.35, 1.25, 3.5);
                const labelLine1 = `${edge.totalCalls} calls`;
                const labelLine2 = hasFailures ? `${edge.failedCalls} failed · ${failurePct}%` : `${Math.round(edge.confidence * 100)}% ok`;
                const pathD = `M${x1},${y1} C${midX},${y1} ${midX},${y2} ${x2},${y2}`;
                return (
                  <g
                    key={pathId}
                    onMouseEnter={(e) => setHoverEdge({ edge, screenX: e.clientX, screenY: e.clientY })}
                    onMouseMove={(e) => setHoverEdge({ edge, screenX: e.clientX, screenY: e.clientY })}
                    onMouseLeave={() => setHoverEdge(null)}
                  >
                    <path
                      id={pathId}
                      d={pathD}
                      className={`topology-edge${hasFailures ? " has-failures" : ""}`}
                      style={{ strokeWidth }}
                      markerEnd={`url(#${hasFailures ? "topology-arrow-failed" : "topology-arrow"})`}
                    />
                    {/* Traffic direction indicator - a dot travels the real edge path on a
                        loop, communicating live flow direction, not decorative motion. */}
                    <circle r={2.5} className={`topology-traffic-dot${hasFailures ? " has-failures" : ""}`}>
                      <animateMotion dur="2.4s" repeatCount="indefinite" rotate="auto">
                        <mpath href={`#${pathId}`} />
                      </animateMotion>
                    </circle>
                    <rect
                      x={midX - 46}
                      y={midY - 30}
                      width={92}
                      height={24}
                      className="topology-edge-label-bg"
                    />
                    <text x={midX} y={midY - 18} textAnchor="middle" className="topology-edge-label mono">
                      {labelLine1}
                    </text>
                    <text
                      x={midX}
                      y={midY - 8}
                      textAnchor="middle"
                      className={`topology-edge-label mono${hasFailures ? " has-failures" : ""}`}
                    >
                      {labelLine2}
                    </text>
                  </g>
                );
              })}

              {[...positions.entries()].map(([nodeId, pos]) => {
                const stats = computeNodeStats(nodeId, graph.edges);
                const degraded = stats.failedIn > 0;
                const selected = nodeId === selectedNodeId;
                const cpu = metrics?.cpu[nodeId];
                const requestRate = metrics?.requestRate[nodeId];
                const errorRate = metrics?.errorRate[nodeId];
                const p95 = metrics?.latencyP95[nodeId];
                const hasErrorSignal = errorRate !== undefined && errorRate > 0;
                const statusLabel = degraded || hasErrorSignal ? "ERROR" : "UP";
                const toneClass = degraded ? "critical" : "ok";
                return (
                  <g
                    key={nodeId}
                    transform={`translate(${pos.x},${pos.y})`}
                    className="topology-node-group"
                    onClick={() => setSelectedNodeId((prev) => (prev === nodeId ? null : nodeId))}
                    onMouseEnter={(e) => setHoverNode({ id: nodeId, screenX: e.clientX, screenY: e.clientY })}
                    onMouseMove={(e) => setHoverNode({ id: nodeId, screenX: e.clientX, screenY: e.clientY })}
                    onMouseLeave={() => setHoverNode(null)}
                  >
                    <rect
                      width={NODE_W}
                      height={NODE_H}
                      rx={2}
                      className={`topology-node-rect${degraded ? " degraded" : ""}${selected ? " selected" : ""}`}
                    />
                    <circle cx={16} cy={20} r={4} className={`topology-node-dot ${toneClass}`} />
                    <text x={28} y={24} className="topology-node-name mono">
                      {nodeId.toUpperCase()}
                    </text>
                    <text x={NODE_W - 14} y={24} textAnchor="end" className={`topology-node-status mono ${toneClass}`}>
                      {statusLabel}
                    </text>
                    <line x1={14} y1={36} x2={NODE_W - 14} y2={36} className="topology-node-divider" />
                    <text x={14} y={58} className="topology-node-metric mono">
                      {fmtRate(requestRate)}
                    </text>
                    <text x={NODE_W - 14} y={58} textAnchor="end" className="topology-node-metric mono">
                      P95 {fmtMs(p95)}
                    </text>
                    <text x={14} y={78} className={`topology-node-metric mono${hasErrorSignal ? " critical" : ""}`}>
                      ERR {fmtErrPct(errorRate, requestRate)}
                    </text>
                    <text x={NODE_W - 14} y={78} textAnchor="end" className="topology-node-metric mono">
                      CPU {fmtPercent(cpu)}
                    </text>
                    {degraded && (
                      <text x={14} y={96} className="topology-node-metric mono critical">
                        {stats.failedIn} FAILED (inbound)
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        )}

        {selectedStats && selectedNodeId && (
          <div className="topology-selected-panel">
            <span className="topology-selected-name mono">{selectedNodeId}</span>
            <div className="topology-selected-stat">
              <span className="topology-selected-stat-label">In / Out</span>
              <span className="mono">
                {selectedStats.incomingCount} / {selectedStats.outgoingCount} deps
              </span>
            </div>
            <div className="topology-selected-stat">
              <span className="topology-selected-stat-label">Calls</span>
              <span className="mono">
                {selectedStats.totalIn} in, {selectedStats.totalOut} out
              </span>
            </div>
            {selectedStats.failedIn > 0 && (
              <div className="topology-selected-stat">
                <span className="topology-selected-stat-label">Failed</span>
                <span className="mono" style={{ color: "var(--critical)" }}>{selectedStats.failedIn} inbound</span>
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
            <div className="mono">{hoverEdge.edge.totalCalls} requests</div>
            <div className="mono">{hoverEdge.edge.successfulCalls} success &middot; {hoverEdge.edge.failedCalls} failed</div>
            <div className="mono">
              {hoverEdge.edge.totalCalls > 0 ? Math.round((hoverEdge.edge.failedCalls / hoverEdge.edge.totalCalls) * 100) : 0}%
              error &middot; {Math.round(hoverEdge.edge.confidence * 100)}% confidence
            </div>
            {hoverEdge.edge.lastObservedAt && (
              <div className="chart-tooltip-muted mono">{new Date(hoverEdge.edge.lastObservedAt).toLocaleTimeString()}</div>
            )}
          </Tooltip>
        )}

        {hoverNode && graph && (
          <Tooltip x={hoverNode.screenX} y={hoverNode.screenY}>
            <div className="chart-tooltip-time">{hoverNode.id}</div>
            {metrics ? (
              <>
                <div className="mono">CPU {fmtPercent(metrics.cpu[hoverNode.id])} &middot; Mem {fmtMb(metrics.memory[hoverNode.id])}</div>
                <div className="mono">{fmtRate(metrics.requestRate[hoverNode.id])} &middot; err {fmtErrPct(metrics.errorRate[hoverNode.id], metrics.requestRate[hoverNode.id])}</div>
                <div className="mono">P95 {fmtMs(metrics.latencyP95[hoverNode.id])}</div>
              </>
            ) : (
              (() => {
                const stats = computeNodeStats(hoverNode.id, graph.edges);
                return (
                  <>
                    <div className="mono">{stats.incomingCount} in / {stats.outgoingCount} out deps</div>
                    <div className="mono">{stats.totalIn} calls in, {stats.totalOut} out</div>
                  </>
                );
              })()
            )}
            <div className="chart-tooltip-muted">Click to select, then inspect</div>
          </Tooltip>
        )}
      </SectionState>
    </section>
  );
}
