import { Link } from "react-router-dom";
import type { DependencyGraphResponse, RootCauseCandidate } from "../types";
import type { RuntimeMetrics } from "./MetricsPanel";
import { useIncidentState } from "../hooks/useIncidentState";
import { LIVE_WINDOW_MINUTES } from "../services/api";
import SectionState from "./SectionState";

interface Props {
  candidates: RootCauseCandidate[] | null;
  metrics: RuntimeMetrics | null;
  graph: DependencyGraphResponse | null;
  loading: boolean;
  error: string | null;
  /** compact = embedded in Overview's side panel: no outer box, condensed content. */
  compact?: boolean;
}

function fmtMs(v: number | undefined): string {
  return v === undefined ? "—" : `${(v * 1000).toFixed(0)} ms`;
}

function fmtRate(v: number | undefined): string {
  return v === undefined ? "—" : `${v.toFixed(2)} req/s`;
}

function Content({ candidates, metrics, graph, loading, error, compact }: Props) {
  const incident = useIncidentState(candidates);
  const top = candidates && candidates.length > 0 ? candidates[0] : null;
  const relatedEdges = graph?.edges.filter(
    (e) => top && (e.sourceService === top.service || e.targetService === top.service)
  );

  return (
    <SectionState loading={loading} error={error} empty={false} skeletonRows={2}>
      {incident.status === "healthy" && (
        <div className="rca-clean-state tone-good">
          <div className="rca-state-label tone-good">System healthy</div>
          {!compact && <p className="rca-highlight-reason">No active incidents ({LIVE_WINDOW_MINUTES}m window).</p>}
        </div>
      )}

      {incident.status === "recovered" && incident.lastIncident && (
        <div className="rca-clean-state tone-warning">
          <div className="rca-state-label tone-warning">System recovered</div>
          <p className="rca-highlight-reason">
            {incident.lastIncident.service} no longer active.{!compact && ` No failures in the last ${LIVE_WINDOW_MINUTES}m.`}
          </p>
        </div>
      )}

      {top && (
        <div className="rca-highlight">
          <div className="rca-state-label tone-critical">Incident detected</div>
          <div className="rca-highlight-service">{top.service}</div>
          <p className="rca-highlight-reason">{top.reason}</p>
          <div className="rca-highlight-meta">
            <div className="rca-highlight-metric">
              <span className="rca-highlight-metric-label">Confidence</span>
              <span className="rca-highlight-metric-value">{top.score.toFixed(2)}</span>
            </div>
            {!compact && (
              <>
                <div className="rca-highlight-metric">
                  <span className="rca-highlight-metric-label">Error rate</span>
                  <span className="rca-highlight-metric-value">{fmtRate(metrics?.errorRate[top.service])}</span>
                </div>
                <div className="rca-highlight-metric">
                  <span className="rca-highlight-metric-label">p95 latency</span>
                  <span className="rca-highlight-metric-value">{fmtMs(metrics?.latencyP95[top.service])}</span>
                </div>
                <div className="rca-highlight-metric">
                  <span className="rca-highlight-metric-label">Affects</span>
                  <span className="rca-highlight-metric-value">
                    {top.affectedDownstreamServices.length > 0 ? top.affectedDownstreamServices.join(", ") : "none"}
                  </span>
                </div>
              </>
            )}
          </div>
          {!compact && relatedEdges && relatedEdges.length > 0 && (
            <div className="rca-highlight-metric">
              <span className="rca-highlight-metric-label">Related dependencies</span>
              <span className="rca-highlight-metric-value">
                {relatedEdges.map((e) => `${e.sourceService} -> ${e.targetService} (${e.failedCalls} failed)`).join(", ")}
              </span>
            </div>
          )}
        </div>
      )}

      {!compact && candidates && candidates.length > 1 && (
        <ol className="rca-list">
          {candidates.slice(1).map((c) => (
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
    </SectionState>
  );
}

export default function RootCauseSummaryCard(props: Props) {
  const { compact = false } = props;

  if (compact) {
    return (
      <>
        <div className="panel-header-row">
          <h2 className="section-title">Root Cause</h2>
          <Link to="/incidents" className="panel-header-link">
            Full &rarr;
          </Link>
        </div>
        <Content {...props} />
      </>
    );
  }

  return (
    <section className="panel">
      <h2 className="section-title">Root Cause Analysis</h2>
      <Content {...props} />
    </section>
  );
}
