import type { ServiceMetrics } from "../types";
import { MONITORED_SERVICES } from "../services/api";
import SectionState from "./SectionState";

export interface RuntimeMetrics {
  cpu: ServiceMetrics;
  memory: ServiceMetrics;
  requestRate: ServiceMetrics;
  errorRate: ServiceMetrics;
  latencyP95: ServiceMetrics;
}

interface Props {
  metrics: RuntimeMetrics | null;
  loading: boolean;
  error: string | null;
}

function fmt(value: number | undefined, format: (v: number) => string): string {
  return value === undefined ? "—" : format(value);
}

export default function MetricsPanel({ metrics, loading, error }: Props) {
  return (
    <section className="panel">
      <h2>Runtime Metrics</h2>
      <SectionState loading={loading} error={error} empty={!metrics}>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Service</th>
                <th>CPU</th>
                <th>Memory</th>
                <th>Request Rate</th>
                <th>Error Rate</th>
                <th>Latency (p95)</th>
              </tr>
            </thead>
            <tbody>
              {MONITORED_SERVICES.map((service) => (
                <tr key={service}>
                  <td>{service}</td>
                  <td>{fmt(metrics?.cpu[service], (v) => `${(v * 100).toFixed(1)}%`)}</td>
                  <td>{fmt(metrics?.memory[service], (v) => `${(v / 1024 / 1024).toFixed(1)} MB`)}</td>
                  <td>{fmt(metrics?.requestRate[service], (v) => `${v.toFixed(2)} req/s`)}</td>
                  <td>{fmt(metrics?.errorRate[service], (v) => `${v.toFixed(2)} req/s`)}</td>
                  <td>{fmt(metrics?.latencyP95[service], (v) => `${(v * 1000).toFixed(0)} ms`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionState>
    </section>
  );
}
