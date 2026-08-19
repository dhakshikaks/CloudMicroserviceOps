interface Props {
  /** A short factual sentence about what the metric means in this window - no marketing language. */
  text: string;
  source: "Prometheus" | "Event Stream" | "RCA Engine";
  windowLabel: string;
  updatedSecondsAgo?: number;
}

/** Shared metric-context + data-provenance footer, reused across Metrics/Incidents/System Health. */
export default function MetricExplainer({ text, source, windowLabel, updatedSecondsAgo }: Props) {
  return (
    <div>
      <p className="metric-explainer">{text}</p>
      <div className="data-provenance">
        <span>
          Source: <strong>{source}</strong>
        </span>
        <span>
          Window: <strong>{windowLabel}</strong>
        </span>
        {updatedSecondsAgo !== undefined && (
          <span>
            Updated: <strong>{updatedSecondsAgo}s ago</strong>
          </span>
        )}
      </div>
    </div>
  );
}
