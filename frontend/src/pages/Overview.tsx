import { useEffect, useRef, useState } from "react";
import {
  getDependencyGraph,
  getErrorRateRange,
  getLatencyP95Range,
  getMetricsSnapshot,
  getRecentEvents,
  getRequestRateRange,
  getRootCauses,
  getServiceHealth,
  type RangeSeries,
} from "../services/api";
import { useFetchState } from "../hooks/useFetchState";
import { usePolling } from "../hooks/usePolling";
import { useTimeWindow } from "../context/TimeWindowContext";
import { useRefresh } from "../context/RefreshContext";
import SystemStatus from "../components/SystemStatus";
import ServicePipelinePanel from "../components/ServicePipelinePanel";
import ExecutionConsolePanel from "../components/ExecutionConsolePanel";
import PipelineBreakdownTabs from "../components/PipelineBreakdownTabs";
import LineChart from "../components/charts/LineChart";
import type { DependencyGraphResponse, RootCauseCandidate, ServiceEventRecord, ServiceHealthMap } from "../types";
import type { RuntimeMetrics } from "../components/MetricsPanel";

const POLL_INTERVAL_MS = 7000;
const TREND_POLL_INTERVAL_MS = 15000;

export default function Overview() {
  const { timeWindow } = useTimeWindow();
  const { lastRefreshAt } = useRefresh();
  const isFirstRefresh = useRef(true);

  const health = useFetchState<ServiceHealthMap>();
  const graph = useFetchState<DependencyGraphResponse>();
  const rootCauses = useFetchState<RootCauseCandidate[]>();
  const events = useFetchState<ServiceEventRecord[]>();
  const metrics = useFetchState<RuntimeMetrics>();

  const requestRateTrend = useFetchState<RangeSeries[]>();
  const errorRateTrend = useFetchState<RangeSeries[]>();
  const latencyTrend = useFetchState<RangeSeries[]>();
  const [trendsUpdatedAt, setTrendsUpdatedAt] = useState<number | null>(null);

  usePolling(() => {
    health.run(getServiceHealth());
    graph.run(getDependencyGraph());
    rootCauses.run(getRootCauses());
    events.run(getRecentEvents());
    metrics.run(getMetricsSnapshot());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, POLL_INTERVAL_MS);

  // The topbar's "Refresh now" button forces an immediate re-poll on top of
  // the interval above (skip the very first tick - usePolling already fires
  // on mount at the same instant RefreshProvider's initial timestamp is set).
  useEffect(() => {
    if (isFirstRefresh.current) {
      isFirstRefresh.current = false;
      return;
    }
    health.run(getServiceHealth());
    graph.run(getDependencyGraph());
    rootCauses.run(getRootCauses());
    events.run(getRecentEvents());
    metrics.run(getMetricsSnapshot());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastRefreshAt]);

  useEffect(() => {
    let cancelled = false;
    function fetchTrends() {
      Promise.all([getRequestRateRange(timeWindow), getErrorRateRange(timeWindow), getLatencyP95Range(timeWindow)])
        .then(([rr, er, lat]) => {
          if (cancelled) return;
          requestRateTrend.run(Promise.resolve(rr));
          errorRateTrend.run(Promise.resolve(er));
          latencyTrend.run(Promise.resolve(lat));
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

  const updatedLabel = trendsUpdatedAt ? `${Math.max(0, Math.round((Date.now() - trendsUpdatedAt) / 1000))}s ago` : "";
  const requestRateSamples = requestRateTrend.data?.[0]?.samples ?? [];
  const requestRateNow = requestRateSamples.length > 0 ? requestRateSamples[requestRateSamples.length - 1].value : undefined;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Overview</h1>
      </div>

      <SystemStatus
        health={health.data}
        graph={graph.data}
        errorRate={metrics.data?.errorRate ?? null}
        latencyP95={metrics.data?.latencyP95 ?? null}
      />

      <div className="pipeline-layout">
        <div className="pipeline-main">
          <ServicePipelinePanel graph={graph.data} health={health.data} metrics={metrics.data} loading={graph.loading} error={graph.error} />

          <div className="dominant-chart">
            <div className="dominant-chart-head">
              <h2>Request rate — all services</h2>
              <div style={{ display: "flex", alignItems: "baseline", gap: "0.75rem" }}>
                {updatedLabel && <span className="last-updated">{updatedLabel}</span>}
                <span className="dominant-chart-value">{requestRateNow === undefined ? "—" : `${requestRateNow.toFixed(2)}/s`}</span>
              </div>
            </div>
            <LineChart samples={requestRateSamples} width={1040} height={220} yFormat={(v) => `${v.toFixed(1)}/s`} />
          </div>

          <div className="trend-grid">
            <div className="trend-card">
              <h3>P95 latency</h3>
              <LineChart samples={latencyTrend.data?.[0]?.samples ?? []} width={500} height={130} yFormat={(v) => `${(v * 1000).toFixed(0)}ms`} />
            </div>
            <div className="trend-card">
              <h3>Error rate</h3>
              <LineChart
                samples={errorRateTrend.data?.[0]?.samples ?? []}
                width={500}
                height={130}
                yFormat={(v) => `${v.toFixed(2)}/s`}
                tone={(errorRateTrend.data?.[0]?.samples ?? []).some((s) => s.value > 0) ? "critical" : "default"}
              />
            </div>
          </div>
        </div>

        <ExecutionConsolePanel
          rootCauseProps={{
            candidates: rootCauses.data,
            metrics: metrics.data,
            graph: graph.data,
            loading: rootCauses.loading,
            error: rootCauses.error,
          }}
          events={events.data}
          eventsLoading={events.loading}
          eventsError={events.error}
          metrics={metrics.data}
          metricsLoading={metrics.loading}
          metricsError={metrics.error}
        />
      </div>

      <PipelineBreakdownTabs metrics={metrics.data} loading={metrics.loading} error={metrics.error} />
    </div>
  );
}
