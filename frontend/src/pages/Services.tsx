import { Link, useLocation } from "react-router-dom";
import {
  getCpuUsage,
  getErrorRate,
  getLatencyP95,
  getMemoryUsage,
  getRequestRate,
  getServiceHealth,
  MONITORED_SERVICES,
} from "../services/api";
import { useFetchState } from "../hooks/useFetchState";
import { usePolling } from "../hooks/usePolling";
import { deriveServiceStatus } from "../lib/status";
import StatusBadge from "../components/StatusBadge";
import SectionState from "../components/SectionState";
import type { RuntimeMetrics } from "../components/MetricsPanel";
import type { ServiceHealthMap } from "../types";

const POLL_INTERVAL_MS = 7000;

function fmtMs(v: number | undefined): string {
  return v === undefined ? "—" : `${(v * 1000).toFixed(0)} ms`;
}
function fmtRate(v: number | undefined): string {
  return v === undefined ? "—" : `${v.toFixed(2)} req/s`;
}
function fmtPercent(v: number | undefined): string {
  return v === undefined ? "—" : `${(v * 100).toFixed(1)}%`;
}

export default function Services() {
  const location = useLocation();
  const health = useFetchState<ServiceHealthMap>();
  const metrics = useFetchState<RuntimeMetrics>();

  usePolling(() => {
    health.run(getServiceHealth());
    metrics.run(
      Promise.all([getCpuUsage(), getMemoryUsage(), getRequestRate(), getErrorRate(), getLatencyP95()]).then(
        ([cpu, memory, requestRate, errorRate, latencyP95]) => ({ cpu, memory, requestRate, errorRate, latencyP95 })
      )
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, POLL_INTERVAL_MS);

  return (
    <div className="page">
      <div className="page-header">
        <h1>Services</h1>
        <p>Click a service to inspect its dependencies, metrics, and recent activity.</p>
      </div>
      <SectionState loading={health.loading} error={health.error} empty={!health.data}>
        <div className="services-grid">
          {MONITORED_SERVICES.map((service) => {
            const status = deriveServiceStatus(health.data?.[service], metrics.data?.errorRate[service]);
            return (
              <Link key={service} to={`/services/${service}`} state={{ backgroundLocation: location }} className="service-card">
                <div className="service-card-top">
                  <span className="service-card-name">{service}</span>
                  <StatusBadge status={status} />
                </div>
                <div className="service-card-stats">
                  <div>
                    <span className="stat-label">CPU</span>
                    <span>{fmtPercent(metrics.data?.cpu[service])}</span>
                  </div>
                  <div>
                    <span className="stat-label">Req rate</span>
                    <span>{fmtRate(metrics.data?.requestRate[service])}</span>
                  </div>
                  <div>
                    <span className="stat-label">Error rate</span>
                    <span>{fmtRate(metrics.data?.errorRate[service])}</span>
                  </div>
                  <div>
                    <span className="stat-label">p95</span>
                    <span>{fmtMs(metrics.data?.latencyP95[service])}</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </SectionState>
    </div>
  );
}
