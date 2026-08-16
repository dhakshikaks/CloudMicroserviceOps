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
import RootCauseSummaryCard from "../components/RootCauseSummaryCard";
import StatusBadge from "../components/StatusBadge";
import type { DependencyGraphResponse, RootCauseCandidate, ServiceEventRecord } from "../types";
import type { RuntimeMetrics } from "../components/MetricsPanel";

const POLL_INTERVAL_MS = 7000;
const EXPLORE_WINDOWS = [5, 15, 30, 60, 180, 360];

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

  return (
    <div className="page">
      <div className="page-header">
        <h1>Incident Center</h1>
        <p>Root-cause analysis, evaluated against the live {LIVE_WINDOW_MINUTES}-minute window.</p>
      </div>

      <RootCauseSummaryCard
        candidates={rootCauses.data}
        metrics={metrics.data}
        graph={graph.data}
        loading={rootCauses.loading}
        error={rootCauses.error}
      />

      {top && (
        <section className="panel">
          <h2 className="section-title">Incident timeline</h2>
          <p className="section-subtitle">
            Events involving {[...affectedServices].join(", ")} within the live window, most recent first.
          </p>
          {timeline.length === 0 ? (
            <p className="state-message">No events found in the live window for the affected services.</p>
          ) : (
            <ol className="incident-timeline">
              {timeline.map((e) => (
                <li key={e.eventId} className={e.status === "FAILURE" ? "is-failure" : ""}>
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
      )}

      <section className="panel">
        <h2 className="section-title">Explore a different window</h2>
        <p className="section-subtitle">
          Read-only exploration - does not change the incident banner above, which always reflects the pinned{" "}
          {LIVE_WINDOW_MINUTES}-minute live window.
        </p>
        <div className="incident-explore-control">
          <label htmlFor="explore-window">Window (minutes)</label>
          <select id="explore-window" value={exploreWindow} onChange={(e) => setExploreWindow(Number(e.target.value))}>
            {EXPLORE_WINDOWS.map((w) => (
              <option key={w} value={w}>
                {w} min{w !== LIVE_WINDOW_MINUTES ? " (not live default)" : ""}
              </option>
            ))}
          </select>
          {exploreWindow !== LIVE_WINDOW_MINUTES && (
            <span className="incident-explore-badge">Viewing window: {exploreWindow}m (not live default)</span>
          )}
        </div>
        {exploreRootCauses.data && exploreRootCauses.data.length === 0 && (
          <p className="state-message">No failures found in this window.</p>
        )}
        {exploreRootCauses.data && exploreRootCauses.data.length > 0 && (
          <ol className="rca-list">
            {exploreRootCauses.data.map((c) => (
              <li key={c.service}>
                <div className="rca-headline">
                  <span className="rca-rank">{c.rank}.</span>
                  <span className="rca-service">{c.service}</span>
                  <span className="rca-score">{c.score.toFixed(2)}</span>
                </div>
                <div className="rca-reason">Reason: {c.reason}</div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
