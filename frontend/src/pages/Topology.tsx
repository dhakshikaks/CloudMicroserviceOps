import {
  getCpuUsage,
  getDependencyGraph,
  getErrorRate,
  getLatencyP95,
  getMemoryUsage,
  getRequestRate,
} from "../services/api";
import { useFetchState } from "../hooks/useFetchState";
import { usePolling } from "../hooks/usePolling";
import DependencyGraphPanel from "../components/DependencyGraphPanel";
import type { DependencyGraphResponse } from "../types";
import type { RuntimeMetrics } from "../components/MetricsPanel";

// Topology changes far less often than metrics - a slower cadence is enough.
const POLL_INTERVAL_MS = 15000;

export default function Topology() {
  const graph = useFetchState<DependencyGraphResponse>();
  const metrics = useFetchState<RuntimeMetrics>();
  usePolling(() => {
    graph.run(getDependencyGraph());
    metrics.run(
      Promise.all([getCpuUsage(), getMemoryUsage(), getRequestRate(), getErrorRate(), getLatencyP95()]).then(
        ([cpu, memory, requestRate, errorRate, latencyP95]) => ({ cpu, memory, requestRate, errorRate, latencyP95 })
      )
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, POLL_INTERVAL_MS);

  return (
    <div className="page">
      <div className="page-header">
        <h1>Topology</h1>
      </div>
      <DependencyGraphPanel graph={graph.data} loading={graph.loading} error={graph.error} metrics={metrics.data} minCanvasHeight={560} />
    </div>
  );
}
