import type { DependencyEdge, DependencyGraphResponse } from "../types";
import SectionState from "./SectionState";

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

function edgesBetween(edges: DependencyEdge[], from: string[], to: string[]): DependencyEdge[] {
  return edges.filter((e) => from.includes(e.sourceService) && to.includes(e.targetService));
}

export default function DependencyGraphPanel({ graph, loading, error }: Props) {
  const layers = graph ? computeLayers(graph) : [];

  return (
    <section className="panel">
      <h2 className="section-title">Dependency Graph</h2>
      <p className="section-subtitle">
        Cumulative service topology inferred from all observed calls since startup - not a static
        diagram, and not limited to the dashboard's live window.
      </p>
      <SectionState
        loading={loading}
        error={error}
        empty={!graph || graph.edges.length === 0}
        emptyMessage="No dependencies observed yet."
        skeletonRows={4}
      >
        {graph && (
          <div className="topology">
            {layers.map((layer, i) => (
              <div key={layer.join(",")}>
                <div className="topology-layer">
                  {layer.map((nodeId) => (
                    <div key={nodeId} className="topology-node">
                      {nodeId}
                    </div>
                  ))}
                </div>
                {i < layers.length - 1 &&
                  edgesBetween(graph.edges, layer, layers[i + 1]).map((edge) => (
                    <div
                      key={`${edge.sourceService}->${edge.targetService}`}
                      className="topology-connector"
                    >
                      <div className="topology-connector-line" />
                      <div className={`topology-connector-card${edge.failedCalls > 0 ? " has-failures" : ""}`}>
                        <span className="topology-connector-arrow">
                          {edge.sourceService} &rarr; {edge.targetService}
                        </span>
                        <span className="topology-connector-stat">
                          <strong>{edge.totalCalls}</strong>
                          total
                        </span>
                        <span className="topology-connector-stat">
                          <strong>{edge.successfulCalls}</strong>
                          ok
                        </span>
                        <span className="topology-connector-stat stat-fail">
                          <strong>{edge.failedCalls}</strong>
                          failed
                        </span>
                        <span className="topology-connector-stat">
                          <span className="confidence-bar">
                            <span
                              className="confidence-bar-fill"
                              style={{ width: `${Math.round(edge.confidence * 100)}%` }}
                            />
                          </span>
                          {Math.round(edge.confidence * 100)}%
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            ))}
          </div>
        )}
      </SectionState>
    </section>
  );
}
