import { useLayoutEffect, useRef, useState } from "react";
import { Server } from "lucide-react";
import type { DependencyGraphResponse, ServiceHealthMap } from "../types";
import type { RuntimeMetrics } from "./MetricsPanel";
import { computeLayers } from "../lib/graphLayers";
import { fmtRate, fmtMs, fmtErrPct } from "../lib/format";
import { deriveServiceStatus } from "../lib/status";
import SectionState from "./SectionState";
import StatusBadge from "./StatusBadge";

interface Props {
  graph: DependencyGraphResponse | null;
  health: ServiceHealthMap | null;
  metrics: RuntimeMetrics | null;
  loading: boolean;
  error: string | null;
}

// Static copy, not fabricated telemetry - a one-line label for each real
// monitored service, same list as services/api.ts's MONITORED_SERVICES.
const SERVICE_DESCRIPTIONS: Record<string, string> = {
  backend: "Core API gateway and shared business logic",
  "user-service": "Handles authentication and account records",
  "order-service": "Creates and tracks customer orders",
  "payment-service": "Processes and settles payments",
  "inventory-service": "Tracks stock levels across warehouses",
};

// Section headers derived from the real dependency-layer structure
// (computeLayers) rather than invented phase names.
function sectionLabel(index: number, layers: string[][], graph: DependencyGraphResponse): string {
  if (index === 0) return "ENTRY POINTS — NO INBOUND DEPENDENCIES";
  const isLast = index === layers.length - 1;
  if (isLast) {
    const hasOutbound = layers[index].some((id) => graph.edges.some((e) => e.sourceService === id));
    if (!hasOutbound) return "TERMINAL — NO OUTBOUND DEPENDENCIES";
  }
  const count = layers[index].length;
  return `LAYER ${index} — ${count} DOWNSTREAM SERVICE${count === 1 ? "" : "S"}`;
}

interface EdgePath {
  id: string;
  d: string;
  hasFailures: boolean;
}

export default function ServicePipelinePanel({ graph, health, metrics, loading, error }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [edgePaths, setEdgePaths] = useState<EdgePath[]>([]);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  const layers = graph ? computeLayers(graph) : [];

  // Connectors are measured from real rendered card positions (not a fixed
  // grid) so they stay correct as cards wrap at different container widths.
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!graph || !container) {
      setEdgePaths([]);
      return;
    }

    function recompute() {
      if (!container || !graph) return;
      const containerRect = container.getBoundingClientRect();
      const paths: EdgePath[] = [];
      for (const edge of graph.edges) {
        const fromEl = cardRefs.current.get(edge.sourceService);
        const toEl = cardRefs.current.get(edge.targetService);
        if (!fromEl || !toEl) continue;
        const fromRect = fromEl.getBoundingClientRect();
        const toRect = toEl.getBoundingClientRect();
        const x1 = fromRect.left + fromRect.width / 2 - containerRect.left;
        const y1 = fromRect.bottom - containerRect.top;
        const x2 = toRect.left + toRect.width / 2 - containerRect.left;
        const y2 = toRect.top - containerRect.top;
        if (y2 <= y1) continue; // only draw real downstream (downward) flow
        const midY = (y1 + y2) / 2;
        paths.push({
          id: `${edge.sourceService}-${edge.targetService}`,
          d: `M${x1},${y1} C${x1},${midY} ${x2},${midY} ${x2},${y2}`,
          hasFailures: edge.failedCalls > 0,
        });
      }
      setEdgePaths(paths);
      setCanvasSize({ width: container.scrollWidth, height: container.scrollHeight });
    }

    recompute();
    const observer = new ResizeObserver(recompute);
    observer.observe(container);
    window.addEventListener("resize", recompute);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", recompute);
    };
  }, [graph, layers.length]);

  return (
    <section className="panel">
      <div className="pipeline-panel-head">
        <h2 className="section-title">Service Pipeline · Live Execution</h2>
        <div className="legend-row">
          <span className="legend-chip" data-tone="ok">
            <span className="legend-dot" />
            Up
          </span>
          <span className="legend-chip" data-tone="degraded">
            <span className="legend-dot" />
            Degraded
          </span>
          <span className="legend-chip" data-tone="down">
            <span className="legend-dot" />
            Down
          </span>
          <span className="legend-chip" data-tone="unknown">
            <span className="legend-dot" />
            Unknown
          </span>
        </div>
      </div>

      <SectionState
        loading={loading}
        error={error}
        empty={!graph || graph.nodes.length === 0}
        emptyMessage="No services observed yet."
        skeletonRows={4}
      >
        {graph && (
          <div className="pipeline-canvas" ref={containerRef}>
            <svg className="pipeline-connector-svg" width={canvasSize.width} height={canvasSize.height}>
              <defs>
                <marker id="pipeline-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M0,0 L10,5 L0,10 z" className="pipeline-arrowhead" />
                </marker>
                <marker
                  id="pipeline-arrow-failed"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto-start-reverse"
                >
                  <path d="M0,0 L10,5 L0,10 z" className="pipeline-arrowhead failed" />
                </marker>
              </defs>
              {edgePaths.map((p) => (
                <g key={p.id}>
                  <path
                    id={`pipeline-edge-${p.id}`}
                    d={p.d}
                    className={`pipeline-edge${p.hasFailures ? " has-failures" : ""}`}
                    markerEnd={`url(#${p.hasFailures ? "pipeline-arrow-failed" : "pipeline-arrow"})`}
                  />
                  <circle r={2.5} className="pipeline-traffic-dot">
                    <animateMotion dur="2.4s" repeatCount="indefinite">
                      <mpath href={`#pipeline-edge-${p.id}`} />
                    </animateMotion>
                  </circle>
                </g>
              ))}
            </svg>

            {layers.map((layerIds, i) => (
              <div className="pipeline-section" key={i}>
                <div className="pipeline-section-heading">{sectionLabel(i, layers, graph)}</div>
                <div className="pipeline-card-row">
                  {layerIds.map((id) => {
                    const status = deriveServiceStatus(health?.[id], metrics?.errorRate[id]);
                    const requestRate = metrics?.requestRate[id];
                    const p95 = metrics?.latencyP95[id];
                    const errorRate = metrics?.errorRate[id];
                    return (
                      <div
                        className="pipeline-card"
                        key={id}
                        ref={(el) => {
                          if (el) cardRefs.current.set(id, el);
                          else cardRefs.current.delete(id);
                        }}
                      >
                        <div className="pipeline-card-header">
                          <span className="pipeline-card-icon">
                            <Server size={13} />
                          </span>
                          <StatusBadge status={status} />
                        </div>
                        <div className="pipeline-card-title mono">{id}</div>
                        <div className="pipeline-card-desc">{SERVICE_DESCRIPTIONS[id] ?? "Monitored service"}</div>
                        <div className={`pipeline-card-metric-row${errorRate && errorRate > 0 ? " critical" : ""}`}>
                          <span>{fmtRate(requestRate)}</span>
                          <span>P95 {fmtMs(p95)}</span>
                          <span>ERR {fmtErrPct(errorRate, requestRate)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionState>
    </section>
  );
}
