import { RefreshCw, X } from "lucide-react";
import { useServiceInspectorData } from "../hooks/useServiceInspectorData";
import StatusBadge from "./StatusBadge";
import SectionState from "./SectionState";
import Sparkline from "./charts/Sparkline";

interface Props {
  serviceName: string;
  onClose: () => void;
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
  const d = useServiceInspectorData(serviceName);

  return (
    <div className="service-inspector">
      <div className="service-inspector-head">
        <div>
          <span className="service-inspector-eyebrow">Service</span>
          <div className="service-inspector-name">{serviceName}</div>
          <StatusBadge status={d.status} />
        </div>
        <div className="service-inspector-actions">
          <button type="button" title="Refresh" onClick={d.refresh}>
            <RefreshCw size={14} />
          </button>
          <button type="button" title="Close" onClick={onClose}>
            <X size={15} />
          </button>
        </div>
      </div>

      <SectionState loading={d.loading} error={d.error} empty={false} skeletonRows={3}>
        <div className="service-inspector-section">
          <h3>Metrics</h3>
          <div className="inspector-row">
            <span className="inspector-row-label">CPU</span>
            <span className="inspector-row-value">{fmtPercent(d.cpu)}</span>
          </div>
          <div className="inspector-row">
            <span className="inspector-row-label">Memory</span>
            <span className="inspector-row-value">{fmtMb(d.memory)}</span>
          </div>
          <div className="inspector-row">
            <span className="inspector-row-label">Request rate</span>
            <span className="inspector-row-value">{fmtRate(d.requestRate)}</span>
          </div>
          <div className="inspector-row">
            <span className="inspector-row-label">Error rate</span>
            <span className="inspector-row-value">{fmtRate(d.errorRate)}</span>
          </div>
          <div className="inspector-row">
            <span className="inspector-row-label">P95 latency</span>
            <span className="inspector-row-value">{fmtMs(d.latencyP95)}</span>
          </div>
        </div>
      </SectionState>

      <div className="service-inspector-section">
        <h3>Error rate (last 15 min)</h3>
        <Sparkline samples={d.errorSamples} width={280} height={44} tone={d.errorSamples.some((s) => s.value > 0) ? "critical" : "default"} />
      </div>
      <div className="service-inspector-section">
        <h3>P95 latency (last 15 min)</h3>
        <Sparkline samples={d.latencySamples} width={280} height={44} />
      </div>

      <div className="service-inspector-section">
        <h3>Dependencies</h3>
        <div className="inspector-row-label" style={{ marginBottom: "0.2rem" }}>Outgoing ({d.outgoing.length})</div>
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
        <div className="inspector-row-label" style={{ margin: "0.6rem 0 0.2rem" }}>Incoming ({d.incoming.length})</div>
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
          <p className="state-message">No recent activity for this service.</p>
        ) : (
          <ul className="service-inspector-event-list">
            {d.recentActivity.slice(0, 10).map((e) => (
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
