import { getDependencyGraph } from "../services/api";
import { useFetchState } from "../hooks/useFetchState";
import { usePolling } from "../hooks/usePolling";
import DependencyGraphPanel from "../components/DependencyGraphPanel";
import type { DependencyGraphResponse } from "../types";

// Topology changes far less often than metrics - a slower cadence is enough.
const POLL_INTERVAL_MS = 15000;

export default function Topology() {
  const graph = useFetchState<DependencyGraphResponse>();
  usePolling(() => graph.run(getDependencyGraph()), POLL_INTERVAL_MS);

  return (
    <div className="page">
      <div className="page-header">
        <h1>Topology</h1>
        <p>Interactive service dependency graph, inferred entirely from observed traffic.</p>
      </div>
      <DependencyGraphPanel graph={graph.data} loading={graph.loading} error={graph.error} />
    </div>
  );
}
