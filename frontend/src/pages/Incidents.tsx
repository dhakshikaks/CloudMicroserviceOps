import { useEffect, useState } from "react";
import {
  getCpuUsage,
  getDependencyGraph,
  getErrorRate,
  getLatencyP95,
  getMemoryUsage,
  getRecentEvents,
  getRequestRate,
  getRootCauses,
  LIVE_WINDOW_MINUTES,
} from "../services/api";
import { useFetchState } from "../hooks/useFetchState";
import { usePolling } from "../hooks/usePolling";
import { useIncidentState } from "../hooks/useIncidentState";
import StatusBadge from "../components/StatusBadge";
import SectionState from "../components/SectionState";
import type { DependencyEdge, DependencyGraphResponse, RootCauseCandidate, ServiceEventRecord } from "../types";
import type { RuntimeMetrics } from "../components/MetricsPanel";

const POLL_INTERVAL_MS = 7000;
const EXPLORE_WINDOWS = [5, 15, 30, 60, 180, 360];

/** Real upstream/downstream traversal through the observed graph, from the root-cause service outward. */
function buildDependencyPath(root: string, edges: DependencyEdge[]): string[] {
  const path: string[] = [root];
  const visited = new Set([root]);

  let current = root;
  while (true) {
    const incoming = edges.find((e) => e.targetService === current && !visited.has(e.sourceService));
    if (!incoming) break;
    path.unshift(incoming.sourceService);
    visited.add(incoming.sourceService);
    current = incoming.sourceService;
  }

  current = root;
  while (true) {
    const outgoing = edges.find((e) => e.sourceService === current && !visited.has(e.targetService));
    if (!outgoing) break;
    path.push(outgoing.targetService);
    visited.add(outgoing.targetService);
    current = outgoing.targetService;
  }

  return path;
}

function fmtRate(v: number | undefined): string {
  return v === undefined ? "—" : `${v.toFixed(2)} req/s`;
}
function fmtMs(v: number | undefined): string {
  return v === undefined ? "—" : `${(v * 1000).toFixed(0)} ms`;
}

