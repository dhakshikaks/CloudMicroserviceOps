import { useEffect, useMemo, useState } from "react";
import {
  getDependencyGraph,
  getIncidentReport,
  getMetricsSnapshot,
  getNotifications,
  getPrometheusReachable,
  getRecentEvents,
  getRootCauses,
  getServiceHealth,
  LIVE_WINDOW_MINUTES,
  MONITORED_SERVICES,
} from "../services/api";
import { useFetchState } from "../hooks/useFetchState";
import { usePolling } from "../hooks/usePolling";
import { useIncidentState } from "../hooks/useIncidentState";
import { computeFailureRuns, fmtDurationMs, meanResolutionMs } from "../lib/incidentAnalysis";
import SectionState from "../components/SectionState";
import RecentEventsPanel from "../components/RecentEventsPanel";
import IncidentTimeline from "../components/IncidentTimeline";
import MonoRing from "../components/charts/MonoRing";
import type { DependencyGraphResponse, IncidentReport, NotificationRecord, RootCauseCandidate, ServiceEventRecord, ServiceHealthMap } from "../types";
import type { RuntimeMetrics } from "../components/MetricsPanel";

const POLL_INTERVAL_MS = 7000;
const EXPLORE_WINDOWS = [5, 15, 30, 60, 180, 360];
const TIMELINE_WINDOWS = [
  { label: "15m", minutes: 15 },
  { label: "1h", minutes: 60 },
  { label: "6h", minutes: 360 },
  { label: "24h", minutes: 1440 },
];
const NOTIFICATIONS_WINDOW_MINUTES = 1440; // fetch a day's worth; the timeline/table filter down client-side

