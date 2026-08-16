import { useEffect, useState } from "react";
import type { DependencyGraphResponse, RootCauseCandidate } from "../types";
import { LIVE_WINDOW_MINUTES } from "../services/api";
import type { RuntimeMetrics } from "./MetricsPanel";
import SectionState from "./SectionState";

interface Props {
  candidates: RootCauseCandidate[] | null;
  metrics: RuntimeMetrics | null;
  graph: DependencyGraphResponse | null;
  loading: boolean;
  error: string | null;
}

function fmtMs(v: number | undefined): string {
  return v === undefined ? "—" : `${(v * 1000).toFixed(0)} ms`;
}

function fmtRate(v: number | undefined): string {
  return v === undefined ? "—" : `${v.toFixed(2)} req/s`;
}

// How long the "just recovered" banner stays up after an incident clears,
// so a resolved incident isn't missed between polls. This is purely a
// display grace period held in component state - not persisted incident
// state, and unrelated to LIVE_WINDOW_MINUTES (which controls what RCA
// itself scores).
const RECOVERY_DISPLAY_MS = 60_000;

interface IncidentState {
  status: "healthy" | "incident" | "recovered";
  lastIncident: RootCauseCandidate | null;
  recoveredAt: number | null;
}

export default function RootCausePanel({ candidates, metrics, graph, loading, error }: Props) {
  const [incident, setIncident] = useState<IncidentState>({
    status: "healthy",
    lastIncident: null,
    recoveredAt: null,
  });

  useEffect(() => {
    if (!candidates) return; // still loading - don't change state on a null poll
    const top = candidates.length > 0 ? candidates[0] : null;
    setIncident((prev) => {
      if (top) return { status: "incident", lastIncident: top, recoveredAt: null };
      if (prev.status === "incident") return { status: "recovered", lastIncident: prev.lastIncident, recoveredAt: Date.now() };
      if (prev.status === "recovered" && prev.recoveredAt !== null && Date.now() - prev.recoveredAt < RECOVERY_DISPLAY_MS) {
        return prev;
      }
      return { status: "healthy", lastIncident: null, recoveredAt: null };
    });
  }, [candidates]);

  const top = candidates && candidates.length > 0 ? candidates[0] : null;
  const relatedEdges = graph?.edges.filter(
    (e) => top && (e.sourceService === top.service || e.targetService === top.service)
  );

  return (
    <section className="panel">
      <h2 className="section-title">Root Cause Analysis</h2>
      <SectionState loading={loading} error={error} empty={false} skeletonRows={2}>
        {incident.status === "healthy" && (
          <div className="rca-clean-state tone-good">
            <div className="rca-state-label tone-good">System healthy</div>
            <p className="rca-highlight-reason">
              No active incidents detected in the last {LIVE_WINDOW_MINUTES} minutes.
            </p>
          </div>
        )}

        {incident.status === "recovered" && incident.lastIncident && (
          <div className="rca-clean-state tone-warning">
            <div className="rca-state-label tone-warning">System recovered</div>
            <p className="rca-highlight-reason">
              The most recent incident ({incident.lastIncident.service}) is no longer active. No failures
              detected in the last {LIVE_WINDOW_MINUTES} minutes.
            </p>
          </div>
        )}

        {top && (
          <div className="rca-highlight">
            <div className="rca-state-label tone-critical">Incident detected</div>
            <div className="rca-highlight-label">Root cause #{top.rank}</div>
            <div className="rca-highlight-service">{top.service}</div>
            <p className="rca-highlight-reason">{top.reason}</p>
            <div className="rca-highlight-meta">
              <div className="rca-highlight-metric">
                <span className="rca-highlight-metric-label">Confidence score</span>
                <span className="rca-highlight-metric-value">{top.score.toFixed(2)}</span>
              </div>
              <div className="rca-highlight-metric">
                <span className="rca-highlight-metric-label">Error rate</span>
                <span className="rca-highlight-metric-value">{fmtRate(metrics?.errorRate[top.service])}</span>
              </div>
              <div className="rca-highlight-metric">
                <span className="rca-highlight-metric-label">p95 latency</span>
                <span className="rca-highlight-metric-value">{fmtMs(metrics?.latencyP95[top.service])}</span>
              </div>
              <div className="rca-highlight-metric">
                <span className="rca-highlight-metric-label">Affected downstream</span>
                <span className="rca-highlight-metric-value">
                  {top.affectedDownstreamServices.length > 0 ? top.affectedDownstreamServices.join(", ") : "none"}
                </span>
              </div>
            </div>
            {relatedEdges && relatedEdges.length > 0 && (
              <div className="rca-highlight-metric">
                <span className="rca-highlight-metric-label">Related dependencies</span>
                <span className="rca-highlight-metric-value">
                  {relatedEdges
                    .map((e) => `${e.sourceService} -> ${e.targetService} (${e.failedCalls} failed)`)
                    .join(", ")}
                </span>
              </div>
            )}
          </div>
        )}

        {candidates && candidates.length > 1 && (
          <ol className="rca-list">
            {candidates.slice(1).map((c) => (
              <li key={c.service}>
                <div className="rca-headline">
                  <span className="rca-rank">{c.rank}.</span>
                  <span className="rca-service">{c.service}</span>
                  <span className="rca-score">{c.score.toFixed(2)}</span>
                </div>
                <div className="rca-reason">Reason: {c.reason}</div>
                {c.affectedDownstreamServices.length > 0 && (
                  <div className="rca-downstream">Affects: {c.affectedDownstreamServices.join(", ")}</div>
                )}
              </li>
            ))}
          </ol>
        )}
      </SectionState>
    </section>
  );
}
