import {
  getCpuUsage,
  getDependencyGraph,
  getErrorRate,
  getLatencyP95,
  getMemoryUsage,
  getRecentEvents,
  getRequestRate,
  getRootCauses,
  getServiceHealth,
} from "../services/api";
import { useFetchState } from "../hooks/useFetchState";
import { usePolling } from "../hooks/usePolling";
import SystemStatus from "../components/SystemStatus";
import ServiceHealthPanel from "../components/ServiceHealthPanel";
import MetricsPanel, { type RuntimeMetrics } from "../components/MetricsPanel";
import DependencyGraphPanel from "../components/DependencyGraphPanel";
import RootCausePanel from "../components/RootCausePanel";
import RecentEventsPanel from "../components/RecentEventsPanel";
import type {
  DependencyGraphResponse,
  RootCauseCandidate,
  ServiceEventRecord,
  ServiceHealthMap,
} from "../types";

const POLL_INTERVAL_MS = 7000;

export default function Dashboard() {
  const health = useFetchState<ServiceHealthMap>();
  const graph = useFetchState<DependencyGraphResponse>();
  const rootCauses = useFetchState<RootCauseCandidate[]>();
  const events = useFetchState<ServiceEventRecord[]>();
  const metrics = useFetchState<RuntimeMetrics>();

  usePolling(() => {
    health.run(getServiceHealth());
    graph.run(getDependencyGraph());
    rootCauses.run(getRootCauses());
    events.run(getRecentEvents());
    metrics.run(
      Promise.all([getCpuUsage(), getMemoryUsage(), getRequestRate(), getErrorRate(), getLatencyP95()]).then(
        ([cpu, memory, requestRate, errorRate, latencyP95]) => ({ cpu, memory, requestRate, errorRate, latencyP95 })
      )
    );
  }, POLL_INTERVAL_MS);

  return (
    <div className="dashboard">
      <SystemStatus health={health.data} graph={graph.data} events={events.data} rootCauses={rootCauses.data} />
      <ServiceHealthPanel health={health.data} loading={health.loading} error={health.error} />
      <MetricsPanel metrics={metrics.data} loading={metrics.loading} error={metrics.error} />
      <DependencyGraphPanel graph={graph.data} loading={graph.loading} error={graph.error} />
      <RootCausePanel candidates={rootCauses.data} loading={rootCauses.loading} error={rootCauses.error} />
      <RecentEventsPanel events={events.data} loading={events.loading} error={events.error} />
    </div>
  );
}
