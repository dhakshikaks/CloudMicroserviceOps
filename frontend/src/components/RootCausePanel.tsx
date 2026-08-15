import type { RootCauseCandidate } from "../types";
import SectionState from "./SectionState";

interface Props {
  candidates: RootCauseCandidate[] | null;
  loading: boolean;
  error: string | null;
}

export default function RootCausePanel({ candidates, loading, error }: Props) {
  const top = candidates && candidates.length > 0 ? candidates[0] : null;

  return (
    <section className="panel">
      <h2>Root Cause Analysis</h2>
      <SectionState
        loading={loading}
        error={error}
        empty={!candidates || candidates.length === 0}
        emptyMessage="No failures detected in the recent window."
      >
        {top && (
          <div className="rca-highlight">
            <div className="rca-highlight-label">ROOT CAUSE #{top.rank}</div>
            <div className="rca-highlight-service">{top.service}</div>
            <div className="rca-highlight-score">Score: {top.score.toFixed(2)}</div>
          </div>
        )}
        <ol className="rca-list">
          {candidates?.map((c) => (
            <li key={c.service}>
              <div className="rca-headline">
                <span className="rca-rank">{c.rank}.</span>
                <span className="rca-service">{c.service}</span>
                <span className="rca-score">{c.score.toFixed(2)}</span>
              </div>
              <div className="rca-reason">Reason: {c.reason}</div>
              {c.affectedDownstreamServices.length > 0 && (
                <div className="rca-downstream">
                  Affects: {c.affectedDownstreamServices.join(", ")}
                </div>
              )}
            </li>
          ))}
        </ol>
      </SectionState>
    </section>
  );
}
