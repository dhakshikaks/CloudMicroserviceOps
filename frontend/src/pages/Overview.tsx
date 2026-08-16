import { useEffect, useState } from "react";
import {
  getCpuUsage,
  getCpuUsageRange,
  getDependencyGraph,
  getErrorRate,
  getErrorRateRange,
  getLatencyP95,
  getLatencyP95Range,
  getMemoryUsage,
  getRecentEvents,
  getRequestRate,
  getRequestRateRange,
  getRootCauses,
  getServiceHealth,
  type RangeSeries,
} from "../services/api";
import { useFetchState } from "../hooks/useFetchState";
import { usePolling } from "../hooks/usePolling";
import { useTimeWindow } from "../context/TimeWindowContext";
import SystemStatus from "../components/SystemStatus";
import RootCauseSummaryCard from "../components/RootCauseSummaryCard";
import RecentEventsPanel from "../components/RecentEventsPanel";
import LineChart from "../components/charts/LineChart";
import type { DependencyGraphResponse, RootCauseCandidate, ServiceEventRecord, ServiceHealthMap } from "../types";
import type { RuntimeMetrics } from "../components/MetricsPanel";

const POLL_INTERVAL_MS = 7000;
const TREND_POLL_INTERVAL_MS = 15000;

export default function Overview() {
  const { timeWindow } = useTimeWindow();

  const health = useFetchState<ServiceHealthMap>();
  const graph = useFetchState<DependencyGraphResponse>();
  const rootCauses = useFetchState<RootCauseCandidate[]>();
  const events = useFetchState<ServiceEventRecord[]>();
  const metrics = useFetchState<RuntimeMetrics>();

  const requestRateTrend = useFetchState<RangeSeries[]>();
  const errorRateTrend = useFetchState<RangeSeries[]>();
  const latencyTrend = useFetchState<RangeSeries[]>();
  const cpuTrend = useFetchState<RangeSeries[]>();
  const [trendsUpdatedAt, setTrendsUpdatedAt] = useState<number | null>(null);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, POLL_INTERVAL_MS);

  // Separate effect (not usePolling) so changing the time window re-fetches
  // immediately instead of waiting for the next scheduled tick.
  useEffect(() => {
    let cancelled = false;
    function fetchTrends() {
      Promise.all([
        getRequestRateRange(timeWindow),
        getErrorRateRange(timeWindow),
        getLatencyP95Range(timeWindow),
        getCpuUsageRange(timeWindow),
      ])
        .then(([rr, er, lat, cpu]) => {
          if (cancelled) return;
          requestRateTrend.run(Promise.resolve(rr));
          errorRateTrend.run(Promise.resolve(er));
          latencyTrend.run(Promise.resolve(lat));
          cpuTrend.run(Promise.resolve(cpu));
          setTrendsUpdatedAt(Date.now());
        })
        .catch(() => {});
    }
    fetchTrends();
    const id = setInterval(fetchTrends, TREND_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeWindow]);

  const updatedLabel = trendsUpdatedAt ? `Updated ${Math.max(0, Math.round((Date.now() - trendsUpdatedAt) / 1000))}s ago` : "";

  return (
    <div className="page">
      <div className="page-header">
        <h1>Overview</h1>
        <p>Real-time monitoring and root-cause analysis for the CloudMicroserviceOps platform.</p>
      </div>

      <SystemStatus health={health.data} graph={graph.data} events={events.data} rootCauses={rootCauses.data} />

      <section className="panel">
        <div className="panel-header-row">
          <div>
            <h2 className="section-title">Trends</h2>
            <p className="section-subtitle">Aggregate across all monitored services, real Prometheus history for the selected chart window.</p>
          </div>
          {updatedLabel && <span className="last-updated">{updatedLabel}</span>}
        </div>
        <div className="trend-grid">
          <div className="trend-card">
            <h3>Request rate (all services)</h3>
            <LineChart samples={requestRateTrend.data?.[0]?.samples ?? []} width={520} height={140} yFormat={(v) => `${v.toFixed(1)}/s`} />
          </div>
          <div className="trend-card">
            <h3>Error rate (all services)</h3>
            <LineChart samples={errorRateTrend.data?.[0]?.samples ?? []} width={520} height={140} yFormat={(v) => `${v.toFixed(2)}/s`} />
          </div>
          <div className="trend-card">
            <h3>P95 latency (all services)</h3>
            <LineChart samples={latencyTrend.data?.[0]?.samples ?? []} width={520} height={140} yFormat={(v) => `${(v * 1000).toFixed(0)}ms`} />
          </div>
          <div className="trend-card">
            <h3>CPU (average, all services)</h3>
            <LineChart samples={cpuTrend.data?.[0]?.samples ?? []} width={520} height={140} yFormat={(v) => `${(v * 100).toFixed(0)}%`} />
          </div>
        </div>
      </section>

      <RootCauseSummaryCard
        candidates={rootCauses.data}
        metrics={metrics.data}
        graph={graph.data}
        loading={rootCauses.loading}
        error={rootCauses.error}
        compact
      />

      <RecentEventsPanel events={events.data ? events.data.slice(0, 6) : null} loading={events.loading} error={events.error} compact />
    </div>
  );
}
