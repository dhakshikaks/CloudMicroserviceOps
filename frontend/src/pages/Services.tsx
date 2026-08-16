import { useState } from "react";
import { getErrorRate, getServiceHealth, MONITORED_SERVICES } from "../services/api";
import { useFetchState } from "../hooks/useFetchState";
import { usePolling } from "../hooks/usePolling";
import { useServiceInspectorData } from "../hooks/useServiceInspectorData";
import { deriveServiceStatus } from "../lib/status";
import StatusBadge from "../components/StatusBadge";
import SectionState from "../components/SectionState";
import LineChart from "../components/charts/LineChart";
import type { ServiceHealthMap, ServiceMetrics } from "../types";

const POLL_INTERVAL_MS = 7000;

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

export default function Services() {
  const health = useFetchState<ServiceHealthMap>();
  const errorRate = useFetchState<ServiceMetrics>();
  usePolling(() => {
    health.run(getServiceHealth());
    errorRate.run(getErrorRate());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, POLL_INTERVAL_MS);

  const [selected, setSelected] = useState(MONITORED_SERVICES[0]);
  const d = useServiceInspectorData(selected);

  return (
    <div className="page">
      <div className="page-header">
        <h1>Services</h1>
        <p>{MONITORED_SERVICES.length} monitored</p>
      </div>

      <div className="explorer-grid">
        <div className="explorer-list">
          {MONITORED_SERVICES.map((service) => {
            const status = deriveServiceStatus(health.data?.[service], errorRate.data?.[service]);
            return (
              <button
                key={service}
                type="button"
                className={`explorer-list-item${service === selected ? " active" : ""}`}
                onClick={() => setSelected(service)}
              >
                <span>{service}</span>
                <StatusBadge status={status} />
              </button>
            );
          })}
        </div>

        <div className="explorer-center">
          <SectionState loading={d.loading} error={d.error} empty={false} skeletonRows={3}>
            <div className="explorer-center-head">
              <div>
                <span className="service-inspector-eyebrow">Service</span>
                <div className="explorer-center-name">{selected}</div>
              </div>
              <StatusBadge status={d.status} />
            </div>

            <div className="summary-row" style={{ marginBottom: "1rem" }}>
              <div className="summary-item">
                <span className="summary-label">CPU</span>
                <span className="summary-value">{fmtPercent(d.cpu)}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Memory</span>
                <span className="summary-value">{fmtMb(d.memory)}</span>
              </div>
              <div className={`summary-item${d.errorRate !== undefined && d.errorRate > 0 ? " tone-critical" : ""}`}>
                <span className="summary-label">Error rate</span>
                <span className={`summary-value${d.errorRate !== undefined && d.errorRate > 0 ? " tone-critical" : ""}`}>
                  {fmtRate(d.errorRate)}
                </span>
              </div>
              <div className="summary-item">
                <span className="summary-label">P95</span>
                <span className="summary-value">{fmtMs(d.latencyP95)}</span>
              </div>
            </div>

            <div className="dominant-chart" style={{ marginBottom: "1rem" }}>
              <div className="dominant-chart-head">
                <h2>Request rate</h2>
                <span className="dominant-chart-value">{fmtRate(d.requestRate)}</span>
              </div>
              <LineChart samples={d.requestRateSamples} width={720} height={160} yFormat={(v) => `${v.toFixed(2)}/s`} />
            </div>

            <div className="trend-card" style={{ border: "1px solid var(--border)" }}>
              <h3>P95 latency (15m)</h3>
              <LineChart samples={d.latencySamples} width={700} height={120} yFormat={(v) => `${(v * 1000).toFixed(0)}ms`} />
            </div>
          </SectionState>
        </div>

        <div className="explorer-right">
          <div className="service-inspector-section">
            <h3>Outgoing ({d.outgoing.length})</h3>
            {d.outgoing.length === 0 ? (
              <p className="state-message">None observed.</p>
            ) : (
              <ul className="service-inspector-edge-list">
                {d.outgoing.map((e) => (
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
          </div>
          <div className="service-inspector-section">
            <h3>Incoming ({d.incoming.length})</h3>
            {d.incoming.length === 0 ? (
              <p className="state-message">None observed.</p>
            ) : (
              <ul className="service-inspector-edge-list">
                {d.incoming.map((e) => (
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
            {d.recentActivity.length === 0 ? (
              <p className="state-message">None observed.</p>
            ) : (
              <ul className="service-inspector-event-list">
                {d.recentActivity.slice(0, 8).map((e) => (
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
      </div>
    </div>
  );
}
