import { useState } from "react";
import type { ServiceHealthMap } from "../types";
import { MONITORED_SERVICES } from "../services/api";
import type { RuntimeMetrics } from "./MetricsPanel";
import { deriveServiceStatus } from "../lib/status";
import SectionState from "./SectionState";
import StatusBadge from "./StatusBadge";

interface Props {
  health: ServiceHealthMap | null;
  metrics: RuntimeMetrics | null;
  loading: boolean;
  error: string | null;
}

function fmtMs(v: number | undefined): string {
  return v === undefined ? "—" : `${(v * 1000).toFixed(0)} ms`;
}

function fmtRate(v: number | undefined): string {
  return v === undefined ? "—" : `${v.toFixed(2)} req/s`;
}

function fmtPercent(v: number | undefined): string {
  return v === undefined ? "—" : `${(v * 100).toFixed(1)}%`;
}

function fmtMb(v: number | undefined): string {
  return v === undefined ? "—" : `${(v / 1024 / 1024).toFixed(1)} MB`;
}

export default function ServiceHealthPanel({ health, metrics, loading, error }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <section className="panel">
      <h2 className="section-title">Service Health</h2>
      <SectionState loading={loading} error={error} empty={!health}>
        <div className="health-grid">
          {MONITORED_SERVICES.map((service) => {
            const status = deriveServiceStatus(health?.[service], metrics?.errorRate[service]);
            const isOpen = expanded === service;
            return (
              <button
                key={service}
                type="button"
                className="health-card"
                onClick={() => setExpanded(isOpen ? null : service)}
                aria-expanded={isOpen}
              >
                <div className="health-card-top">
                  <span className="health-name">{service}</span>
                  <StatusBadge status={status} />
                </div>
                <div className="health-detail">
                  <span>p95 latency: {fmtMs(metrics?.latencyP95[service])}</span>
                  <span>request rate: {fmtRate(metrics?.requestRate[service])}</span>
                </div>
                {isOpen && (
                  <dl className="health-expanded">
                    <dt>CPU</dt>
                    <dd>{fmtPercent(metrics?.cpu[service])}</dd>
                    <dt>Memory</dt>
                    <dd>{fmtMb(metrics?.memory[service])}</dd>
                    <dt>Error rate</dt>
                    <dd>{fmtRate(metrics?.errorRate[service])}</dd>
                    <dt>p95 latency</dt>
                    <dd>{fmtMs(metrics?.latencyP95[service])}</dd>
                  </dl>
                )}
              </button>
            );
          })}
        </div>
      </SectionState>
    </section>
  );
}
