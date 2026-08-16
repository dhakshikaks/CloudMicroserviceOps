import { useEffect } from "react";
import {
  getCpuUsage,
  getDependencies,
  getErrorRate,
  getErrorRateRangeByService,
  getLatencyP95,
  getLatencyP95RangeByService,
  getMemoryUsage,
  getRecentEvents,
  getRequestRate,
  getRequestRateRangeByService,
  getServiceHealth,
  type RangeSeries,
} from "../services/api";
import { useFetchState } from "./useFetchState";
import type { DependencyEdge, ServiceEventRecord, ServiceHealthMap, ServiceMetrics } from "../types";

interface InspectorSnapshot {
  health: ServiceHealthMap;
  cpu: ServiceMetrics;
  memory: ServiceMetrics;
  requestRate: ServiceMetrics;
  errorRate: ServiceMetrics;
  latencyP95: ServiceMetrics;
}

/** Shared by the slide-over Service Inspector and the Services explorer's center pane. */
export function useServiceInspectorData(serviceName: string) {
  const snapshot = useFetchState<InspectorSnapshot>();
  const dependencies = useFetchState<DependencyEdge[]>();
  const events = useFetchState<ServiceEventRecord[]>();
  const errorHistory = useFetchState<RangeSeries[]>();
  const latencyHistory = useFetchState<RangeSeries[]>();
  const requestRateHistory = useFetchState<RangeSeries[]>();

  function loadAll() {
    snapshot.run(
      Promise.all([getServiceHealth(), getCpuUsage(), getMemoryUsage(), getRequestRate(), getErrorRate(), getLatencyP95()]).then(
        ([health, cpu, memory, requestRate, errorRate, latencyP95]) => ({
          health,
          cpu,
          memory,
          requestRate,
          errorRate,
          latencyP95,
        })
      )
    );
    dependencies.run(getDependencies());
    events.run(getRecentEvents());
    // Fixed 15-minute focus window - a drill-down, not tied to the global chart window.
    errorHistory.run(getErrorRateRangeByService("15m"));
    latencyHistory.run(getLatencyP95RangeByService("15m"));
    requestRateHistory.run(getRequestRateRangeByService("15m"));
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceName]);

  const status = snapshot.data
    ? snapshot.data.health[serviceName] === undefined
      ? "UNKNOWN"
      : snapshot.data.health[serviceName]
        ? (snapshot.data.errorRate[serviceName] ?? 0) > 0
          ? "DEGRADED"
          : "UP"
        : "DOWN"
    : "UNKNOWN";

  const incoming = (dependencies.data ?? []).filter((e) => e.targetService === serviceName);
  const outgoing = (dependencies.data ?? []).filter((e) => e.sourceService === serviceName);
  const recentActivity = (events.data ?? []).filter(
    (e) => e.sourceService === serviceName || e.targetService === serviceName
  );

  const errorSamples = errorHistory.data?.find((s) => s.metric.job === serviceName)?.samples ?? [];
  const latencySamples = latencyHistory.data?.find((s) => s.metric.job === serviceName)?.samples ?? [];
  const requestRateSamples = requestRateHistory.data?.find((s) => s.metric.job === serviceName)?.samples ?? [];

  return {
    loading: snapshot.loading,
    error: snapshot.error,
    status,
    cpu: snapshot.data?.cpu[serviceName],
    memory: snapshot.data?.memory[serviceName],
    requestRate: snapshot.data?.requestRate[serviceName],
    errorRate: snapshot.data?.errorRate[serviceName],
    latencyP95: snapshot.data?.latencyP95[serviceName],
    incoming,
    outgoing,
    recentActivity,
    errorSamples,
    latencySamples,
    requestRateSamples,
    refresh: loadAll,
  };
}
