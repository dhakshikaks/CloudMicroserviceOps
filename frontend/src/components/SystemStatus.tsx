import type { DependencyGraphResponse, ServiceHealthMap, ServiceMetrics } from "../types";
import { MONITORED_SERVICES } from "../services/api";

interface Props {
  health: ServiceHealthMap | null;
  graph: DependencyGraphResponse | null;
  errorRate: ServiceMetrics | null;
  latencyP95: ServiceMetrics | null;
}

function sum(values: ServiceMetrics | null): number | undefined {
  if (!values) return undefined;
  const nums = MONITORED_SERVICES.map((s) => values[s]).filter((v): v is number => v !== undefined);
  if (nums.length === 0) return undefined;
  return nums.reduce((a, b) => a + b, 0);
}

function avg(values: ServiceMetrics | null): number | undefined {
  if (!values) return undefined;
  const nums = MONITORED_SERVICES.map((s) => values[s]).filter((v): v is number => v !== undefined);
  if (nums.length === 0) return undefined;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export default function SystemStatus({ health, graph, errorRate, latencyP95 }: Props) {
  const upCount = health ? MONITORED_SERVICES.filter((s) => health[s]).length : null;
  const totalErrorRate = sum(errorRate);
  const avgP95 = avg(latencyP95);

  return (
    <div className="summary-row">
      <div className="summary-item">
        <span className="summary-label">Services</span>
        <span className="summary-value">{upCount === null ? "—" : `${upCount}/${MONITORED_SERVICES.length}`}</span>
        <span className="summary-detail">reporting up</span>
      </div>
      <div className="summary-item">
        <span className="summary-label">Dependencies</span>
        <span className="summary-value">{graph ? graph.edges.length : "—"}</span>
        <span className="summary-detail">observed, all-time</span>
      </div>
      <div className={`summary-item${totalErrorRate !== undefined && totalErrorRate > 0 ? " tone-critical" : ""}`}>
        <span className="summary-label">Error Rate</span>
        <span className={`summary-value${totalErrorRate !== undefined && totalErrorRate > 0 ? " tone-critical" : ""}`}>
          {totalErrorRate === undefined ? "—" : `${totalErrorRate.toFixed(2)}/s`}
        </span>
        <span className="summary-detail">sum, all services</span>
      </div>
      <div className="summary-item">
        <span className="summary-label">P95</span>
        <span className="summary-value">{avgP95 === undefined ? "—" : `${(avgP95 * 1000).toFixed(0)}ms`}</span>
        <span className="summary-detail">average, all services</span>
      </div>
    </div>
  );
}
