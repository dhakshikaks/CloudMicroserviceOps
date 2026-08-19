import { useEffect, useState } from "react";
import { getCurrentUser } from "../services/auth";
import { getServiceHealth, MONITORED_SERVICES } from "../services/api";
import { useFetchState } from "../hooks/useFetchState";
import { usePolling } from "../hooks/usePolling";
import StatusBadge from "../components/StatusBadge";
import SectionState from "../components/SectionState";
import MetricExplainer from "../components/MetricExplainer";
import type { ServiceHealthMap } from "../types";

const POLL_INTERVAL_MS = 7000;

export default function SystemHealth() {
  const health = useFetchState<ServiceHealthMap>();
  usePolling(() => health.run(getServiceHealth()), POLL_INTERVAL_MS);

  const [prometheusReachable, setPrometheusReachable] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    function checkPrometheus() {
      const prometheusUrl = import.meta.env.VITE_PROMETHEUS_URL ?? "/prometheus";
      fetch(`${prometheusUrl}/api/v1/query?query=up`)
        .then((res) => {
          if (!cancelled) setPrometheusReachable(res.ok);
        })
        .catch(() => {
          if (!cancelled) setPrometheusReachable(false);
        });
    }
    checkPrometheus();
    const id = setInterval(checkPrometheus, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const user = getCurrentUser();

  return (
    <div className="page">
      <div className="page-header">
        <h1>System Health</h1>
      </div>

      <section className="panel">
        <h2 className="section-title">Service status</h2>
        <SectionState loading={health.loading} error={health.error} empty={!health.data} dataSource="Prometheus">
          <div className="health-status-board">
            {MONITORED_SERVICES.map((service) => {
              const up = health.data?.[service];
              const status = up === undefined ? "UNKNOWN" : up ? "UP" : "DOWN";
              return (
                <div className="health-status-row" key={service}>
                  <span>{service}</span>
                  <StatusBadge status={status} />
                </div>
              );
            })}
          </div>
          <MetricExplainer
            text="Each service reports UP when Prometheus last scraped it successfully; DOWN means the most recent scrape failed or returned no target."
            source="Prometheus"
            windowLabel="live"
          />
        </SectionState>
      </section>

      <section className="panel">
        <h2 className="section-title">Observability backend</h2>
        <div className="health-status-row">
          <span>Prometheus (/prometheus)</span>
          <StatusBadge status={prometheusReachable === null ? "UNKNOWN" : prometheusReachable ? "UP" : "DOWN"} />
        </div>
        {prometheusReachable === false && <p className="section-subtitle">Charts and metrics elsewhere will be unavailable.</p>}
      </section>

      <section className="panel">
        <h2 className="section-title">Session</h2>
        {user ? (
          <div className="health-status-row">
            <span>{user.username}</span>
            <span className="cell-muted">{user.role}</span>
          </div>
        ) : (
          <p className="state-message">Not signed in.</p>
        )}
      </section>
    </div>
  );
}
