import { useEffect, useState } from "react";
import { getIncidentReport, getMetricsSnapshot, getRootCauses, LIVE_WINDOW_MINUTES } from "../services/api";
import { useFetchState } from "../hooks/useFetchState";
import { usePolling } from "../hooks/usePolling";
import { useIncidentState } from "../hooks/useIncidentState";
import StatusBadge from "../components/StatusBadge";
import SectionState from "../components/SectionState";
import type { IncidentReport, RootCauseCandidate } from "../types";
import type { RuntimeMetrics } from "../components/MetricsPanel";

const POLL_INTERVAL_MS = 7000;
const EXPLORE_WINDOWS = [5, 15, 30, 60, 180, 360];

function fmtRate(v: number | undefined): string {
  return v === undefined ? "—" : `${v.toFixed(2)} req/s`;
}
function fmtMs(v: number | undefined): string {
  return v === undefined ? "—" : `${(v * 1000).toFixed(0)} ms`;
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
  // Drives only the healthy/incident/recovered banner - the RCA scorer's own
  // pinned-window output, unrelated to the richer report fetched below.
  const rootCauses = useFetchState<RootCauseCandidate[]>();
  const metrics = useFetchState<RuntimeMetrics>();
  // The Java-side Incident Report (com.cloudmicroops.service.ReportServiceImpl)
  // now computes dependency path / impact split / timeline / other candidates
  // server-side - this page only formats what it returns.
  const report = useFetchState<IncidentReport | null>();

  usePolling(() => {
    rootCauses.run(getRootCauses());
    metrics.run(getMetricsSnapshot());
    report.run(getIncidentReport());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, POLL_INTERVAL_MS);

  const incident = useIncidentState(rootCauses.data);

  // Exploratory window: separate state, separate call, never feeds the banner above.
  const [exploreWindow, setExploreWindow] = useState(LIVE_WINDOW_MINUTES);
  const exploreReport = useFetchState<IncidentReport | null>();
  useEffect(() => {
    exploreReport.run(getIncidentReport(exploreWindow));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exploreWindow]);

  const data = report.data;
  const incidentId = data?.incidentId.slice(0, 8).toUpperCase();
  const timelineDesc = data ? [...data.timeline].reverse() : [];
  const detectionEvent = data ? data.timeline.find((e) => e.eventId === data.incidentId) : undefined;
  const detectionTime = detectionEvent ? new Date(detectionEvent.timestamp) : null;
  const durationMinutes = detectionTime ? Math.max(0, Math.round((Date.now() - detectionTime.getTime()) / 60000)) : null;

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

  return (
    <div className="page">
      <div className="page-header">
        <h1>Incident Center</h1>
      </div>

      <SectionState loading={report.loading} error={report.error} empty={false} dataSource="RCA Engine">
        {!data && incident.status === "healthy" && (
          <div className="rca-clean-state tone-good">
            <div className="rca-state-label tone-good">System healthy</div>
            <p className="rca-highlight-reason">No active incidents ({LIVE_WINDOW_MINUTES}m window).</p>
          </div>
        )}

        {!data && incident.status === "recovered" && incident.lastIncident && (
          <div className="rca-clean-state tone-warning">
            <div className="rca-state-label tone-warning">System recovered</div>
            <p className="rca-highlight-reason">
              {incident.lastIncident.service} no longer active. No failures in the last {LIVE_WINDOW_MINUTES}m.
            </p>
          </div>
        )}

        {data && (
          <>
            <div className="incident-header">
              <span className="incident-header-label">Incident</span>
              {incidentId && <span className="incident-header-id">#{incidentId}</span>}
              <span className="incident-header-service">{data.rootCauseService}</span>
              <span className="cell-muted">
                {data.affectedDownstreamServices.length > 0
                  ? `propagating to ${data.affectedDownstreamServices.length} downstream service${data.affectedDownstreamServices.length === 1 ? "" : "s"}`
                  : "no downstream propagation observed"}
              </span>
            </div>

            <div className="incident-meta-row">
              <div className="incident-meta-item">
                <span className="summary-label">Detected</span>
                <div className="summary-value" style={{ fontSize: "1.05rem" }}>
                  {detectionTime ? detectionTime.toLocaleTimeString() : "—"}
                </div>
              </div>
              <div className="incident-meta-item">
                <span className="summary-label">Duration</span>
                <div className="summary-value" style={{ fontSize: "1.05rem" }}>
                  {durationMinutes === null ? "—" : `${durationMinutes}m`}
                </div>
              </div>
              <div className="incident-meta-item">
                <span className="summary-label">Failures ({LIVE_WINDOW_MINUTES}m)</span>
                <div className="summary-value" style={{ fontSize: "1.05rem", fontWeight: 800 }}>
                  {data.failureCount}
                </div>
              </div>
              <div className="incident-meta-item">
                <span className="summary-label">Affected services</span>
                <div className="summary-value" style={{ fontSize: "1.05rem" }}>
                  {data.affectedDownstreamServices.length + 1}
                </div>
              </div>
            </div>

            <section className="incident-why">
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

            <section className="panel">
              <h2 className="section-title">Impact</h2>
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
            </section>

            {data.dependencyPath.length > 1 && (
              <section className="panel">
                <h2 className="section-title">Dependency path</h2>
                <div className="dependency-path">
                  {data.dependencyPath.map((service, i) => (
                    <span key={service} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span className={`dependency-path-node${affectedServices.has(service) ? " is-affected" : ""}`}>
                        {service}
                      </span>
                      {i < data.dependencyPath.length - 1 && <span className="dependency-path-arrow">&rarr;</span>}
                    </span>
                  ))}
                </div>
              </section>
            )}

            <section className="panel">
              <h2 className="section-title">Incident timeline</h2>
              {timelineDesc.length === 0 ? (
                <p className="state-message">No events in the live window for the affected services.</p>
              ) : (
                <ol className="incident-timeline">
                  {timelineDesc.map((e) => (
                    <li key={e.eventId} className={e.status === "FAILURE" ? "is-failure" : undefined}>
                      <span className="incident-timeline-dot" />
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

            {data.otherCandidates.length > 0 && (
              <section className="panel">
                <h2 className="section-title">Other candidates</h2>
                <CandidateList candidates={data.otherCandidates} />
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
        {!exploreReport.data && <p className="state-message">No failures in this window.</p>}
        {exploreCandidates.length > 0 && <CandidateList candidates={exploreCandidates} />}
      </section>
    </div>
  );
}
