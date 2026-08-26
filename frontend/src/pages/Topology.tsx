import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  getDependencyGraph,
  getMetricsSnapshot,
  getRecentEvents,
  getRootCauses,
  getServiceHealth,
  LIVE_WINDOW_MINUTES,
  MONITORED_SERVICES,
} from "../services/api";
import { useFetchState } from "../hooks/useFetchState";
import { usePolling } from "../hooks/usePolling";
import { deriveServiceStatus } from "../lib/status";
import DependencyGraphPanel from "../components/DependencyGraphPanel";
import MonoRing from "../components/charts/MonoRing";
import SectionState from "../components/SectionState";
import type { DependencyEdge, DependencyGraphResponse, RootCauseCandidate, ServiceEventRecord, ServiceHealthMap, ServiceStatus } from "../types";
import type { RuntimeMetrics } from "../components/MetricsPanel";

const POLL_INTERVAL_MS = 15000;
const INCIDENTS_POLL_MS = 10000;

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

const STATUS_SYMBOL: Record<ServiceStatus, string> = {
  UP: "●",
  DEGRADED: "○",
  DOWN: "×",
  UNKNOWN: "—",
};
const STATUS_TEXT: Record<ServiceStatus, string> = {
  UP: "UP",
  DEGRADED: "DEGRADED",
  DOWN: "DOWN",
  UNKNOWN: "NO DATA",
};

function isRecent(timestamp: string, windowMinutes: number): boolean {
  return Date.now() - new Date(timestamp).getTime() <= windowMinutes * 60_000;
}

