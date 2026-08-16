import { useEffect } from "react";
import { RefreshCw, X } from "lucide-react";
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
  getServiceHealth,
  type RangeSeries,
} from "../services/api";
import { useFetchState } from "../hooks/useFetchState";
import type { DependencyEdge, ServiceEventRecord, ServiceHealthMap, ServiceMetrics } from "../types";
import StatusBadge from "./StatusBadge";
import SectionState from "./SectionState";
import Sparkline from "./charts/Sparkline";

interface Props {
  serviceName: string;
  onClose: () => void;
}

interface InspectorSnapshot {
  health: ServiceHealthMap;
  cpu: ServiceMetrics;
  memory: ServiceMetrics;
  requestRate: ServiceMetrics;
  errorRate: ServiceMetrics;
  latencyP95: ServiceMetrics;
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

export default function ServiceInspector({ serviceName, onClose }: Props) {
  const snapshot = useFetchState<InspectorSnapshot>();
  const dependencies = useFetchState<DependencyEdge[]>();
  const events = useFetchState<ServiceEventRecord[]>();
  const errorHistory = useFetchState<RangeSeries[]>();
  const latencyHistory = useFetchState<RangeSeries[]>();

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

  const errorSamples =
    errorHistory.data?.find((s) => s.metric.job === serviceName)?.samples ?? [];
  const latencySamples =
    latencyHistory.data?.find((s) => s.metric.job === serviceName)?.samples ?? [];

  return (
    <div className="service-inspector">
      <div className="service-inspector-head">
        <div>
          <span className="service-inspector-eyebrow">Service</span>
          <div className="service-inspector-name">{serviceName}</div>
          <StatusBadge status={status} />
        </div>
        <div className="service-inspector-actions">
          <button type="button" title="Refresh" onClick={loadAll}>
            <RefreshCw size={14} />
          </button>
          <button type="button" title="Close" onClick={onClose}>
            <X size={15} />
          </button>
        </div>
      </div>

      <SectionState loading={snapshot.loading} error={snapshot.error} empty={false} skeletonRows={3}>
        <div className="service-inspector-section">
          <h3>Metrics</h3>
          <div className="inspector-row">
            <span className="inspector-row-label">CPU</span>
            <span className="inspector-row-value">{fmtPercent(snapshot.data?.cpu[serviceName])}</span>
          </div>
          <div className="inspector-row">
            <span className="inspector-row-label">Memory</span>
            <span className="inspector-row-value">{fmtMb(snapshot.data?.memory[serviceName])}</span>
          </div>
          <div className="inspector-row">
            <span className="inspector-row-label">Request rate</span>
            <span className="inspector-row-value">{fmtRate(snapshot.data?.requestRate[serviceName])}</span>
          </div>
          <div className="inspector-row">
            <span className="inspector-row-label">Error rate</span>
            <span className="inspector-row-value">{fmtRate(snapshot.data?.errorRate[serviceName])}</span>
          </div>
          <div className="inspector-row">
            <span className="inspector-row-label">P95 latency</span>
            <span className="inspector-row-value">{fmtMs(snapshot.data?.latencyP95[serviceName])}</span>
          </div>
        </div>
      </SectionState>

      <div className="service-inspector-section">
        <h3>Error rate (last 15 min)</h3>
        <Sparkline samples={errorSamples} width={280} height={44} tone={errorSamples.some((s) => s.value > 0) ? "critical" : "default"} />
      </div>
      <div className="service-inspector-section">
        <h3>P95 latency (last 15 min)</h3>
        <Sparkline samples={latencySamples} width={280} height={44} />
      </div>

      <div className="service-inspector-section">
        <h3>Dependencies</h3>
        <div className="inspector-row-label" style={{ marginBottom: "0.2rem" }}>Outgoing ({outgoing.length})</div>
        {outgoing.length === 0 ? (
          <p className="state-message">None observed.</p>
        ) : (
          <ul className="service-inspector-edge-list">
            {outgoing.map((e) => (
              <li key={`${e.sourceService}-${e.targetService}`}>
                <span>{e.targetService}</span>
                <span className="cell-muted">
                  {e.totalCalls} calls · {Math.round(e.confidence * 100)}%
                  {e.failedCalls > 0 && <span className="cell-elevated"> · {e.failedCalls} failed</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="inspector-row-label" style={{ margin: "0.6rem 0 0.2rem" }}>Incoming ({incoming.length})</div>
        {incoming.length === 0 ? (
          <p className="state-message">None observed.</p>
        ) : (
          <ul className="service-inspector-edge-list">
            {incoming.map((e) => (
              <li key={`${e.sourceService}-${e.targetService}`}>
                <span>{e.sourceService}</span>
                <span className="cell-muted">
                  {e.totalCalls} calls · {Math.round(e.confidence * 100)}%
                  {e.failedCalls > 0 && <span className="cell-elevated"> · {e.failedCalls} failed</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="service-inspector-section">
        <h3>Recent activity</h3>
        {recentActivity.length === 0 ? (
          <p className="state-message">No recent activity for this service.</p>
        ) : (
          <ul className="service-inspector-event-list">
            {recentActivity.slice(0, 10).map((e) => (
              <li key={e.eventId}>
                <span className="cell-muted">{new Date(e.timestamp).toLocaleTimeString()}</span>
                <span>
                  {e.sourceService} &rarr; {e.targetService}
                </span>
                <StatusBadge status={e.status} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
