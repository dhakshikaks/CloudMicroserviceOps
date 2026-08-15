import type { DependencyGraphResponse, RootCauseCandidate } from "../types";
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

export default function RootCausePanel({ candidates, metrics, graph, loading, error }: Props) {
  const top = candidates && candidates.length > 0 ? candidates[0] : null;
  const relatedEdges = graph?.edges.filter(
    (e) => top && (e.sourceService === top.service || e.targetService === top.service)
  );

  return (
    <section className="panel">
      <h2 className="section-title">Root Cause Analysis</h2>
      <SectionState loading={loading} error={error} empty={false} skeletonRows={2}>
        {!top && (
          <div className="rca-clean-state">No active incident - no failures detected in the recent window.</div>
        )}

        {top && (
          <div className="rca-highlight">
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
