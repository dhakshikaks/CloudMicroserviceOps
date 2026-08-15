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
  MONITORED_SERVICES,
} from "../services/api";
import { useFetchState } from "../hooks/useFetchState";
import { usePolling } from "../hooks/usePolling";
import { deriveSystemPulse } from "../lib/status";
import Sidebar from "../components/Sidebar";
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

  const systemPulse = deriveSystemPulse(health.data, MONITORED_SERVICES);

  return (
    <div className="app-shell">
      <Sidebar systemPulse={systemPulse} />
      <main className="app-main">
        <div className="app-main-header">
          <h1>Overview</h1>
          <p>Real-time monitoring and root-cause analysis for the CloudMicroserviceOps platform.</p>
        </div>

        <div className="dashboard">
          <section id="overview" className="dashboard-section">
            <SystemStatus health={health.data} graph={graph.data} events={events.data} rootCauses={rootCauses.data} />
          </section>

          <section id="services" className="dashboard-section">
            <ServiceHealthPanel
              health={health.data}
              metrics={metrics.data}
              loading={health.loading}
              error={health.error}
            />
            <MetricsPanel metrics={metrics.data} loading={metrics.loading} error={metrics.error} />
          </section>

          <section id="dependency-graph" className="dashboard-section">
            <DependencyGraphPanel graph={graph.data} loading={graph.loading} error={graph.error} />
          </section>

          <section id="incidents" className="dashboard-section">
            <RootCausePanel
              candidates={rootCauses.data}
              metrics={metrics.data}
              graph={graph.data}
              loading={rootCauses.loading}
              error={rootCauses.error}
            />
          </section>

          <section id="events" className="dashboard-section">
            <RecentEventsPanel events={events.data} loading={events.loading} error={events.error} />
          </section>
        </div>
      </main>
    </div>
  );
}
