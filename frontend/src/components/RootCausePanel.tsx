import type { RootCauseCandidate } from "../types";
import SectionState from "./SectionState";

interface Props {
  candidates: RootCauseCandidate[] | null;
  loading: boolean;
  error: string | null;
}

export default function RootCausePanel({ candidates, loading, error }: Props) {
  return (
    <section className="panel">
      <h2>Root Cause Ranking</h2>
      <SectionState
        loading={loading}
        error={error}
        empty={!candidates || candidates.length === 0}
        emptyMessage="No failures detected in the recent window."
      >
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