export default function Incidents() {
  const rootCauses = useFetchState<RootCauseCandidate[]>();
  const graph = useFetchState<DependencyGraphResponse>();
  const events = useFetchState<ServiceEventRecord[]>();
  const metrics = useFetchState<RuntimeMetrics>();

  usePolling(() => {
    rootCauses.run(getRootCauses()); // pinned default (LIVE_WINDOW_MINUTES) - drives the banner
    graph.run(getDependencyGraph());
    events.run(getRecentEvents());
    metrics.run(
      Promise.all([getCpuUsage(), getMemoryUsage(), getRequestRate(), getErrorRate(), getLatencyP95()]).then(
        ([cpu, memory, requestRate, errorRate, latencyP95]) => ({ cpu, memory, requestRate, errorRate, latencyP95 })
      )
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, POLL_INTERVAL_MS);

  const incident = useIncidentState(rootCauses.data);

  // Exploratory window: separate state, separate call, never feeds the banner above.
  const [exploreWindow, setExploreWindow] = useState(LIVE_WINDOW_MINUTES);
  const exploreRootCauses = useFetchState<RootCauseCandidate[]>();
  useEffect(() => {
    exploreRootCauses.run(getRootCauses(exploreWindow));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exploreWindow]);

  const top = rootCauses.data && rootCauses.data.length > 0 ? rootCauses.data[0] : null;
  const affectedServices = new Set<string>();
  if (top) {
    affectedServices.add(top.service);
    top.affectedDownstreamServices.forEach((s) => affectedServices.add(s));
  }
  const timeline = (events.data ?? [])
    .filter((e) => affectedServices.has(e.sourceService) || affectedServices.has(e.targetService))
    .filter((e) => Date.now() - new Date(e.timestamp).getTime() <= LIVE_WINDOW_MINUTES * 60_000)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const path = top && graph.data ? buildDependencyPath(top.service, graph.data.edges) : [];

  // A real, traceable identifier - the eventId of the earliest FAILURE event
  // targeting the root-cause service in this window - not a fabricated
  // sequence number.
  const triggeringEvent = top
    ? [...timeline]
        .filter((e) => e.status === "FAILURE" && e.targetService === top.service)
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())[0]
    : undefined;
  const incidentId = triggeringEvent?.eventId.slice(0, 8).toUpperCase();
  const failureCount = timeline.filter((e) => e.status === "FAILURE").length;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Incident Center</h1>
      </div>

      <SectionState loading={rootCauses.loading} error={rootCauses.error} empty={false}>
        {!top && incident.status === "healthy" && (
          <div className="rca-clean-state tone-good">
            <div className="rca-state-label tone-good">System healthy</div>
            <p className="rca-highlight-reason">No active incidents ({LIVE_WINDOW_MINUTES}m window).</p>
          </div>
        )}

        {!top && incident.status === "recovered" && incident.lastIncident && (
          <div className="rca-clean-state tone-warning">
            <div className="rca-state-label tone-warning">System recovered</div>
            <p className="rca-highlight-reason">
              {incident.lastIncident.service} no longer active. No failures in the last {LIVE_WINDOW_MINUTES}m.
            </p>
          </div>
        )}

        {top && (
          <>
            <div className="incident-header">
              <span className="incident-header-label">Incident</span>
              {incidentId && <span className="incident-header-id">#{incidentId}</span>}
              <span className="incident-header-service">{top.service}</span>
            </div>

            <div className="incident-meta-row">
              <div className="incident-meta-item">
                <span className="summary-label">Root cause</span>
                <div className="summary-value" style={{ fontSize: "1.05rem" }}>
                  {top.service}
                </div>
              </div>
              <div className="incident-meta-item">
                <span className="summary-label">Confidence</span>
                <div className="summary-value" style={{ fontSize: "1.05rem" }}>
                  {top.score.toFixed(2)}
                </div>
              </div>
              <div className="incident-meta-item">
                <span className="summary-label">Impact</span>
                <div className="summary-value" style={{ fontSize: "1.05rem" }}>
                  {top.affectedDownstreamServices.length > 0 ? top.affectedDownstreamServices.join(", ") : "none"}
                </div>
              </div>
              <div className="incident-meta-item">
                <span className="summary-label">Failures ({LIVE_WINDOW_MINUTES}m)</span>
                <div className="summary-value tone-critical" style={{ fontSize: "1.05rem" }}>
                  {failureCount}
                </div>
              </div>
            </div>

            {path.length > 1 && (
              <section className="panel">
                <h2 className="section-title">Dependency path</h2>
                <div className="dependency-path">
                  {path.map((service, i) => (
                    <span key={service} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span className={`dependency-path-node${affectedServices.has(service) ? " is-affected" : ""}`}>
                        {service}
                      </span>
                      {i < path.length - 1 && <span className="dependency-path-arrow">&rarr;</span>}
                    </span>
                  ))}
                </div>
              </section>
            )}

            <section className="panel">
              <h2 className="section-title">Evidence</h2>
              <div className="inspector-row">
                <span className="inspector-row-label">Reason</span>
                <span className="inspector-row-value" style={{ fontWeight: 400 }}>
                  {top.reason}
                </span>
              </div>
              <div className="inspector-row">
                <span className="inspector-row-label">Error rate</span>
                <span className="inspector-row-value">{fmtRate(metrics.data?.errorRate[top.service])}</span>
              </div>
              <div className="inspector-row">
                <span className="inspector-row-label">P95 latency</span>
                <span className="inspector-row-value">{fmtMs(metrics.data?.latencyP95[top.service])}</span>
              </div>
            </section>

            <section className="panel">
              <h2 className="section-title">Timeline</h2>
              {timeline.length === 0 ? (
                <p className="state-message">No events in the live window for the affected services.</p>
              ) : (
                <ol className="incident-timeline">
                  {timeline.map((e) => (
                    <li key={e.eventId}>
                      <span className="incident-timeline-time">{new Date(e.timestamp).toLocaleTimeString()}</span>
                      <span className="incident-timeline-desc">
                        {e.sourceService} &rarr; {e.targetService} &middot; {e.operation}
                      </span>
                      <StatusBadge status={e.status} />
                    </li>
                  ))}
                </ol>
              )}
            </section>

            {rootCauses.data && rootCauses.data.length > 1 && (
              <section className="panel">
                <h2 className="section-title">Other candidates</h2>
                <ol className="rca-list">
                  {rootCauses.data.slice(1).map((c) => (
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
              </section>
            )}
          </>
        )}
      </SectionState>

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
        {exploreRootCauses.data && exploreRootCauses.data.length === 0 && <p className="state-message">No failures in this window.</p>}
        {exploreRootCauses.data && exploreRootCauses.data.length > 0 && (
          <ol className="rca-list">
            {exploreRootCauses.data.map((c) => (
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
        )}
      </section>
    </div>
  );
}