function fmtRate(v: number | undefined): string {
  return v === undefined ? "—" : `${v.toFixed(2)} req/s`;
}
function fmtMs(v: number | undefined): string {
  return v === undefined ? "—" : `${(v * 1000).toFixed(0)} ms`;
}
function sum(values: Record<string, number> | undefined): number | undefined {
  if (!values) return undefined;
  const nums = MONITORED_SERVICES.map((s) => values[s]).filter((v): v is number => v !== undefined);
  if (nums.length === 0) return undefined;
  return nums.reduce((a, b) => a + b, 0);
}
function avg(values: Record<string, number> | undefined): number | undefined {
  if (!values) return undefined;
  const nums = MONITORED_SERVICES.map((s) => values[s]).filter((v): v is number => v !== undefined);
  if (nums.length === 0) return undefined;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/** Renders the same rca-list markup for both "Other candidates" and the window explorer. */
function CandidateList({ candidates }: { candidates: RootCauseCandidate[] }) {
  return (
    <ol className="rca-list">
      {candidates.map((c) => (
        <li key={c.service}>
          <div className="rca-headline">
            <span className="rca-rank">{c.rank}.</span>
            <span className="rca-service">{c.service}</span>
            <span className="rca-score">{c.score.toFixed(2)}</span>
          </div>
          <div className="rca-reason">{c.reason}</div>
        </li>
      ))}
    </ol>
  );
}

export default function Incidents() {
  const health = useFetchState<ServiceHealthMap>();
  const graph = useFetchState<DependencyGraphResponse>();
  const rootCauses = useFetchState<RootCauseCandidate[]>();
  const metrics = useFetchState<RuntimeMetrics>();
  const report = useFetchState<IncidentReport | null>();
  const notifications = useFetchState<NotificationRecord[]>();
  const events = useFetchState<ServiceEventRecord[]>();
  const prometheusUp = useFetchState<boolean>();
  const [lastRefresh, setLastRefresh] = useState<number | null>(null);

  usePolling(() => {
    health.run(getServiceHealth());
    graph.run(getDependencyGraph());
    rootCauses.run(getRootCauses());
    metrics.run(getMetricsSnapshot());
    report.run(getIncidentReport());
    notifications.run(getNotifications(NOTIFICATIONS_WINDOW_MINUTES));
    events.run(getRecentEvents());
    prometheusUp.run(getPrometheusReachable());
    setLastRefresh(Date.now());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, POLL_INTERVAL_MS);

  const incident = useIncidentState(rootCauses.data);

  const [exploreWindow, setExploreWindow] = useState(LIVE_WINDOW_MINUTES);
  const exploreReport = useFetchState<IncidentReport | null>();
  useEffect(() => {
    exploreReport.run(getIncidentReport(exploreWindow));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exploreWindow]);

  const [timelineMinutes, setTimelineMinutes] = useState(60);

  const data = report.data;
  const detectionEvent = data ? data.timeline.find((e) => e.eventId === data.incidentId) : undefined;
  const detectionTime = detectionEvent ? new Date(detectionEvent.timestamp) : null;
  const durationMinutes = detectionTime ? Math.max(0, Math.round((Date.now() - detectionTime.getTime()) / 60000)) : null;
  const lastEventTime = data && data.timeline.length > 0 ? new Date(data.timeline[data.timeline.length - 1].timestamp) : null;

  const errorRateForTop = data ? metrics.data?.errorRate[data.rootCauseService] : undefined;
  const latencyForTop = data ? metrics.data?.latencyP95[data.rootCauseService] : undefined;
  const evidenceItems: string[] = data
    ? [
        `${data.failureCount} failure event${data.failureCount === 1 ? "" : "s"} observed targeting ${data.rootCauseService} in the last ${LIVE_WINDOW_MINUTES} minutes.`,
        data.affectedDownstreamServices.length > 0
          ? `${data.affectedDownstreamServices.length} downstream service${data.affectedDownstreamServices.length === 1 ? "" : "s"} affected: ${data.affectedDownstreamServices.join(", ")}.`
          : "No downstream services currently show propagated failures.",
        `Root-cause scorer reasoning: ${data.reason}`,
        errorRateForTop !== undefined ? `Current error rate for ${data.rootCauseService}: ${fmtRate(errorRateForTop)}.` : null,
        latencyForTop !== undefined ? `Current P95 latency for ${data.rootCauseService}: ${fmtMs(latencyForTop)}.` : null,
      ].filter((x): x is string => x !== null)
    : [];

  const affectedServices = new Set<string>(data ? [data.rootCauseService, ...data.affectedDownstreamServices] : []);

  const exploreCandidates: RootCauseCandidate[] = exploreReport.data
    ? [
        {
          service: exploreReport.data.rootCauseService,
          score: exploreReport.data.confidence,
          rank: 1,
          affectedDownstreamServices: exploreReport.data.affectedDownstreamServices,
          reason: exploreReport.data.reason,
        },
        ...exploreReport.data.otherCandidates,
      ]
    : [];

  // ---- Derived, real, non-fabricated analytics from the raw event stream ----
  const runs = useMemo(() => computeFailureRuns(events.data ?? []), [events.data]);
  const mttr = meanResolutionMs(runs);
  const resolvedRuns = runs.filter((r) => r.resolvedAt !== null);
  const openRuns = runs.filter((r) => r.resolvedAt === null);

  const runsByTarget = useMemo(() => {
    const map = new Map<string, typeof runs>();
    for (const r of runs) {
      if (!map.has(r.targetService)) map.set(r.targetService, []);
      map.get(r.targetService)!.push(r);
    }
    return map;
  }, [runs]);

  const incomingEdgeCountByService = new Map<string, number>();
  (graph.data?.edges ?? []).forEach((e) => incomingEdgeCountByService.set(e.targetService, (incomingEdgeCountByService.get(e.targetService) ?? 0) + 1));

  // ---- KPI row ----
  const upCount = health.data ? MONITORED_SERVICES.filter((s) => health.data![s]).length : null;
  const activeIncidents = rootCauses.data ? rootCauses.data.length : null;
  const affectedServiceCount = data ? data.affectedDownstreamServices.length + 1 : 0;

  // ---- Severity distribution (real notification + derived-run counts) ----
  const criticalCount = notifications.data?.filter((n) => n.severity === "CRITICAL").length ?? 0;
  const warningCount = notifications.data?.filter((n) => n.severity === "WARNING").length ?? 0;
  const infoCount = notifications.data?.filter((n) => n.severity === "INFO").length ?? 0;
  const resolvedCount = resolvedRuns.length;

  // ---- Incident table rows: live notifications + historical resolved runs ----
  interface IncidentRow {
    key: string;
    time: string;
    severity: "CRITICAL" | "WARNING" | "RESOLVED";
    service: string;
    title: string;
    status: string;
    durationLabel: string;
    impact: number;
  }
  const incidentRows: IncidentRow[] = [
    ...(notifications.data ?? []).map((n) => ({
      key: n.id,
      time: n.timestamp,
      severity: n.severity === "CRITICAL" ? ("CRITICAL" as const) : ("WARNING" as const),
      service: n.service,
      title: n.message,
      status: n.type === "INCIDENT_DETECTED" ? "ACTIVE" : "OBSERVED",
      durationLabel: "—",
      impact: incomingEdgeCountByService.get(n.service) ?? 0,
    })),
    ...resolvedRuns.slice(0, 20).map((r) => ({
      key: `${r.sourceService}-${r.targetService}-${r.startedAt}`,
      time: r.startedAt,
      severity: "RESOLVED" as const,
      service: r.targetService,
      title: `${r.sourceService} → ${r.targetService} failed then recovered (${r.events.length} failed call${r.events.length === 1 ? "" : "s"})`,
      status: "RESOLVED",
      durationLabel: fmtDurationMs(new Date(r.resolvedAt!).getTime() - new Date(r.startedAt).getTime()),
      impact: incomingEdgeCountByService.get(r.targetService) ?? 0,
    })),
  ]
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    .slice(0, 25);

  // ---- Top affected services ----
  const topAffectedRows = MONITORED_SERVICES.map((s) => ({
    service: s,
    incidents: (runsByTarget.get(s) ?? []).length,
    errorRate: metrics.data?.errorRate[s],
    p95: metrics.data?.latencyP95[s],
    impact: incomingEdgeCountByService.get(s) ?? 0,
    up: health.data?.[s],
  })).sort((a, b) => b.incidents - a.incidents || (b.errorRate ?? 0) - (a.errorRate ?? 0));

  return (
    <div className="page">
      <div className="page-header">
        <h1>Incident Center</h1>
      </div>

      {/* 1. TOP KPI ROW */}
      <div className="summary-row">
        <div className={`summary-item${activeIncidents ? " tone-critical" : ""}`}>
          <span className="summary-label">Active Incidents</span>
          <span className={`summary-value mono${activeIncidents ? " tone-critical" : ""}`}>{activeIncidents === null ? "—" : activeIncidents}</span>
          <span className="summary-detail">live RCA candidates</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Total Incidents</span>
          <span className="summary-value mono">{events.data ? runs.length : "—"}</span>
          <span className="summary-detail">derived, last {events.data?.length ?? 0} events</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Mean Time to Detect</span>
          <span className="summary-value mono">—</span>
          <span className="summary-detail">not tracked — RCA polls continuously</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Mean Time to Resolve</span>
          <span className="summary-value mono">{fmtDurationMs(mttr)}</span>
          <span className="summary-detail">{resolvedRuns.length} resolved run{resolvedRuns.length === 1 ? "" : "s"}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Affected Services</span>
          <span className="summary-value mono">{affectedServiceCount}</span>
          <span className="summary-detail">current incident</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Error Rate</span>
          <span className="summary-value mono">{fmtRate(sum(metrics.data?.errorRate))}</span>
          <span className="summary-detail">sum, all services</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Request Rate</span>
          <span className="summary-value mono">{fmtRate(sum(metrics.data?.requestRate))}</span>
          <span className="summary-detail">sum, all services</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">P95 Latency</span>
          <span className="summary-value mono">{fmtMs(avg(metrics.data?.latencyP95))}</span>
          <span className="summary-detail">average, overall</span>
        </div>
      </div>

      {/* 2. INCIDENT TIMELINE */}
      <section className="panel">
        <div className="panel-header-row">
          <h2 className="section-title">Incident Timeline</h2>
          <div className="incident-window-tabs">
            {TIMELINE_WINDOWS.map((w) => (
              <button
                key={w.label}
                type="button"
                className={`incident-window-tab${timelineMinutes === w.minutes ? " active" : ""}`}
                onClick={() => setTimelineMinutes(w.minutes)}
              >
                {w.label}
              </button>
            ))}
          </div>
        </div>
        <SectionState loading={events.loading} error={events.error} empty={false}>
          <IncidentTimeline events={events.data ?? []} notifications={notifications.data ?? []} windowMinutes={timelineMinutes} />
        </SectionState>
      </section>

      {/* 3 + 5. SEVERITY DISTRIBUTION + TOP INCIDENT CAUSES */}
      <div className="grid-2up">
        <section className="panel">
          <h2 className="section-title">Incident Severity Distribution</h2>
          <SectionState loading={notifications.loading} error={notifications.error} empty={false}>
            <div className="mono-ring-card-body" style={{ marginTop: "0.6rem" }}>
              <MonoRing
                size={128}
                strokeWidth={14}
                centerLabel={String(criticalCount + warningCount + infoCount + resolvedCount)}
                centerSublabel="signals"
                segments={[
                  { label: "Critical", value: criticalCount, pattern: "solid" },
                  { label: "Warning", value: warningCount, pattern: "dashed" },
                  { label: "Info", value: infoCount, pattern: "dotted" },
                  { label: "Resolved", value: resolvedCount, pattern: "dim" },
                ]}
              />
              <div className="mono-ring-legend">
                <div className="mono-ring-legend-item">
                  <span className="mono-ring-swatch solid" />
                  Critical
                  <span className="mono-ring-legend-count">{criticalCount}</span>
                </div>
                <div className="mono-ring-legend-item">
                  <span className="mono-ring-swatch dashed" />
                  Warning
                  <span className="mono-ring-legend-count">{warningCount}</span>
                </div>
                <div className="mono-ring-legend-item">
                  <span className="mono-ring-swatch dotted" />
                  Info
                  <span className="mono-ring-legend-count">{infoCount}</span>
                </div>
                <div className="mono-ring-legend-item">
                  <span className="mono-ring-swatch dim" />
                  Resolved
                  <span className="mono-ring-legend-count">{resolvedCount}</span>
                </div>
              </div>
            </div>
          </SectionState>
        </section>

        <section className="panel">
          <h2 className="section-title">Top Incident Causes</h2>
          <SectionState loading={rootCauses.loading} error={rootCauses.error} empty={false}>
            {rootCauses.data && rootCauses.data.length > 0 ? (
              <div style={{ marginTop: "0.5rem" }}>
                {rootCauses.data.map((c) => (
                  <div className="incident-cause-item" key={c.service}>
                    <div className="rca-headline">
                      <span className="incident-cause-rank">{c.rank}.</span>
                      <span className="rca-service">{c.service}</span>
                      <span className="rca-score">confidence {c.score.toFixed(2)}</span>
                    </div>
                    <div className="rca-reason">{c.reason}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="structured-empty-state" style={{ marginTop: "0.5rem" }}>
                <div className="structured-empty-state-title">No active root causes</div>
                <p className="structured-empty-state-body">
                  RCA has found no failing service in the last {LIVE_WINDOW_MINUTES} minutes.
                  {openRuns.length > 0
                    ? ` ${openRuns.length} unresolved failure run${openRuns.length === 1 ? "" : "s"} exist outside the live window: ${[
                        ...new Set(openRuns.map((r) => r.targetService)),
                      ].join(", ")}.`
                    : " No unresolved failure runs in the fetched event history either."}
                </p>
              </div>
            )}
          </SectionState>
        </section>
      </div>

      {/* 4. TOP AFFECTED SERVICES */}
      <section className="panel">
        <h2 className="section-title">Top Affected Services</h2>
        <SectionState loading={metrics.loading} error={metrics.error} empty={false}>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Incidents</th>
                  <th>Error Rate</th>
                  <th>P95</th>
                  <th>Impact</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {topAffectedRows.map((row) => (
                  <tr key={row.service}>
                    <td className="mono">{row.service}</td>
                    <td className={row.incidents > 0 ? "cell-elevated" : undefined}>{row.incidents}</td>
                    <td className={row.errorRate && row.errorRate > 0 ? "cell-elevated" : undefined}>{fmtRate(row.errorRate)}</td>
                    <td>{fmtMs(row.p95)}</td>
                    <td className="cell-muted">{row.impact} inbound</td>
                    <td className="mono">{row.up === false ? "× DOWN" : row.up === undefined ? "— NO DATA" : "● UP"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionState>
      </section>

      {/* 6. INCIDENT SUMMARY */}
      <section className="panel">
        <h2 className="section-title">Incident Summary</h2>
        <SectionState loading={report.loading} error={report.error} empty={false}>
          {data ? (
            <div className="context-kv-grid" style={{ marginTop: "0.5rem" }}>
              <div className="context-kv-item">
                <span className="context-kv-label">Started At</span>
                <span className="context-kv-value">{detectionTime ? detectionTime.toLocaleString() : "—"}</span>
              </div>
              <div className="context-kv-item">
                <span className="context-kv-label">Ended At</span>
                <span className="context-kv-value is-muted">— (ongoing)</span>
              </div>
              <div className="context-kv-item">
                <span className="context-kv-label">Duration</span>
                <span className="context-kv-value">{durationMinutes === null ? "—" : `${durationMinutes}m`}</span>
              </div>
              <div className="context-kv-item">
                <span className="context-kv-label">Status</span>
                <span className="context-kv-value">ACTIVE</span>
              </div>
              <div className="context-kv-item">
                <span className="context-kv-label">Affected Services</span>
                <span className="context-kv-value">{affectedServiceCount}</span>
              </div>
              <div className="context-kv-item">
                <span className="context-kv-label">Root Cause</span>
                <span className="context-kv-value">{data.rootCauseService}</span>
              </div>
              <div className="context-kv-item">
                <span className="context-kv-label">First Detected</span>
                <span className="context-kv-value">{detectionTime ? detectionTime.toLocaleTimeString() : "—"}</span>
              </div>
              <div className="context-kv-item">
                <span className="context-kv-label">Last Updated</span>
                <span className="context-kv-value">{lastEventTime ? lastEventTime.toLocaleTimeString() : "—"}</span>
              </div>
            </div>
          ) : incident.status === "recovered" && incident.lastIncident ? (
            <div className="context-kv-grid" style={{ marginTop: "0.5rem" }}>
              <div className="context-kv-item">
                <span className="context-kv-label">Status</span>
                <span className="context-kv-value">RECOVERED</span>
              </div>
              <div className="context-kv-item">
                <span className="context-kv-label">Root Cause</span>
                <span className="context-kv-value">{incident.lastIncident.service}</span>
              </div>
              <div className="context-kv-item">
                <span className="context-kv-label">Recovered At</span>
                <span className="context-kv-value">{incident.recoveredAt ? new Date(incident.recoveredAt).toLocaleTimeString() : "—"}</span>
              </div>
            </div>
          ) : (
            <div className="rca-clean-state tone-good" style={{ marginTop: "0.5rem" }}>
              <div className="rca-state-label tone-good">System healthy</div>
              <p className="rca-highlight-reason">No active incidents ({LIVE_WINDOW_MINUTES}m window).</p>
            </div>
          )}

          {data && (
            <>
              <section className="incident-why" style={{ marginTop: "1.1rem" }}>
                <div className="incident-why-label">Why {data.rootCauseService}?</div>
                <p className="incident-why-body">{data.reason}</p>
                <div className="incident-confidence">
                  <span className="incident-confidence-label">Confidence</span>
                  <span className="incident-confidence-value">{(data.confidence * 100).toFixed(0)}%</span>
                </div>
                <ol className="rca-evidence-list" style={{ marginTop: "0.8rem" }}>
                  {evidenceItems.map((item) => (
                    <li key={item} style={{ color: "var(--text-secondary)", paddingLeft: "1.5rem" }}>
                      {item}
                    </li>
                  ))}
                </ol>
              </section>

              <div className="incident-impact-grid">
                <div className="incident-impact-col">
                  <h4>Affected ({data.affectedDownstreamServices.length})</h4>
                  {data.affectedDownstreamServices.length === 0 ? (
                    <p className="state-message">No confirmed downstream impact.</p>
                  ) : (
                    <ul className="incident-impact-list">
                      {data.affectedDownstreamServices.map((s) => (
                        <li key={s} className="mono">{s}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="incident-impact-col">
                  <h4>Potentially affected ({data.potentiallyAffected.length})</h4>
                  {data.potentiallyAffected.length === 0 ? (
                    <p className="state-message">No further downstream services in the dependency graph.</p>
                  ) : (
                    <ul className="incident-impact-list">
                      {data.potentiallyAffected.map((s) => (
                        <li key={s} className="mono cell-muted">{s}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {data.dependencyPath.length > 1 && (
                <div className="dependency-path">
                  {data.dependencyPath.map((service, i) => (
                    <span key={service} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span className={`dependency-path-node${affectedServices.has(service) ? " is-affected" : ""}`}>{service}</span>
                      {i < data.dependencyPath.length - 1 && <span className="dependency-path-arrow">&rarr;</span>}
                    </span>
                  ))}
                </div>
              )}
            </>
          )}
        </SectionState>
      </section>

      {/* 7. INCIDENT TABLE */}
      <section className="panel">
        <h2 className="section-title">Incident Table</h2>
        <SectionState
          loading={notifications.loading}
          error={notifications.error}
          empty={incidentRows.length === 0}
          emptyMessage="No incidents, warnings, or resolutions recorded yet."
        >
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Severity</th>
                  <th>Service</th>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Duration</th>
                  <th>Impact</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {incidentRows.map((row) => (
                  <tr key={row.key}>
                    <td className="cell-muted">{new Date(row.time).toLocaleString()}</td>
                    <td className="mono">{row.severity === "CRITICAL" ? "● CRITICAL" : row.severity === "WARNING" ? "○ WARNING" : "— RESOLVED"}</td>
                    <td className="mono">{row.service}</td>
                    <td>{row.title}</td>
                    <td>{row.status}</td>
                    <td>{row.durationLabel}</td>
                    <td className="cell-muted">{row.impact} inbound</td>
                    <td>
                      <a href={`/services/${encodeURIComponent(row.service)}`} className="incident-action-btn">
                        Inspect
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionState>
      </section>

      {/* 8. SYSTEM CONTEXT PANEL */}
      <section className="panel">
        <h2 className="section-title">System Context</h2>
        <div className="context-kv-grid" style={{ marginTop: "0.5rem" }}>
          <div className="context-kv-item">
            <span className="context-kv-label">Services Up</span>
            <span className="context-kv-value">{upCount === null ? "—" : `${upCount}/${MONITORED_SERVICES.length}`}</span>
          </div>
          <div className="context-kv-item">
            <span className="context-kv-label">Services Down</span>
            <span className="context-kv-value">{upCount === null ? "—" : MONITORED_SERVICES.length - upCount}</span>
          </div>
          <div className="context-kv-item">
            <span className="context-kv-label">Dependencies</span>
            <span className="context-kv-value">{graph.data ? graph.data.edges.length : "—"}</span>
          </div>
          <div className="context-kv-item">
            <span className="context-kv-label">Requests/sec</span>
            <span className="context-kv-value">{fmtRate(sum(metrics.data?.requestRate))}</span>
          </div>
          <div className="context-kv-item">
            <span className="context-kv-label">Errors/sec</span>
            <span className="context-kv-value">{fmtRate(sum(metrics.data?.errorRate))}</span>
          </div>
          <div className="context-kv-item">
            <span className="context-kv-label">P95 Latency</span>
            <span className="context-kv-value">{fmtMs(avg(metrics.data?.latencyP95))}</span>
          </div>
          <div className="context-kv-item">
            <span className="context-kv-label">Prometheus</span>
            <span className="context-kv-value">{prometheusUp.data === null ? "—" : prometheusUp.data ? "● REACHABLE" : "× UNREACHABLE"}</span>
          </div>
          <div className="context-kv-item">
            <span className="context-kv-label">Last Refresh</span>
            <span className="context-kv-value">{lastRefresh ? new Date(lastRefresh).toLocaleTimeString() : "—"}</span>
          </div>
        </div>
      </section>

      {/* 9. RECENT EVENTS */}
      <RecentEventsPanel events={events.data} loading={events.loading} error={events.error} />

      <section className="panel">
        <h2 className="section-title">Explore a different window</h2>
        <div className="incident-explore-control">
          <label htmlFor="explore-window">Window</label>
          <select id="explore-window" value={exploreWindow} onChange={(e) => setExploreWindow(Number(e.target.value))}>
            {EXPLORE_WINDOWS.map((w) => (
              <option key={w} value={w}>
                {w} min
              </option>
            ))}
          </select>
          {exploreWindow !== LIVE_WINDOW_MINUTES && <span className="incident-explore-badge">Not live default</span>}
        </div>
        {!exploreReport.data && <p className="state-message">No failures in this window.</p>}
        {exploreCandidates.length > 0 && <CandidateList candidates={exploreCandidates} />}
      </section>
    </div>
  );
}