export default function Topology() {
  const health = useFetchState<ServiceHealthMap>();
  const graph = useFetchState<DependencyGraphResponse>();
  const metrics = useFetchState<RuntimeMetrics>();
  const rootCauses = useFetchState<RootCauseCandidate[]>();
  const events = useFetchState<ServiceEventRecord[]>();

  usePolling(() => {
    health.run(getServiceHealth());
    graph.run(getDependencyGraph());
    metrics.run(getMetricsSnapshot());
    events.run(getRecentEvents());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, POLL_INTERVAL_MS);

  usePolling(() => {
    rootCauses.run(getRootCauses(LIVE_WINDOW_MINUTES));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, INCIDENTS_POLL_MS);

  const [serviceFilter, setServiceFilter] = useState<string>("all");
  const [dependencyFilter, setDependencyFilter] = useState<"all" | "healthy" | "degraded">("all");

  // Node universe: every monitored service, not just ones that happen to
  // have a traced edge - so a service with real telemetry but no observed
  // dependency (e.g. "backend") still shows up rather than vanishing.
  const allNodeIds = useMemo(() => {
    const fromGraph = graph.data?.nodes.map((n) => n.id) ?? [];
    return Array.from(new Set([...MONITORED_SERVICES, ...fromGraph]));
  }, [graph.data]);

  const rawEdges = graph.data?.edges ?? [];

  const displayedNodeIds = serviceFilter === "all" ? allNodeIds : [serviceFilter];

  const displayedEdges = useMemo(() => {
    return rawEdges.filter((e) => {
      if (serviceFilter !== "all" && e.sourceService !== serviceFilter && e.targetService !== serviceFilter) return false;
      if (dependencyFilter === "healthy" && e.failedCalls > 0) return false;
      if (dependencyFilter === "degraded" && e.failedCalls === 0) return false;
      return true;
    });
  }, [rawEdges, serviceFilter, dependencyFilter]);

  const filteredGraph: DependencyGraphResponse | null = graph.data
    ? { nodes: displayedNodeIds.map((id) => ({ id })), edges: displayedEdges }
    : null;

  // ---- KPI row (always the full, unfiltered infrastructure truth) ----
  const upCount = health.data ? MONITORED_SERVICES.filter((s) => health.data![s]).length : null;
  const availabilityPct = upCount === null ? null : (upCount / MONITORED_SERVICES.length) * 100;
  const totalTraffic = metrics.data
    ? MONITORED_SERVICES.reduce((sum, s) => sum + (metrics.data!.requestRate[s] ?? 0), 0)
    : null;
  const p95Values = metrics.data ? MONITORED_SERVICES.map((s) => metrics.data!.latencyP95[s]).filter((v): v is number => v !== undefined) : [];
  const overallP95 = p95Values.length > 0 ? p95Values.reduce((a, b) => a + b, 0) / p95Values.length : null;

  // ---- Dependency summary (real edge outcomes only - never fabricated) ----
  const healthyEdges = rawEdges.filter((e) => e.failedCalls === 0);
  const downEdges = rawEdges.filter((e) => e.failedCalls > 0 && e.failedCalls === e.totalCalls);
  const degradedEdges = rawEdges.filter((e) => e.failedCalls > 0 && e.failedCalls < e.totalCalls);
  const servicesWithNoDependencyData = MONITORED_SERVICES.filter((s) => !(graph.data?.nodes.some((n) => n.id === s) ?? false));

  // ---- Traffic distribution: attribute a target's aggregate rate/p95 to an
  // edge only when that target has exactly one real inbound edge (otherwise
  // the aggregate can't be honestly split between callers - show "—"). Error
  // rate is always edge-native (failedCalls/totalCalls), never proxied. ----
  const inboundCountByTarget = new Map<string, number>();
  rawEdges.forEach((e) => inboundCountByTarget.set(e.targetService, (inboundCountByTarget.get(e.targetService) ?? 0) + 1));
  const totalDisplayedCalls = displayedEdges.reduce((s, e) => s + e.totalCalls, 0);

  function edgeAttribution(edge: DependencyEdge) {
    const unambiguous = (inboundCountByTarget.get(edge.targetService) ?? 0) === 1;
    return {
      reqRate: unambiguous ? metrics.data?.requestRate[edge.targetService] : undefined,
      p95: unambiguous ? metrics.data?.latencyP95[edge.targetService] : undefined,
      errPct: edge.totalCalls > 0 ? (edge.failedCalls / edge.totalCalls) * 100 : 0,
      pctOfTraffic: totalDisplayedCalls > 0 ? (edge.totalCalls / totalDisplayedCalls) * 100 : 0,
    };
  }

  // ---- Recent incidents / failures (last LIVE_WINDOW_MINUTES only) ----
  const recentFailures = (events.data ?? []).filter((e) => e.status !== "SUCCESS" && isRecent(e.timestamp, LIVE_WINDOW_MINUTES));
  const hasActiveIncidents = (rootCauses.data?.length ?? 0) > 0 || recentFailures.length > 0;

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header-top">
          <h1>Topology</h1>
          <div className="topology-controls-row events-filters">
            <label>
              Service
              <select value={serviceFilter} onChange={(e) => setServiceFilter(e.target.value)}>
                <option value="all">All services</option>
                {MONITORED_SERVICES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Dependency
              <select value={dependencyFilter} onChange={(e) => setDependencyFilter(e.target.value as typeof dependencyFilter)}>
                <option value="all">All dependencies</option>
                <option value="healthy">Healthy only</option>
                <option value="degraded">Degraded / failing only</option>
              </select>
            </label>
          </div>
        </div>
      </div>

      <div className="summary-row">
        <div className="summary-item">
          <span className="summary-label">Services</span>
          <span className="summary-value mono">{MONITORED_SERVICES.length}</span>
          <span className="summary-detail">all monitored</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Dependencies</span>
          <span className="summary-value mono">{graph.data ? rawEdges.length : "—"}</span>
          <span className="summary-detail">live connections, all-time</span>
        </div>
        <div className={`summary-item${(rootCauses.data?.length ?? 0) > 0 ? " tone-critical" : ""}`}>
          <span className="summary-label">Incidents</span>
          <span className={`summary-value mono${(rootCauses.data?.length ?? 0) > 0 ? " tone-critical" : ""}`}>
            {rootCauses.data ? rootCauses.data.length : "—"}
          </span>
          <span className="summary-detail">last {LIVE_WINDOW_MINUTES} min</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Availability</span>
          <span className="summary-value mono">{availabilityPct === null ? "—" : `${availabilityPct.toFixed(1)}%`}</span>
          <span className="summary-detail">instantaneous, all services</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Total Traffic</span>
          <span className="summary-value mono">{totalTraffic === null ? "—" : `${totalTraffic.toFixed(2)} req/s`}</span>
          <span className="summary-detail">across all services</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">P95 Latency</span>
          <span className="summary-value mono">{overallP95 === null ? "—" : `${(overallP95 * 1000).toFixed(0)} ms`}</span>
          <span className="summary-detail">average, overall</span>
        </div>
      </div>

      <DependencyGraphPanel
        graph={filteredGraph}
        loading={graph.loading}
        error={graph.error}
        metrics={metrics.data}
        health={health.data}
        minCanvasHeight={520}
        maxCanvasHeight={820}
      />

      <div className="grid-2up">
        <section className="panel">
          <h2 className="section-title">Dependency Summary</h2>
          <SectionState loading={graph.loading} error={graph.error} empty={!graph.data}>
            <div className="mono-ring-card-body" style={{ marginTop: "0.6rem" }}>
              <MonoRing
                size={132}
                strokeWidth={14}
                centerLabel={String(rawEdges.length)}
                centerSublabel="total"
                segments={[
                  { label: "Healthy", value: healthyEdges.length, pattern: "solid" },
                  { label: "Degraded", value: degradedEdges.length, pattern: "dashed" },
                  { label: "Down", value: downEdges.length, pattern: "dotted" },
                ]}
              />
              <div className="mono-ring-legend">
                <div className="mono-ring-legend-item">
                  <span className="mono-ring-swatch solid" />
                  Healthy
                  <span className="mono-ring-legend-count">{healthyEdges.length}</span>
                </div>
                <div className="mono-ring-legend-item">
                  <span className="mono-ring-swatch dashed" />
                  Degraded
                  <span className="mono-ring-legend-count">{degradedEdges.length}</span>
                </div>
                <div className="mono-ring-legend-item">
                  <span className="mono-ring-swatch dotted" />
                  Down (100% failing)
                  <span className="mono-ring-legend-count">{downEdges.length}</span>
                </div>
              </div>
            </div>
            {servicesWithNoDependencyData.length > 0 && (
              <p className="cell-muted" style={{ marginTop: "0.9rem" }}>
                No data: {servicesWithNoDependencyData.join(", ")} — no dependency calls observed yet.
              </p>
            )}
          </SectionState>
        </section>

        <section className="panel">
          <h2 className="section-title">Traffic Distribution</h2>
          <SectionState loading={graph.loading} error={graph.error} empty={displayedEdges.length === 0} emptyMessage="No dependencies match the current filters.">
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Source → Destination</th>
                    <th>Req Rate</th>
                    <th>% of Traffic</th>
                    <th>P95</th>
                    <th>Error Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedEdges
                    .slice()
                    .sort((a, b) => b.totalCalls - a.totalCalls)
                    .map((edge) => {
                      const attr = edgeAttribution(edge);
                      return (
                        <tr key={`${edge.sourceService}-${edge.targetService}`}>
                          <td className="mono">
                            {edge.sourceService} → {edge.targetService}
                          </td>
                          <td>{fmtRate(attr.reqRate)}</td>
                          <td>{attr.pctOfTraffic.toFixed(0)}%</td>
                          <td>{fmtMs(attr.p95)}</td>
                          <td className={attr.errPct > 0 ? "cell-elevated" : undefined}>{attr.errPct.toFixed(1)}%</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </SectionState>
        </section>

        <section className="panel">
          <h2 className="section-title">Service Health</h2>
          <SectionState loading={health.loading || metrics.loading} error={health.error ?? metrics.error} empty={!health.data && !metrics.data}>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Service</th>
                    <th>Status</th>
                    <th>Req/s</th>
                    <th>P95</th>
                    <th>CPU</th>
                    <th>Memory</th>
                    <th>Error Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {(serviceFilter === "all" ? MONITORED_SERVICES : [serviceFilter]).map((service) => {
                    const status = deriveServiceStatus(health.data?.[service], metrics.data?.errorRate[service]);
                    const err = metrics.data?.errorRate[service];
                    return (
                      <tr key={service}>
                        <td className="mono">{service}</td>
                        <td className="mono">
                          {STATUS_SYMBOL[status]} {STATUS_TEXT[status]}
                        </td>
                        <td>{fmtRate(metrics.data?.requestRate[service])}</td>
                        <td>{fmtMs(metrics.data?.latencyP95[service])}</td>
                        <td>{fmtPercent(metrics.data?.cpu[service])}</td>
                        <td>{fmtMb(metrics.data?.memory[service])}</td>
                        <td className={err && err > 0 ? "cell-elevated" : undefined}>{fmtRate(err)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </SectionState>
        </section>

        <section className="panel">
          <div className="panel-header-row">
            <h2 className="section-title">Incident / Event Summary</h2>
            <Link to="/incidents" className="panel-header-link">
              Full &rarr;
            </Link>
          </div>
          {!hasActiveIncidents ? (
            <div className="rca-clean-state tone-good" style={{ marginTop: "0.6rem" }}>
              <div className="rca-state-label tone-good">NO ACTIVE INCIDENTS</div>
              <p className="rca-highlight-reason">No root-cause candidates or failures in the last {LIVE_WINDOW_MINUTES} min.</p>
            </div>
          ) : (
            <div style={{ marginTop: "0.6rem" }}>
              {(rootCauses.data ?? []).map((c) => (
                <div className="topology-incident-row" key={c.service}>
                  <div>
                    <span className="topology-incident-service">{c.service}</span>
                    <div className="cell-muted">{c.reason}</div>
                  </div>
                  <div className="topology-incident-meta">
                    <span>confidence {c.score.toFixed(2)}</span>
                  </div>
                </div>
              ))}
              {recentFailures.slice(0, 5).map((e) => (
                <div className="topology-incident-row" key={e.eventId}>
                  <div>
                    <span className="topology-incident-service">
                      {e.sourceService} → {e.targetService}
                    </span>
                    <div className="cell-muted">{e.operation} · {e.status}</div>
                  </div>
                  <div className="topology-incident-meta">
                    <span>{new Date(e.timestamp).toLocaleTimeString()}</span>
                    <span>{e.durationMs} ms</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
